// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StakeholdShare} from "../src/StakeholdShare.sol";
import {StakeholdProperty} from "../src/StakeholdProperty.sol";
import {StakeholdFactory} from "../src/StakeholdFactory.sol";

/// @dev Shared test harness. Spins up a full Stakehold stack — share impl,
///      property impl, factory, and one genesis property via the factory —
///      then hands out three initial co-owners.
///
///      Using the factory in tests (instead of deploying proxies by hand)
///      gives us coverage over the real launch path on every test run.
abstract contract Base is Test {
    // Implementations
    StakeholdShare internal shareImpl;
    StakeholdProperty internal propertyImpl;

    // Factory
    StakeholdFactory internal factory;

    // Property under test
    StakeholdProperty internal property;
    StakeholdShare internal share;

    // Actors
    address internal factoryAdmin = makeAddr("factory-admin");
    address internal treasury = makeAddr("treasury");
    address internal admin = makeAddr("property-admin");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal dave = makeAddr("dave"); // non-owner

    uint256 internal constant INITIAL_PROPERTY_VALUE = 500_000 * 1e6; // $500k USDC-style
    uint256 internal constant LAUNCH_FEE = 0.001 ether;

    function setUp() public virtual {
        shareImpl = new StakeholdShare();
        propertyImpl = new StakeholdProperty();

        factory = new StakeholdFactory(
            address(shareImpl),
            address(propertyImpl),
            LAUNCH_FEE,
            payable(treasury),
            factoryAdmin
        );

        (address prop, address sh) = _launchProperty(admin);
        property = StakeholdProperty(prop);
        share = StakeholdShare(payable(sh));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Standard 3-co-owner launch. 50% / 30% / 20%.
    function _launchProperty(address propAdmin) internal returns (address prop, address sh) {
        address[] memory owners = new address[](3);
        owners[0] = alice;
        owners[1] = bob;
        owners[2] = carol;

        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 500_000 ether;
        amounts[1] = 300_000 ether;
        amounts[2] = 200_000 ether;

        StakeholdFactory.LaunchParams memory p = _defaultLaunchParams(propAdmin, owners, amounts);
        vm.deal(address(this), LAUNCH_FEE);
        (prop, sh) = factory.createProperty{value: LAUNCH_FEE}(p);
    }

    function _defaultLaunchParams(
        address propAdmin,
        address[] memory holders,
        uint256[] memory amounts
    ) internal pure returns (StakeholdFactory.LaunchParams memory) {
        return StakeholdFactory.LaunchParams({
            tokenName: "123 Main St Shares",
            tokenSymbol: "HOME",
            displayName: "Brooklyn Heights Brownstone",
            city: "Brooklyn, NY, USA",
            propertyType: StakeholdProperty.PropertyType.Residential,
            publicMetadataURI: "ipfs://publicbundle",
            legalDocsURI: "ipfs://legaldocs",
            propertyValueUsd: INITIAL_PROPERTY_VALUE,
            admin: propAdmin,
            initialHolders: holders,
            initialAmounts: amounts
        });
    }

    function _smallContribution(address who) internal returns (uint256 id) {
        vm.prank(who);
        (id, ) = property.submitContribution(100 * 1e6, keccak256("receipt-small"), "ipfs://small");
    }

    function _largeContribution(address who) internal returns (uint256 id, uint256 proposalId) {
        vm.prank(who);
        (id, proposalId) =
            property.submitContribution(10_000 * 1e6, keccak256("receipt-large"), "ipfs://large");
    }
}
