// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Base.t.sol";
import {StakeholdShare} from "../src/StakeholdShare.sol";
import {StakeholdProperty} from "../src/StakeholdProperty.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract ShareV2 is StakeholdShare {
    function version() external pure override returns (string memory) { return "2.0.0"; }
    function ping() external pure returns (uint256) { return 42; }
}

contract PropertyV2 is StakeholdProperty {
    function version() external pure override returns (string memory) { return "2.0.0"; }
    function pong() external pure returns (uint256) { return 1337; }
}

contract UpgradeShare is Base {
    function test_UpgradeShare() public {
        ShareV2 impl = new ShareV2();
        vm.prank(admin);
        UUPSUpgradeable(address(share)).upgradeToAndCall(address(impl), "");
        assertEq(share.version(), "2.0.0");
        assertEq(ShareV2(payable(address(share))).ping(), 42);
        // State preserved.
        assertEq(share.totalSupply(), 1_000_000 ether);
        assertEq(share.balanceOf(alice), 500_000 ether);
    }

    function test_RevertWhen_NonUpgraderUpgradesShare() public {
        ShareV2 impl = new ShareV2();
        vm.prank(dave);
        vm.expectRevert();
        UUPSUpgradeable(address(share)).upgradeToAndCall(address(impl), "");
    }

    function test_UpgradeProperty() public {
        PropertyV2 impl = new PropertyV2();
        vm.prank(admin);
        UUPSUpgradeable(address(property)).upgradeToAndCall(address(impl), "");
        assertEq(property.version(), "2.0.0");
        assertEq(PropertyV2(address(property)).pong(), 1337);
        assertEq(property.propertyValueUsd(), INITIAL_PROPERTY_VALUE);
    }

    function test_RevertWhen_NonUpgraderUpgradesProperty() public {
        PropertyV2 impl = new PropertyV2();
        vm.prank(dave);
        vm.expectRevert();
        UUPSUpgradeable(address(property)).upgradeToAndCall(address(impl), "");
    }

    function test_ShareAndPropertyUpgradeIndependently() public {
        // Upgrading share should not touch property and vice versa.
        ShareV2 sImpl = new ShareV2();
        vm.prank(admin);
        UUPSUpgradeable(address(share)).upgradeToAndCall(address(sImpl), "");
        assertEq(property.version(), "1.0.0");

        PropertyV2 pImpl = new PropertyV2();
        vm.prank(admin);
        UUPSUpgradeable(address(property)).upgradeToAndCall(address(pImpl), "");
        assertEq(share.version(), "2.0.0");
        assertEq(property.version(), "2.0.0");
    }
}
