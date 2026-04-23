// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {StakeholdShare} from "../src/StakeholdShare.sol";
import {StakeholdProperty} from "../src/StakeholdProperty.sol";
import {StakeholdFactory} from "../src/StakeholdFactory.sol";
import {StakeholdLens} from "../src/StakeholdLens.sol";

/**
 * @title  DeployFactory
 * @notice Canonical deployment script for the Stakehold protocol.
 *         Deploys, in order:
 *           1. StakeholdShare implementation
 *           2. StakeholdProperty implementation
 *           3. StakeholdFactory (takes both implementations)
 *           4. StakeholdLens (takes the factory)
 *           5. Genesis property via factory.createProperty
 *
 *         All genesis parameters are env-overridable so the same script
 *         deploys to Sepolia, a local anvil fork, or anywhere else the
 *         operator points `--rpc-url` at.
 *
 *         Writes `deployments/latest.json` at the end for the frontend +
 *         README to consume.
 */
contract DeployFactory is Script {
    function run()
        external
        returns (
            address shareImpl,
            address propertyImpl,
            address factory,
            address lens,
            address genesisProperty,
            address genesisShare
        )
    {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        console.log("Deployer:", deployer);

        // ── Factory config
        uint256 launchFee = vm.envOr("LAUNCH_FEE_WEI", uint256(0.001 ether));
        address treasury = vm.envOr("TREASURY", deployer);

        // ── Genesis property config
        string memory tokenName = vm.envOr("GENESIS_TOKEN_NAME", string("Stakehold Genesis"));
        string memory tokenSymbol = vm.envOr("GENESIS_TOKEN_SYMBOL", string("SHG"));
        string memory displayName = vm.envOr("GENESIS_DISPLAY_NAME", string("Stakehold Genesis"));
        string memory genesisCity = vm.envOr("GENESIS_CITY", string("London, UK"));
        string memory publicURI =
            vm.envOr("GENESIS_PUBLIC_URI", string("ipfs://bafkreigenesispublic"));
        string memory legalURI =
            vm.envOr("GENESIS_LEGAL_URI", string("ipfs://bafkreigenesislegal"));
        uint256 valueUsd = vm.envOr("GENESIS_VALUE_USD", uint256(500_000 * 1e6));

        address[] memory holders = new address[](1);
        holders[0] = deployer;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1_000_000 ether;

        StakeholdFactory.LaunchParams memory genesisParams = StakeholdFactory.LaunchParams({
            tokenName: tokenName,
            tokenSymbol: tokenSymbol,
            displayName: displayName,
            city: genesisCity,
            propertyType: StakeholdProperty.PropertyType.Residential,
            publicMetadataURI: publicURI,
            legalDocsURI: legalURI,
            propertyValueUsd: valueUsd,
            admin: deployer,
            initialHolders: holders,
            initialAmounts: amounts
        });

        vm.startBroadcast(pk);

        StakeholdShare s = new StakeholdShare();
        shareImpl = address(s);
        console.log("Share impl:   ", shareImpl);

        StakeholdProperty p = new StakeholdProperty();
        propertyImpl = address(p);
        console.log("Property impl:", propertyImpl);

        StakeholdFactory f = new StakeholdFactory(
            shareImpl,
            propertyImpl,
            launchFee,
            payable(treasury),
            deployer
        );
        factory = address(f);
        console.log("Factory:      ", factory);

        StakeholdLens l = new StakeholdLens(factory);
        lens = address(l);
        console.log("Lens:         ", lens);

        (genesisProperty, genesisShare) = f.createProperty{value: launchFee}(genesisParams);
        console.log("Genesis property:", genesisProperty);
        console.log("Genesis share:   ", genesisShare);

        vm.stopBroadcast();

        string memory json = string(abi.encodePacked(
            "{\n",
            '  "shareImpl": "', vm.toString(shareImpl), '",\n',
            '  "propertyImpl": "', vm.toString(propertyImpl), '",\n',
            '  "factory": "', vm.toString(factory), '",\n',
            '  "lens": "', vm.toString(lens), '",\n',
            '  "genesisProperty": "', vm.toString(genesisProperty), '",\n',
            '  "genesisShare": "', vm.toString(genesisShare), '",\n',
            '  "deployer": "', vm.toString(deployer), '",\n',
            '  "treasury": "', vm.toString(treasury), '",\n',
            '  "launchFeeWei": "', vm.toString(launchFee), '",\n',
            '  "chainId": ', vm.toString(block.chainid), "\n",
            "}\n"
        ));
        vm.writeFile("deployments/latest.json", json);
        console.log("Wrote deployments/latest.json");
    }
}
