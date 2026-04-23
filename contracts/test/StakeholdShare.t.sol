// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Base.t.sol";
import {StakeholdShare} from "../src/StakeholdShare.sol";

// ═════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═════════════════════════════════════════════════════════════════════════════
contract ShareInit is Base {
    function test_InitialState() public view {
        assertEq(share.name(), "123 Main St Shares");
        assertEq(share.symbol(), "HOME");
        assertEq(share.totalSupply(), 1_000_000 ether);
        assertEq(share.balanceOf(alice), 500_000 ether);
        assertEq(share.balanceOf(bob), 300_000 ether);
        assertEq(share.balanceOf(carol), 200_000 ether);
        // Admin holds roles, Property holds MINTER_ROLE, factory holds nothing.
        assertTrue(share.hasRole(share.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(share.hasRole(share.UPGRADER_ROLE(), admin));
        assertTrue(share.hasRole(share.PAUSER_ROLE(), admin));
        assertTrue(share.hasRole(share.MINTER_ROLE(), address(property)));
        assertFalse(share.hasRole(share.DEFAULT_ADMIN_ROLE(), address(factory)));
        assertFalse(share.hasRole(share.MINTER_ROLE(), address(factory)));
    }

    function test_AutoSelfDelegation() public view {
        assertEq(share.getVotes(alice), 500_000 ether);
        assertEq(share.getVotes(bob), 300_000 ether);
    }

    function test_RevertWhen_Reinitialized() public {
        address[] memory owners = new address[](1);
        owners[0] = dave;
        uint256[] memory shares = new uint256[](1);
        shares[0] = 1_000_000 ether;

        StakeholdShare.InitParams memory p = StakeholdShare.InitParams({
            name: "x",
            symbol: "x",
            admin: admin,
            minter: address(property),
            initialHolders: owners,
            initialAmounts: shares
        });
        vm.expectRevert();
        share.initialize(p);
    }

    function test_RevertWhen_InitializerCalledOnImplementation() public {
        address[] memory owners = new address[](1);
        owners[0] = dave;
        uint256[] memory shares = new uint256[](1);
        shares[0] = 1_000_000 ether;

        StakeholdShare.InitParams memory p = StakeholdShare.InitParams({
            name: "x",
            symbol: "x",
            admin: admin,
            minter: address(property),
            initialHolders: owners,
            initialAmounts: shares
        });
        vm.expectRevert();
        shareImpl.initialize(p);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// MINTING — only Property can mint
// ═════════════════════════════════════════════════════════════════════════════
contract ShareMint is Base {
    function test_RevertWhen_RandomAddressMints() public {
        vm.prank(dave);
        vm.expectRevert();
        share.mint(dave, 1 ether);
    }

    function test_RevertWhen_AdminMintsDirectly() public {
        // Even the admin cannot mint directly; only MINTER_ROLE can.
        vm.prank(admin);
        vm.expectRevert();
        share.mint(admin, 1 ether);
    }

    function test_PropertyCanMintViaVesting() public {
        // Path: submit → timelock → execute → warp cliff → claim → share minted.
        uint256 id = _smallContribution(alice);
        vm.warp(block.timestamp + property.timelockDelay() + 1);
        property.executeAutoApproved(id);
        uint256 grantId = property.nextGrantId();

        uint256 supplyBefore = share.totalSupply();
        vm.warp(block.timestamp + 180 days + 1);
        vm.prank(alice);
        property.claimVestedShares(grantId);
        assertGt(share.totalSupply(), supplyBefore);
    }

    function test_MintAutoSelfDelegates() public {
        // Dave is not an initial holder so has no votes. Execute a
        // contribution from dave, vest, claim, and confirm votes show up.
        uint256 id = _smallContribution(dave);
        vm.warp(block.timestamp + property.timelockDelay() + 1);
        property.executeAutoApproved(id);
        uint256 grantId = property.nextGrantId();
        vm.warp(block.timestamp + 180 days + 1);
        vm.prank(dave);
        property.claimVestedShares(grantId);
        assertGt(share.getVotes(dave), 0);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// YIELD
// ═════════════════════════════════════════════════════════════════════════════
contract ShareYield is Base {
    function test_DistributeAndClaim() public {
        vm.deal(dave, 100 ether);
        vm.prank(dave);
        share.distributeYield{value: 10 ether}();

        assertEq(share.claimableYield(alice), 5 ether);
        assertEq(share.claimableYield(bob), 3 ether);
        assertEq(share.claimableYield(carol), 2 ether);

        vm.prank(alice);
        share.claimYield();
        assertEq(alice.balance, 5 ether);
        assertEq(share.claimableYield(alice), 0);
    }

    function test_MultipleRoundsAccumulate() public {
        vm.deal(dave, 100 ether);
        vm.prank(dave);
        share.distributeYield{value: 10 ether}();
        vm.prank(dave);
        share.distributeYield{value: 6 ether}();
        assertEq(share.claimableYield(alice), 8 ether);
    }

    function test_TransferSettlesYieldCorrectly() public {
        vm.deal(dave, 100 ether);
        vm.prank(dave);
        share.distributeYield{value: 10 ether}();
        vm.prank(alice);
        share.transfer(bob, 500_000 ether);

        // Alice's earned yield is settled pre-transfer.
        assertEq(share.claimableYield(alice), 5 ether);

        // Further distributions go pro-rata to new balances.
        vm.prank(dave);
        share.distributeYield{value: 10 ether}();
        assertEq(share.claimableYield(bob), 3 ether + 8 ether);
        assertEq(share.claimableYield(alice), 5 ether);
    }

    function test_RevertWhen_ClaimWithNothing() public {
        vm.prank(dave);
        vm.expectRevert(StakeholdShare.NoYield.selector);
        share.claimYield();
    }

    function test_RevertWhen_DistributeZero() public {
        vm.prank(dave);
        vm.expectRevert(StakeholdShare.ZeroAmount.selector);
        share.distributeYield{value: 0}();
    }

    function test_ReceiveAcceptsEthAsYield() public {
        vm.deal(dave, 10 ether);
        vm.prank(dave);
        (bool ok, ) = address(share).call{value: 10 ether}("");
        assertTrue(ok);
        assertEq(share.claimableYield(alice), 5 ether);
    }

    function test_ReceiveStillWorksWhilePaused() public {
        // Rent should not fail during incident response.
        vm.prank(admin);
        share.pause();
        vm.deal(dave, 10 ether);
        vm.prank(dave);
        (bool ok, ) = address(share).call{value: 10 ether}("");
        assertTrue(ok);
    }

    function testFuzz_YieldConservation(uint96[3] calldata rounds) public {
        uint256 total;
        for (uint256 i; i < 3; ++i) {
            uint256 amt = bound(uint256(rounds[i]), 1 wei, 100 ether);
            vm.deal(dave, amt);
            vm.prank(dave);
            share.distributeYield{value: amt}();
            total += amt;
        }
        uint256 sumClaimable =
            share.claimableYield(alice) + share.claimableYield(bob) + share.claimableYield(carol);
        assertLe(sumClaimable, total);
        assertGe(sumClaimable + 3, total);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// PAUSE
// ═════════════════════════════════════════════════════════════════════════════
contract SharePause is Base {
    function test_PauseBlocksTransfers() public {
        vm.prank(admin);
        share.pause();
        vm.prank(alice);
        vm.expectRevert();
        share.transfer(bob, 1 ether);
    }

    function test_UnpauseRestores() public {
        vm.prank(admin);
        share.pause();
        vm.prank(admin);
        share.unpause();
        vm.prank(alice);
        share.transfer(bob, 1 ether);
    }

    function test_RevertWhen_NonPauserPauses() public {
        vm.prank(dave);
        vm.expectRevert();
        share.pause();
    }
}
