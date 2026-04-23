// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {StakeholdShare} from "../src/StakeholdShare.sol";
import {StakeholdProperty} from "../src/StakeholdProperty.sol";

/**
 * @notice Upgrade a single Stakehold proxy (share OR property) to a new
 *         implementation. Caller must hold UPGRADER_ROLE on the proxy.
 *
 * Env:
 *   PROXY_ADDRESS  — the proxy (share or property)
 *   PROXY_KIND     — "share" or "property" (default: "property")
 *
 * Usage:
 *   PROXY_ADDRESS=0x... PROXY_KIND=share \
 *   forge script script/Upgrade.s.sol:Upgrade \
 *     --rpc-url $SEPOLIA_RPC_URL \
 *     --broadcast --verify \
 *     --etherscan-api-key $ETHERSCAN_API_KEY -vvvv
 *
 * In production this would be replaced by a Safe → Timelock → upgradeToAndCall
 * flow. The on-chain call is identical.
 */
contract Upgrade is Script {
    function run() external returns (address newImplementation) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address proxy = vm.envAddress("PROXY_ADDRESS");
        string memory kind = vm.envOr("PROXY_KIND", string("property"));
        console.log("Upgrading proxy:", proxy);
        console.log("Kind:           ", kind);

        vm.startBroadcast(pk);
        if (keccak256(bytes(kind)) == keccak256(bytes("share"))) {
            StakeholdShare impl = new StakeholdShare();
            newImplementation = address(impl);
        } else {
            StakeholdProperty impl = new StakeholdProperty();
            newImplementation = address(impl);
        }
        console.log("New implementation:", newImplementation);
        UUPSUpgradeable(proxy).upgradeToAndCall(newImplementation, "");
        console.log("Upgrade complete");
        vm.stopBroadcast();
    }
}
