// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Base.t.sol";
import {StakeholdProperty} from "../src/StakeholdProperty.sol";

// ═════════════════════════════════════════════════════════════════════════════
// METADATA
// ═════════════════════════════════════════════════════════════════════════════
contract PropertyInit is Base {
    function test_InitialState() public view {
        assertEq(property.displayName(), "Brooklyn Heights Brownstone");
        assertEq(property.city(), "Brooklyn, NY, USA");
        assertEq(uint8(property.propertyType()), uint8(StakeholdProperty.PropertyType.Residential));
        assertEq(property.publicMetadataURI(), "ipfs://publicbundle");
        assertEq(property.legalDocsURI(), "ipfs://legaldocs");
        assertEq(property.propertyValueUsd(), INITIAL_PROPERTY_VALUE);
        assertEq(address(property.share()), address(share));
    }

    function test_AdminRotatesLegalDocs() public {
        vm.prank(admin);
        property.setLegalDocsURI("ipfs://updated-legal");
        assertEq(property.legalDocsURI(), "ipfs://updated-legal");
    }

    function test_RevertWhen_NonAdminRotatesLegalDocs() public {
        vm.prank(dave);
        vm.expectRevert();
        property.setLegalDocsURI("ipfs://attacker");
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// CONTRIBUTIONS — auto-approve path
// ═════════════════════════════════════════════════════════════════════════════
contract PropertyContributionsAuto is Base {
    function test_SmallContributionAutoApproves() public {
        uint256 id = _smallContribution(dave);
        (, , , , , uint256 proposalId, StakeholdProperty.Status status) = property.contributions(id);
        assertEq(proposalId, 0);
        assertEq(uint8(status), uint8(StakeholdProperty.Status.Approved));
    }

    function test_ExecuteAutoApprovedAfterTimelock() public {
        uint256 id = _smallContribution(dave);
        vm.warp(block.timestamp + property.timelockDelay() + 1);
        property.executeAutoApproved(id);
        (, , , , , , StakeholdProperty.Status status) = property.contributions(id);
        assertEq(uint8(status), uint8(StakeholdProperty.Status.Executed));
    }

    function test_RevertWhen_ExecutedBeforeTimelock() public {
        uint256 id = _smallContribution(dave);
        vm.expectRevert(StakeholdProperty.TimelockNotElapsed.selector);
        property.executeAutoApproved(id);
    }

    function test_RevertWhen_ContributionZero() public {
        vm.prank(dave);
        vm.expectRevert(StakeholdProperty.ZeroAmount.selector);
        property.submitContribution(0, keccak256("x"), "ipfs://x");
    }

    function test_RevertWhen_ProofMissing() public {
        vm.prank(dave);
        vm.expectRevert(StakeholdProperty.ProofRequired.selector);
        property.submitContribution(1, bytes32(0), "ipfs://x");
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// CONTRIBUTIONS — DAO vote path
// ═════════════════════════════════════════════════════════════════════════════
contract PropertyDaoVote is Base {
    function setUp() public override {
        super.setUp();
        vm.roll(block.number + 2); // move past snapshot block
    }

    function test_LargeContributionCreatesProposal() public {
        (uint256 id, uint256 proposalId) = _largeContribution(dave);
        assertGt(proposalId, 0);
        (,,,, , uint256 cProp, StakeholdProperty.Status status) = property.contributions(id);
        assertEq(cProp, proposalId);
        assertEq(uint8(status), uint8(StakeholdProperty.Status.Pending));
    }

    function test_YesVoteApprovesAndExecutes() public {
        (uint256 cid, uint256 pid) = _largeContribution(dave);
        vm.prank(alice);
        property.voteOnProposal(pid, true); // 500k yes
        vm.prank(bob);
        property.voteOnProposal(pid, true); // 300k yes > 20% quorum

        vm.warp(block.timestamp + property.votingPeriod() + 1);
        property.executeProposal(pid); // arms timelock
        vm.warp(block.timestamp + property.timelockDelay() + 1);
        property.executeProposal(pid); // executes

        (, , , , , , StakeholdProperty.Status status) = property.contributions(cid);
        assertEq(uint8(status), uint8(StakeholdProperty.Status.Executed));
    }

    function test_NoVoteRejects() public {
        (uint256 cid, uint256 pid) = _largeContribution(dave);
        vm.prank(alice);
        property.voteOnProposal(pid, false);
        vm.prank(bob);
        property.voteOnProposal(pid, false);

        vm.warp(block.timestamp + property.votingPeriod() + 1);
        property.executeProposal(pid);
        vm.warp(block.timestamp + property.timelockDelay() + 1);
        property.executeProposal(pid);

        (, , , , , , StakeholdProperty.Status status) = property.contributions(cid);
        assertEq(uint8(status), uint8(StakeholdProperty.Status.Rejected));
    }

    function test_NoQuorumRejects() public {
        // Seed a small-holder BEFORE the snapshot so they have votes at snapshot.
        vm.prank(carol);
        share.transfer(dave, 100 ether); // dave gets 0.01% of supply
        // Transfers don't auto-delegate (unlike mint); dave must opt in.
        vm.prank(dave);
        share.delegate(dave);
        vm.roll(block.number + 2);

        (uint256 cid, uint256 pid) = _largeContribution(dave);
        // Only dave votes — 100 shares is far below the 20% quorum of 1M supply.
        vm.prank(dave);
        property.voteOnProposal(pid, true);

        vm.warp(block.timestamp + property.votingPeriod() + 1);
        property.executeProposal(pid);
        vm.warp(block.timestamp + property.timelockDelay() + 1);
        property.executeProposal(pid);

        (, , , , , , StakeholdProperty.Status status) = property.contributions(cid);
        assertEq(uint8(status), uint8(StakeholdProperty.Status.Rejected));
    }

    function test_RevertWhen_DoubleVote() public {
        (, uint256 pid) = _largeContribution(dave);
        vm.prank(alice);
        property.voteOnProposal(pid, true);
        vm.prank(alice);
        vm.expectRevert(StakeholdProperty.AlreadyVoted.selector);
        property.voteOnProposal(pid, false);
    }

    function test_RevertWhen_VoteAfterDeadline() public {
        (, uint256 pid) = _largeContribution(dave);
        vm.warp(block.timestamp + property.votingPeriod() + 1);
        vm.prank(alice);
        vm.expectRevert(StakeholdProperty.VotingClosed.selector);
        property.voteOnProposal(pid, true);
    }

    function test_RevertWhen_ExecuteBeforeVotingEnds() public {
        (, uint256 pid) = _largeContribution(dave);
        vm.expectRevert(StakeholdProperty.VotingStillOpen.selector);
        property.executeProposal(pid);
    }

    function test_RevertWhen_ZeroWeightVotes() public {
        (, uint256 pid) = _largeContribution(dave);
        vm.prank(dave);
        vm.expectRevert(StakeholdProperty.ZeroAmount.selector);
        property.voteOnProposal(pid, true);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// REBALANCE MATH
// ═════════════════════════════════════════════════════════════════════════════
contract PropertyRebalance is Base {
    function test_RebalancePreservesOwnershipRatio() public {
        // 1% of property value. Should mint ~10,101 shares (1% dilution).
        uint256 contributionUsd = INITIAL_PROPERTY_VALUE / 100;
        vm.prank(dave);
        (uint256 id,) = property.submitContribution(
            contributionUsd,
            keccak256("r"),
            "ipfs://r"
        );
        // Big contribution, so this created a proposal; skip governance for math test
        // by using auto-approve path instead. Change threshold to accept this value.
        vm.prank(admin);
        property.setGovernanceParams(contributionUsd + 1, 3 days, 2 days, 2000);

        uint256 id2 = _smallContribution(dave); // no-op reference
        id2; // silence unused

        // Submit a new contribution below the raised threshold.
        vm.prank(dave);
        (uint256 id3,) =
            property.submitContribution(contributionUsd, keccak256("r3"), "ipfs://r3");

        vm.warp(block.timestamp + property.timelockDelay() + 1);
        property.executeAutoApproved(id3);

        // Mint would be capped at 5% max; 1% is fine.
        uint256 grantId = property.nextGrantId();
        (, uint256 shares,, ) = property.vestingGrants(grantId);

        // Expected raw: 1M * 0.01 = 10,000. Solidity rounds down; accept with margin.
        assertApproxEqRel(shares, 10_000 ether, 0.01e18); // within 1%
        // Also exercise the original `id` to avoid unused-variable nags.
        id;
    }

    function test_RebalanceCapsAt5Percent() public {
        // 20% contribution should be capped to 5% dilution.
        uint256 contributionUsd = INITIAL_PROPERTY_VALUE / 5;
        vm.prank(admin);
        property.setGovernanceParams(contributionUsd + 1, 3 days, 2 days, 2000);
        vm.prank(dave);
        (uint256 id,) = property.submitContribution(contributionUsd, keccak256("r"), "ipfs://r");
        vm.warp(block.timestamp + property.timelockDelay() + 1);
        property.executeAutoApproved(id);
        uint256 grantId = property.nextGrantId();
        (, uint256 shares,, ) = property.vestingGrants(grantId);
        assertEq(shares, 50_000 ether); // 5% of 1M
    }

    function test_PropertyValueUpdatesOnRebalance() public {
        uint256 id = _smallContribution(dave);
        vm.warp(block.timestamp + property.timelockDelay() + 1);
        property.executeAutoApproved(id);
        assertEq(property.propertyValueUsd(), INITIAL_PROPERTY_VALUE + 100 * 1e6);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// VESTING
// ═════════════════════════════════════════════════════════════════════════════
contract PropertyVesting is Base {
    function test_RevertWhen_ClaimBeforeCliff() public {
        uint256 id = _smallContribution(dave);
        vm.warp(block.timestamp + property.timelockDelay() + 1);
        property.executeAutoApproved(id);
        uint256 grantId = property.nextGrantId();
        vm.prank(dave);
        vm.expectRevert(StakeholdProperty.CliffNotReached.selector);
        property.claimVestedShares(grantId);
    }

    function test_RevertWhen_NonBeneficiaryClaims() public {
        uint256 id = _smallContribution(dave);
        vm.warp(block.timestamp + property.timelockDelay() + 1);
        property.executeAutoApproved(id);
        uint256 grantId = property.nextGrantId();
        vm.warp(block.timestamp + 180 days + 1);
        vm.prank(alice);
        vm.expectRevert(StakeholdProperty.NotBeneficiary.selector);
        property.claimVestedShares(grantId);
    }

    function test_RevertWhen_DoubleClaim() public {
        uint256 id = _smallContribution(dave);
        vm.warp(block.timestamp + property.timelockDelay() + 1);
        property.executeAutoApproved(id);
        uint256 grantId = property.nextGrantId();
        vm.warp(block.timestamp + 180 days + 1);
        vm.prank(dave);
        property.claimVestedShares(grantId);
        vm.prank(dave);
        vm.expectRevert(StakeholdProperty.AlreadyClaimed.selector);
        property.claimVestedShares(grantId);
    }

    function test_VestedSharesMintOntoShareContract() public {
        uint256 id = _smallContribution(dave);
        vm.warp(block.timestamp + property.timelockDelay() + 1);
        property.executeAutoApproved(id);
        uint256 grantId = property.nextGrantId();
        (, uint256 expected,, ) = property.vestingGrants(grantId);
        uint256 before = share.balanceOf(dave);
        vm.warp(block.timestamp + 180 days + 1);
        vm.prank(dave);
        property.claimVestedShares(grantId);
        assertEq(share.balanceOf(dave) - before, expected);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN
// ═════════════════════════════════════════════════════════════════════════════
contract PropertyAdmin is Base {
    function test_SetGovernanceParams() public {
        vm.prank(admin);
        property.setGovernanceParams(1000 * 1e6, 7 days, 1 days, 3000);
        assertEq(property.autoApproveThresholdUsd(), 1000 * 1e6);
        assertEq(property.votingPeriod(), 7 days);
        assertEq(property.timelockDelay(), 1 days);
        assertEq(property.quorumBps(), 3000);
    }

    function test_RevertWhen_GovernanceParamOutOfBounds() public {
        vm.prank(admin);
        vm.expectRevert(StakeholdProperty.InvalidParam.selector);
        property.setGovernanceParams(0, 30 minutes, 1 days, 2000);
    }

    function test_CancelContribution() public {
        uint256 id = _smallContribution(dave);
        vm.prank(admin);
        property.cancelContribution(id);
        (, , , , , , StakeholdProperty.Status status) = property.contributions(id);
        assertEq(uint8(status), uint8(StakeholdProperty.Status.Cancelled));
    }
}
