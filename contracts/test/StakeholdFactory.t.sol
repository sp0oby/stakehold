// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Base.t.sol";
import {StakeholdFactory} from "../src/StakeholdFactory.sol";
import {StakeholdProperty} from "../src/StakeholdProperty.sol";
import {StakeholdShare} from "../src/StakeholdShare.sol";

contract FactoryConstruction is Base {
    function test_Wiring() public view {
        assertEq(factory.shareImplementation(), address(shareImpl));
        assertEq(factory.propertyImplementation(), address(propertyImpl));
        assertEq(factory.launchFee(), LAUNCH_FEE);
        assertEq(factory.treasury(), treasury);
        assertTrue(factory.hasRole(factory.DEFAULT_ADMIN_ROLE(), factoryAdmin));
    }

    function test_RevertWhen_ZeroShareImpl() public {
        vm.expectRevert(StakeholdFactory.InvalidImplementation.selector);
        new StakeholdFactory(address(0), address(propertyImpl), 0, payable(treasury), factoryAdmin);
    }

    function test_RevertWhen_ZeroPropertyImpl() public {
        vm.expectRevert(StakeholdFactory.InvalidImplementation.selector);
        new StakeholdFactory(address(shareImpl), address(0), 0, payable(treasury), factoryAdmin);
    }

    function test_RevertWhen_ZeroTreasury() public {
        vm.expectRevert(StakeholdFactory.ZeroAddress.selector);
        new StakeholdFactory(address(shareImpl), address(propertyImpl), 0, payable(address(0)), factoryAdmin);
    }
}

contract FactoryRegistry is Base {
    function test_GenesisRegistered() public view {
        assertTrue(factory.isProperty(address(property)));
        assertEq(factory.propertyToShare(address(property)), address(share));
        assertEq(factory.shareToProperty(address(share)), address(property));
        assertEq(factory.allPropertiesLength(), 1);
    }

    function test_FeeForwardedToTreasury() public view {
        assertEq(treasury.balance, LAUNCH_FEE);
    }

    function test_FactoryHasNoRolesAfterLaunch() public view {
        assertFalse(share.hasRole(share.DEFAULT_ADMIN_ROLE(), address(factory)));
        assertFalse(share.hasRole(share.MINTER_ROLE(), address(factory)));
        assertFalse(share.hasRole(share.PAUSER_ROLE(), address(factory)));
        assertFalse(share.hasRole(share.UPGRADER_ROLE(), address(factory)));
    }

    function test_OverpaymentRefunded() public {
        address[] memory owners = new address[](1);
        owners[0] = dave;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1_000_000 ether;

        StakeholdFactory.LaunchParams memory p =
            _defaultLaunchParams(dave, owners, amounts);
        vm.deal(dave, 1 ether);
        uint256 before = dave.balance;
        vm.prank(dave);
        factory.createProperty{value: 1 ether}(p);
        assertEq(dave.balance, before - LAUNCH_FEE);
    }

    function test_RevertWhen_FeeTooLow() public {
        address[] memory owners = new address[](1);
        owners[0] = dave;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1_000_000 ether;
        StakeholdFactory.LaunchParams memory p =
            _defaultLaunchParams(dave, owners, amounts);
        vm.deal(dave, LAUNCH_FEE);
        vm.prank(dave);
        vm.expectRevert();
        factory.createProperty{value: LAUNCH_FEE - 1}(p);
    }

    function test_MultipleProperties() public {
        address[] memory owners = new address[](1);
        owners[0] = dave;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1_000_000 ether;
        StakeholdFactory.LaunchParams memory p =
            _defaultLaunchParams(dave, owners, amounts);

        for (uint256 i; i < 3; ++i) {
            vm.deal(dave, LAUNCH_FEE);
            vm.prank(dave);
            factory.createProperty{value: LAUNCH_FEE}(p);
        }
        assertEq(factory.allPropertiesLength(), 4); // genesis + 3
        assertEq(factory.propertiesByCreatorLength(dave), 3);
    }

    function test_Isolation() public {
        // Launch a second property with only dave, give him yield via share.
        address[] memory owners = new address[](1);
        owners[0] = dave;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1_000_000 ether;
        StakeholdFactory.LaunchParams memory p =
            _defaultLaunchParams(dave, owners, amounts);
        vm.deal(dave, LAUNCH_FEE);
        vm.prank(dave);
        (, address sh2) = factory.createProperty{value: LAUNCH_FEE}(p);
        StakeholdShare share2 = StakeholdShare(payable(sh2));

        // Yield on share2 should not affect genesis share.
        vm.deal(dave, 1 ether);
        vm.prank(dave);
        share2.distributeYield{value: 1 ether}();
        assertEq(share.claimableYield(alice), 0);
        assertEq(share2.claimableYield(dave), 1 ether);
    }
}

contract FactoryAdmin is Base {
    function test_AdminUpdatesFee() public {
        vm.prank(factoryAdmin);
        factory.setLaunchFee(2 ether);
        assertEq(factory.launchFee(), 2 ether);
    }

    function test_AdminUpdatesTreasury() public {
        vm.prank(factoryAdmin);
        factory.setTreasury(payable(dave));
        assertEq(factory.treasury(), dave);
    }

    function test_RevertWhen_NonAdminUpdates() public {
        vm.prank(dave);
        vm.expectRevert();
        factory.setLaunchFee(0);
    }
}

contract FactoryPagination is Base {
    function test_PaginationOverLaunches() public {
        address[] memory owners = new address[](1);
        owners[0] = dave;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1_000_000 ether;
        StakeholdFactory.LaunchParams memory p =
            _defaultLaunchParams(dave, owners, amounts);

        for (uint256 i; i < 5; ++i) {
            vm.deal(dave, LAUNCH_FEE);
            vm.prank(dave);
            factory.createProperty{value: LAUNCH_FEE}(p);
        }
        address[] memory page1 = factory.allPropertiesPaginated(0, 2);
        address[] memory page2 = factory.allPropertiesPaginated(2, 2);
        address[] memory page3 = factory.allPropertiesPaginated(4, 2);
        assertEq(page1.length, 2);
        assertEq(page2.length, 2);
        assertEq(page3.length, 2);

        address[] memory overflow = factory.allPropertiesPaginated(100, 10);
        assertEq(overflow.length, 0);
    }
}
