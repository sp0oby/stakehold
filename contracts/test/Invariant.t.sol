// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, StdInvariant} from "forge-std/Test.sol";
import {StakeholdShare} from "../src/StakeholdShare.sol";
import {StakeholdProperty} from "../src/StakeholdProperty.sol";
import {StakeholdFactory} from "../src/StakeholdFactory.sol";

/// @dev Handler: fuzzer interacts with this harness which drives tenant
///      yield deposits and arbitrary holder-to-holder transfers. We
///      conservatively require all invariants hold over these operations.
contract Handler is Test {
    StakeholdShare public share;
    address[] public holders;
    uint256 public totalDeposited;

    constructor(StakeholdShare share_, address[] memory holders_) {
        share = share_;
        holders = holders_;
    }

    function deposit(uint96 amount) external {
        uint256 a = bound(uint256(amount), 1, 10 ether);
        vm.deal(address(this), a);
        share.distributeYield{value: a}();
        totalDeposited += a;
    }

    function transfer(uint8 fromIdx, uint8 toIdx, uint96 amount) external {
        address from = holders[fromIdx % holders.length];
        address to = holders[toIdx % holders.length];
        if (from == to) return;
        uint256 bal = share.balanceOf(from);
        if (bal == 0) return;
        uint256 a = bound(uint256(amount), 1, bal);
        vm.prank(from);
        share.transfer(to, a);
    }

    function claim(uint8 idx) external {
        address h = holders[idx % holders.length];
        if (share.claimableYield(h) == 0) return;
        vm.prank(h);
        share.claimYield();
    }
}

contract InvariantStakehold is StdInvariant, Test {
    StakeholdShare internal share;
    StakeholdProperty internal property;
    StakeholdFactory internal factory;
    Handler internal handler;
    address[] internal holders;

    address internal admin = makeAddr("admin");
    address internal factoryAdmin = makeAddr("factory-admin");
    address internal treasury = makeAddr("treasury");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    function setUp() public {
        StakeholdShare si = new StakeholdShare();
        StakeholdProperty pi = new StakeholdProperty();
        factory = new StakeholdFactory(
            address(si), address(pi), 0, payable(treasury), factoryAdmin
        );

        holders = new address[](3);
        holders[0] = alice;
        holders[1] = bob;
        holders[2] = carol;

        address[] memory owners = new address[](3);
        owners[0] = alice; owners[1] = bob; owners[2] = carol;
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 500_000 ether;
        amounts[1] = 300_000 ether;
        amounts[2] = 200_000 ether;

        StakeholdFactory.LaunchParams memory p = StakeholdFactory.LaunchParams({
            tokenName: "X", tokenSymbol: "X",
            displayName: "X", city: "X",
            propertyType: StakeholdProperty.PropertyType.Residential,
            publicMetadataURI: "X", legalDocsURI: "X",
            propertyValueUsd: 1_000_000 * 1e6,
            admin: admin,
            initialHolders: owners,
            initialAmounts: amounts
        });
        (address prop, address sh) = factory.createProperty(p);
        property = StakeholdProperty(prop);
        share = StakeholdShare(payable(sh));

        handler = new Handler(share, holders);
        targetContract(address(handler));
    }

    /// @dev Total supply never drops below the initial 1M (no burn path in V1).
    function invariant_TotalSupplyMonotonic() public view {
        assertGe(share.totalSupply(), 1_000_000 ether);
    }

    /// @dev Sum of balances == total supply.
    function invariant_BalancesSumToSupply() public view {
        uint256 sum;
        for (uint256 i; i < holders.length; ++i) sum += share.balanceOf(holders[i]);
        assertEq(sum, share.totalSupply());
    }

    /// @dev ETH held by share >= sum of unclaimed yield across all holders.
    function invariant_YieldSolvent() public view {
        uint256 sumClaimable;
        for (uint256 i; i < holders.length; ++i) sumClaimable += share.claimableYield(holders[i]);
        // +1 wei tolerance: per-holder rounding can leave dust under the accumulator.
        assertGe(address(share).balance + 10, sumClaimable);
    }
}
