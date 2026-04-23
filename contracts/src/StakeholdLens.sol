// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {StakeholdFactory} from "./StakeholdFactory.sol";
import {StakeholdProperty} from "./StakeholdProperty.sol";
import {StakeholdShare} from "./StakeholdShare.sol";

/**
 * @title  StakeholdLens
 * @custom:product Stakehold — https://stakehold.xyz
 * @notice Read-only aggregator that batches multiple reads into one RPC call,
 *         so the frontend's dashboards don't need to fan out into dozens of
 *         separate eth_call round-trips.
 *
 *         This contract holds NO state and NEVER writes. It can be
 *         redeployed or replaced without affecting the core protocol;
 *         existing reads continue to work because all data lives on
 *         Factory / Property / Share.
 *
 *         Inspired by Compound's `CompoundLens` and Uniswap's `Quoter`
 *         pattern. If a view needs to change for the UI, update the Lens —
 *         the core stays stable.
 */
contract StakeholdLens {
    StakeholdFactory public immutable factory;

    constructor(address factory_) {
        factory = StakeholdFactory(factory_);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VIEW TYPES
    // ─────────────────────────────────────────────────────────────────────────
    struct PropertyCard {
        address property;
        address share;
        address creator;
        string displayName;
        string city;
        StakeholdProperty.PropertyType propertyType;
        string publicMetadataURI;
        uint256 propertyValueUsd;
        uint256 totalShares;
        string tokenName;
        string tokenSymbol;
        uint256 totalYieldDistributed;
        bool paused;
    }

    struct PropertyDetail {
        // Identity + economics (super-set of PropertyCard)
        address property;
        address share;
        address creator;
        string displayName;
        string city;
        StakeholdProperty.PropertyType propertyType;
        string publicMetadataURI;
        string legalDocsURI;         // honored client-side; see note
        uint256 propertyValueUsd;
        uint256 totalShares;
        string tokenName;
        string tokenSymbol;
        string version;

        // Governance parameters
        uint256 autoApproveThresholdUsd;
        uint64 votingPeriod;
        uint64 timelockDelay;
        uint16 quorumBps;

        // Counters
        uint256 nextContributionId;
        uint256 nextProposalId;
        uint256 nextGrantId;

        // Yield
        uint256 totalYieldDistributed;
        uint256 accYieldPerShare;

        // Flags
        bool paused;
    }

    struct UserPropertyPosition {
        address property;
        address share;
        uint256 shareBalance;
        uint256 votingPower;
        uint256 claimableYield;
        uint256[] grantIds;
        bool isShareholder;          // balance > 0
    }

    struct Grant {
        uint256 grantId;
        address beneficiary;
        uint256 shares;
        uint64 cliffEnd;
        bool claimed;
        bool claimable;              // cliffEnd reached && !claimed
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PROPERTY CARDS (for landing + /properties grid)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Compact card data for a page of properties. Intended for
    ///         rendering property tiles / grids where `legalDocsURI` is NOT
    ///         displayed regardless of viewer (public list view).
    function getPropertyCards(uint256 offset, uint256 limit)
        external
        view
        returns (PropertyCard[] memory cards)
    {
        address[] memory properties = factory.allPropertiesPaginated(offset, limit);
        cards = new PropertyCard[](properties.length);
        for (uint256 i; i < properties.length; ++i) {
            cards[i] = _toCard(properties[i]);
        }
    }

    function getPropertyCard(address property) external view returns (PropertyCard memory) {
        return _toCard(property);
    }

    function _toCard(address propertyAddr) internal view returns (PropertyCard memory c) {
        StakeholdProperty prop = StakeholdProperty(propertyAddr);
        address shareAddr = address(prop.share());
        StakeholdShare sh = StakeholdShare(payable(shareAddr));

        c.property = propertyAddr;
        c.share = shareAddr;
        c.creator = factory.creatorOf(propertyAddr);
        c.displayName = prop.displayName();
        c.city = prop.city();
        c.propertyType = prop.propertyType();
        c.publicMetadataURI = prop.publicMetadataURI();
        c.propertyValueUsd = prop.propertyValueUsd();
        c.totalShares = sh.totalSupply();
        c.tokenName = sh.name();
        c.tokenSymbol = sh.symbol();
        c.totalYieldDistributed = sh.totalYieldDistributed();
        c.paused = prop.paused() || sh.paused();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PROPERTY DETAIL (for /p/[address] dashboards)
    // ─────────────────────────────────────────────────────────────────────────

    function getPropertyDetail(address propertyAddr)
        external
        view
        returns (PropertyDetail memory d)
    {
        StakeholdProperty prop = StakeholdProperty(propertyAddr);
        address shareAddr = address(prop.share());
        StakeholdShare sh = StakeholdShare(payable(shareAddr));

        d.property = propertyAddr;
        d.share = shareAddr;
        d.creator = factory.creatorOf(propertyAddr);
        d.displayName = prop.displayName();
        d.city = prop.city();
        d.propertyType = prop.propertyType();
        d.publicMetadataURI = prop.publicMetadataURI();
        d.legalDocsURI = prop.legalDocsURI();
        d.propertyValueUsd = prop.propertyValueUsd();
        d.totalShares = sh.totalSupply();
        d.tokenName = sh.name();
        d.tokenSymbol = sh.symbol();
        d.version = prop.version();

        d.autoApproveThresholdUsd = prop.autoApproveThresholdUsd();
        d.votingPeriod = prop.votingPeriod();
        d.timelockDelay = prop.timelockDelay();
        d.quorumBps = prop.quorumBps();

        d.nextContributionId = prop.nextContributionId();
        d.nextProposalId = prop.nextProposalId();
        d.nextGrantId = prop.nextGrantId();

        d.totalYieldDistributed = sh.totalYieldDistributed();
        d.accYieldPerShare = sh.accYieldPerShare();

        d.paused = prop.paused() || sh.paused();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // USER POSITION (for wallet-scoped dashboards)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice All properties a user is involved in plus their position data.
    ///         Scans the first `limit` properties from `offset` — paginate on
    ///         the client for large registries.
    function getUserPositions(address user, uint256 offset, uint256 limit)
        external
        view
        returns (UserPropertyPosition[] memory positions)
    {
        address[] memory properties = factory.allPropertiesPaginated(offset, limit);
        positions = new UserPropertyPosition[](properties.length);
        for (uint256 i; i < properties.length; ++i) {
            positions[i] = _toUserPosition(properties[i], user);
        }
    }

    function getUserPosition(address propertyAddr, address user)
        external
        view
        returns (UserPropertyPosition memory)
    {
        return _toUserPosition(propertyAddr, user);
    }

    function _toUserPosition(address propertyAddr, address user)
        internal
        view
        returns (UserPropertyPosition memory p)
    {
        StakeholdProperty prop = StakeholdProperty(propertyAddr);
        StakeholdShare sh = StakeholdShare(payable(address(prop.share())));

        p.property = propertyAddr;
        p.share = address(sh);
        p.shareBalance = sh.balanceOf(user);
        p.votingPower = sh.getVotes(user);
        p.claimableYield = sh.claimableYield(user);
        p.grantIds = prop.grantsOf(user);
        p.isShareholder = p.shareBalance > 0;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GRANTS (vesting breakdown)
    // ─────────────────────────────────────────────────────────────────────────

    function getUserGrants(address propertyAddr, address user)
        external
        view
        returns (Grant[] memory grants)
    {
        StakeholdProperty prop = StakeholdProperty(propertyAddr);
        uint256[] memory ids = prop.grantsOf(user);
        grants = new Grant[](ids.length);
        for (uint256 i; i < ids.length; ++i) {
            (address beneficiary, uint256 shares, uint64 cliffEnd, bool claimed) =
                prop.vestingGrants(ids[i]);
            grants[i] = Grant({
                grantId: ids[i],
                beneficiary: beneficiary,
                shares: shares,
                cliffEnd: cliffEnd,
                claimed: claimed,
                claimable: !claimed && block.timestamp >= cliffEnd
            });
        }
    }
}
