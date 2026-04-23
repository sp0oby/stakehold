// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Base.t.sol";
import {StakeholdLens} from "../src/StakeholdLens.sol";

contract LensReads is Base {
    StakeholdLens internal lens;

    function setUp() public override {
        super.setUp();
        lens = new StakeholdLens(address(factory));
    }

    function test_PropertyCard() public view {
        StakeholdLens.PropertyCard memory c = lens.getPropertyCard(address(property));
        assertEq(c.property, address(property));
        assertEq(c.share, address(share));
        assertEq(c.displayName, "Brooklyn Heights Brownstone");
        assertEq(c.totalShares, 1_000_000 ether);
        assertEq(c.propertyValueUsd, INITIAL_PROPERTY_VALUE);
    }

    function test_PropertyDetail() public view {
        StakeholdLens.PropertyDetail memory d = lens.getPropertyDetail(address(property));
        assertEq(d.legalDocsURI, "ipfs://legaldocs");
        assertEq(d.autoApproveThresholdUsd, 500 * 1e6);
        assertEq(d.quorumBps, 2000);
    }

    function test_UserPositionShareholder() public view {
        StakeholdLens.UserPropertyPosition memory p =
            lens.getUserPosition(address(property), alice);
        assertEq(p.shareBalance, 500_000 ether);
        assertEq(p.votingPower, 500_000 ether);
        assertTrue(p.isShareholder);
    }

    function test_UserPositionNonShareholder() public view {
        StakeholdLens.UserPropertyPosition memory p =
            lens.getUserPosition(address(property), dave);
        assertEq(p.shareBalance, 0);
        assertFalse(p.isShareholder);
    }

    function test_UserGrantsAfterContribution() public {
        uint256 id = _smallContribution(dave);
        vm.warp(block.timestamp + property.timelockDelay() + 1);
        property.executeAutoApproved(id);
        StakeholdLens.Grant[] memory grants = lens.getUserGrants(address(property), dave);
        assertEq(grants.length, 1);
        assertFalse(grants[0].claimable); // cliff not yet reached
        vm.warp(block.timestamp + 180 days + 1);
        grants = lens.getUserGrants(address(property), dave);
        assertTrue(grants[0].claimable);
    }

    function test_CardsPagination() public view {
        StakeholdLens.PropertyCard[] memory cards = lens.getPropertyCards(0, 10);
        assertEq(cards.length, 1);
    }
}
