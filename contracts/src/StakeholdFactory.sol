// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {StakeholdShare} from "./StakeholdShare.sol";
import {StakeholdProperty} from "./StakeholdProperty.sol";

/**
 * @title  StakeholdFactory
 * @custom:product Stakehold — https://stakehold.xyz
 * @notice Atomic launchpad for new Stakehold properties. Each call to
 *         `createProperty` deploys TWO proxies (Share + Property), initializes
 *         them against their respective implementations, wires the
 *         MINTER_ROLE relationship, and transfers control to the caller — all
 *         in a single transaction.
 *
 *         The factory itself is DELIBERATELY NON-UPGRADEABLE. If the launch
 *         flow ever needs to change, a new factory is deployed alongside;
 *         existing properties keep pointing at whichever implementations they
 *         were created against. This mirrors Uniswap V3's factory pattern.
 *
 *         The factory holds DEFAULT_ADMIN_ROLE on each new Share proxy for
 *         exactly one tx — just long enough to grant roles to the property
 *         admin and renounce its own. After `createProperty` returns, the
 *         factory has NO permissions on the deployed property.
 */
contract StakeholdFactory is AccessControl, ReentrancyGuard {
    // ─────────────────────────────────────────────────────────────────────────
    // IMMUTABLES
    // ─────────────────────────────────────────────────────────────────────────
    /// @notice Implementation for the Share (token) proxy.
    address public immutable shareImplementation;
    /// @notice Implementation for the Property (governance) proxy.
    address public immutable propertyImplementation;

    // ─────────────────────────────────────────────────────────────────────────
    // CONFIG (admin-mutable)
    // ─────────────────────────────────────────────────────────────────────────
    /// @notice Flat fee (wei) charged per property launch. Zero is allowed.
    uint256 public launchFee;
    /// @notice Recipient of launch fees.
    address payable public treasury;

    // ─────────────────────────────────────────────────────────────────────────
    // REGISTRY
    // ─────────────────────────────────────────────────────────────────────────
    /// @dev A property is identified by its Property contract address.
    ///      (Share is looked up via `propertyToShare`.)
    address[] private _allProperties;
    mapping(address => address[]) private _propertiesByCreator;
    mapping(address => bool) public isProperty;
    mapping(address => address) public creatorOf;
    mapping(address => address) public propertyToShare;
    mapping(address => address) public shareToProperty;

    // ─────────────────────────────────────────────────────────────────────────
    // DATA TYPES
    // ─────────────────────────────────────────────────────────────────────────
    /// @notice What the caller supplies to `createProperty`. Bundled so the
    ///         frontend has one typed payload and the factory can fan it out
    ///         into Share and Property initializers.
    struct LaunchParams {
        // Token
        string tokenName;
        string tokenSymbol;

        // Property identity (public on-chain — no street address here)
        string displayName;
        string city;
        StakeholdProperty.PropertyType propertyType;

        // Media / docs
        string publicMetadataURI;
        string legalDocsURI;

        // Economics
        uint256 propertyValueUsd;

        // Governance bootstrap
        address admin;                // DAO admin of the new property
        address[] initialHolders;     // founding share book
        uint256[] initialAmounts;     // must sum to StakeholdShare.INITIAL_SHARES
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EVENTS
    // ─────────────────────────────────────────────────────────────────────────
    event PropertyCreated(
        address indexed property,
        address indexed share,
        address indexed creator,
        string displayName,
        string city,
        StakeholdProperty.PropertyType propertyType,
        uint256 propertyValueUsd,
        uint256 timestamp
    );
    event LaunchFeeUpdated(uint256 oldFee, uint256 newFee);
    event TreasuryUpdated(address oldTreasury, address newTreasury);

    // ─────────────────────────────────────────────────────────────────────────
    // ERRORS
    // ─────────────────────────────────────────────────────────────────────────
    error ZeroAddress();
    error InvalidImplementation();
    error LaunchFeeNotMet(uint256 required, uint256 sent);
    error FeeForwardFailed();
    error RefundFailed();
    error OutOfBounds();

    // ─────────────────────────────────────────────────────────────────────────
    // CONSTRUCTOR
    // ─────────────────────────────────────────────────────────────────────────
    constructor(
        address shareImplementation_,
        address propertyImplementation_,
        uint256 launchFee_,
        address payable treasury_,
        address admin_
    ) {
        if (shareImplementation_ == address(0)) revert InvalidImplementation();
        if (propertyImplementation_ == address(0)) revert InvalidImplementation();
        if (treasury_ == address(0)) revert ZeroAddress();
        if (admin_ == address(0)) revert ZeroAddress();

        shareImplementation = shareImplementation_;
        propertyImplementation = propertyImplementation_;
        launchFee = launchFee_;
        treasury = treasury_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LAUNCH
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * @notice Deploy a fresh Stakehold property — Share proxy + Property proxy
     *         wired together. Caller pays `launchFee` (over-payment refunded)
     *         and the property's DAO admin becomes `params.admin` (defaulting
     *         to the caller on the client side).
     *
     * @return property  Address of the new StakeholdProperty proxy.
     * @return share     Address of the new StakeholdShare proxy.
     */
    function createProperty(LaunchParams calldata params)
        external
        payable
        nonReentrant
        returns (address property, address share)
    {
        uint256 fee = launchFee;
        if (msg.value < fee) revert LaunchFeeNotMet(fee, msg.value);

        // ── 1. Predict the Property proxy address so we can pass it into the
        //       Share initializer (Share needs to grant MINTER_ROLE to it).
        //       We use the sequential-nonce prediction based on the factory's
        //       creation nonce. Share is deployed next (nonce n), Property
        //       after that (nonce n+1).
        //       `vm.getNonce(address(this))` isn't available at runtime, so
        //       instead we deploy Share with a temporary minter (this factory),
        //       then deploy Property, then grant MINTER_ROLE to Property and
        //       revoke from the factory. This keeps init deterministic without
        //       cross-contract-create prediction.

        // ── 2. Deploy Share. Admin = this factory (temporary); minter = this
        //       factory (temporary, rotated after Property exists).
        StakeholdShare.InitParams memory sp = StakeholdShare.InitParams({
            name: params.tokenName,
            symbol: params.tokenSymbol,
            admin: address(this),
            minter: address(this),
            initialHolders: params.initialHolders,
            initialAmounts: params.initialAmounts
        });
        share = address(new ERC1967Proxy(
            shareImplementation,
            abi.encodeCall(StakeholdShare.initialize, (sp))
        ));

        // ── 3. Deploy Property, referencing the just-deployed Share.
        StakeholdProperty.InitParams memory pp = StakeholdProperty.InitParams({
            share: share,
            admin: params.admin,
            displayName: params.displayName,
            city: params.city,
            propertyType: params.propertyType,
            publicMetadataURI: params.publicMetadataURI,
            legalDocsURI: params.legalDocsURI,
            propertyValueUsd: params.propertyValueUsd
        });
        property = address(new ERC1967Proxy(
            propertyImplementation,
            abi.encodeCall(StakeholdProperty.initialize, (pp))
        ));

        // ── 4. Rotate roles on Share: grant to params.admin, grant MINTER to
        //       Property, revoke everything from this factory. After this,
        //       the factory has ZERO permissions on the new property.
        StakeholdShare s = StakeholdShare(payable(share));
        s.grantRole(s.MINTER_ROLE(), property);
        s.revokeRole(s.MINTER_ROLE(), address(this));

        s.grantRole(s.DEFAULT_ADMIN_ROLE(), params.admin);
        s.grantRole(s.UPGRADER_ROLE(), params.admin);
        s.grantRole(s.PAUSER_ROLE(), params.admin);
        s.renounceRole(s.DEFAULT_ADMIN_ROLE(), address(this));
        s.renounceRole(s.UPGRADER_ROLE(), address(this));
        s.renounceRole(s.PAUSER_ROLE(), address(this));

        // ── 5. Register in the on-chain index.
        _allProperties.push(property);
        _propertiesByCreator[msg.sender].push(property);
        isProperty[property] = true;
        creatorOf[property] = msg.sender;
        propertyToShare[property] = share;
        shareToProperty[share] = property;

        emit PropertyCreated(
            property,
            share,
            msg.sender,
            params.displayName,
            params.city,
            params.propertyType,
            params.propertyValueUsd,
            block.timestamp
        );

        // ── 6. Settle the launch fee AFTER the creation so a misbehaving
        //       treasury/refund cannot re-enter mid-deployment.
        if (fee > 0) {
            (bool ok,) = treasury.call{value: fee}("");
            if (!ok) revert FeeForwardFailed();
        }
        uint256 over = msg.value - fee;
        if (over > 0) {
            (bool ok,) = payable(msg.sender).call{value: over}("");
            if (!ok) revert RefundFailed();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ADMIN
    // ─────────────────────────────────────────────────────────────────────────
    function setLaunchFee(uint256 newFee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit LaunchFeeUpdated(launchFee, newFee);
        launchFee = newFee;
    }

    function setTreasury(address payable newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newTreasury == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VIEWS
    // ─────────────────────────────────────────────────────────────────────────
    function allPropertiesLength() external view returns (uint256) {
        return _allProperties.length;
    }

    function allPropertiesPaginated(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory page)
    {
        uint256 len = _allProperties.length;
        if (offset >= len) return new address[](0);
        uint256 end = offset + limit;
        if (end > len) end = len;
        page = new address[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            page[i - offset] = _allProperties[i];
        }
    }

    function propertyAt(uint256 index) external view returns (address) {
        if (index >= _allProperties.length) revert OutOfBounds();
        return _allProperties[index];
    }

    function propertiesByCreator(address creator) external view returns (address[] memory) {
        return _propertiesByCreator[creator];
    }

    function propertiesByCreatorLength(address creator) external view returns (uint256) {
        return _propertiesByCreator[creator].length;
    }
}
