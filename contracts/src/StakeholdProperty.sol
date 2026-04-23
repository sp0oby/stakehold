// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import {StakeholdShare} from "./StakeholdShare.sol";

/**
 * @title  StakeholdProperty
 * @custom:product Stakehold — https://stakehold.xyz
 * @notice Governance + real-world bookkeeping for a single Stakehold
 *         property. Paired 1:1 with a `StakeholdShare` proxy (the token);
 *         holds `MINTER_ROLE` on Share to mint vested grants.
 *
 *         Responsibilities:
 *           • Property identity (displayName, city, propertyType, URIs, valuation)
 *           • Contributions — submit an IPFS-backed receipt + USD value
 *           • Auto-approve path — contributions below threshold bypass the vote
 *                                 but still traverse the timelock
 *           • DAO vote path — large contributions create a proposal; vote
 *                             weight is read from Share via `getPastVotes`
 *                             (ERC-5805 checkpoint at proposal snapshot)
 *           • Rebalance math — compute new share issuance with a per-event
 *                              dilution cap (MAX_REBALANCE_BPS)
 *           • Vesting — 6-month cliff on newly minted shares (cliff-only,
 *                       not linear) before they hit the holder's balance
 *           • Pause + UUPS upgrade surface
 *
 *         This contract holds NO ETH and NO share balances itself — it only
 *         *authorizes* share-minting via `share.mint(...)`. Transfers, votes,
 *         and yield all flow through the Share contract.
 */
contract StakeholdProperty is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    // ─────────────────────────────────────────────────────────────────────────
    // ROLES
    // ─────────────────────────────────────────────────────────────────────────
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ─────────────────────────────────────────────────────────────────────────
    // CONSTANTS
    // ─────────────────────────────────────────────────────────────────────────
    /// @notice Max dilution per executed contribution, in basis points.
    ///         500 = 5%. Caps a single "contribution" from diluting existing
    ///         holders beyond this ratio even if the raw math would mint more.
    uint16 public constant MAX_REBALANCE_BPS = 500;

    /// @notice Cliff-only vesting duration for shares minted by approved
    ///         contributions. Six months is a compressed analog of "one year
    ///         of sweat equity", chosen so the demo can be exercised quickly.
    uint256 public constant VESTING_CLIFF = 180 days;

    // ─────────────────────────────────────────────────────────────────────────
    // DATA TYPES
    // ─────────────────────────────────────────────────────────────────────────
    enum PropertyType { Residential, Commercial, MixedUse, Land, Other }

    enum Status {
        Pending,    // awaiting auto-settle or DAO vote
        Approved,   // approved, awaiting timelock
        Executed,   // rebalanced + vesting grant created
        Rejected,   // DAO voted no
        Cancelled   // admin cancelled (e.g. proven fraudulent)
    }

    struct Contribution {
        address contributor;
        uint256 valueUsd;      // 6-dec USD
        bytes32 proofHash;     // keccak256 of the IPFS CID string
        string descriptionURI; // e.g. "ipfs://bafy..."
        uint64 submittedAt;
        uint256 proposalId;    // 0 if auto-approved
        Status status;
    }

    struct Proposal {
        uint256 contributionId;
        uint64 snapshotBlock;
        uint64 votingDeadline;
        uint64 executableAt;   // armed after votingDeadline, callable after
        uint256 yesVotes;
        uint256 noVotes;
        bool executed;
    }

    struct VestingGrant {
        address beneficiary;
        uint256 shares;
        uint64 cliffEnd;
        bool claimed;
    }

    /// @notice Initializer bundle. Factory supplies this on deployment.
    struct InitParams {
        address share;              // paired StakeholdShare proxy
        address admin;              // DEFAULT_ADMIN + UPGRADER + PAUSER
        string displayName;         // public — e.g. "Brooklyn Heights Brownstone"
        string city;                // public — e.g. "Brooklyn, NY, USA"
        PropertyType propertyType;
        string publicMetadataURI;   // ipfs:// photos + amenities + description
        string legalDocsURI;        // ipfs:// deeds + full address (UI gates)
        uint256 propertyValueUsd;   // 6-dec USD
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STORAGE  (APPEND-ONLY — never reorder across upgrades)
    // ─────────────────────────────────────────────────────────────────────────
    /// @notice The paired Share token. Immutable after init.
    StakeholdShare public share;

    // Property metadata (public on-chain)
    string public displayName;
    string public city;
    PropertyType public propertyType;
    string public publicMetadataURI;
    string public legalDocsURI;
    uint256 public propertyValueUsd;

    // Governance parameters
    uint256 public autoApproveThresholdUsd;
    uint64 public votingPeriod;
    uint64 public timelockDelay;
    uint16 public quorumBps;

    // Counters & collections
    uint256 public nextContributionId;
    uint256 public nextProposalId;
    uint256 public nextGrantId;
    mapping(uint256 => Contribution) public contributions;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => VestingGrant) public vestingGrants;
    mapping(address => uint256[]) private _grantsOf;

    uint256[44] private __gap;

    // ─────────────────────────────────────────────────────────────────────────
    // EVENTS
    // ─────────────────────────────────────────────────────────────────────────
    event PropertyInitialized(
        address indexed share,
        string displayName,
        string city,
        PropertyType propertyType,
        string publicMetadataURI,
        string legalDocsURI,
        uint256 valueUsd
    );
    event ContributionSubmitted(
        uint256 indexed id,
        address indexed contributor,
        uint256 valueUsd,
        bytes32 proofHash,
        string descriptionURI,
        uint256 indexed proposalId
    );
    event ProposalCreated(
        uint256 indexed proposalId,
        uint256 indexed contributionId,
        uint64 snapshotBlock,
        uint64 votingDeadline
    );
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId, uint256 indexed contributionId, bool approved);
    event ContributionExecuted(
        uint256 indexed contributionId,
        address indexed contributor,
        uint256 sharesMinted,
        uint256 grantId
    );
    event SharesVested(uint256 indexed grantId, address indexed beneficiary, uint256 shares);
    event PropertyValueUpdated(uint256 oldValue, uint256 newValue);
    event GovernanceParamsUpdated(uint256 autoApprove, uint64 votingPeriod, uint64 timelock, uint16 quorum);
    event LegalDocsURIUpdated(string oldURI, string newURI);

    // ─────────────────────────────────────────────────────────────────────────
    // CUSTOM ERRORS
    // ─────────────────────────────────────────────────────────────────────────
    error ZeroAddress();
    error ZeroAmount();
    error ProofRequired();
    error ContributionNotFound();
    error ProposalNotFound();
    error AlreadyVoted();
    error VotingClosed();
    error VotingStillOpen();
    error TimelockNotElapsed();
    error AlreadyExecuted();
    error NotPending();
    error GrantNotFound();
    error NotBeneficiary();
    error CliffNotReached();
    error AlreadyClaimed();
    error InvalidParam();

    // ─────────────────────────────────────────────────────────────────────────
    // CONSTRUCTOR / INITIALIZER
    // ─────────────────────────────────────────────────────────────────────────
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(InitParams calldata p) external initializer {
        if (p.admin == address(0)) revert ZeroAddress();
        if (p.share == address(0)) revert ZeroAddress();
        if (p.propertyValueUsd == 0) revert ZeroAmount();
        if (bytes(p.displayName).length == 0) revert InvalidParam();
        if (bytes(p.city).length == 0) revert InvalidParam();

        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, p.admin);
        _grantRole(UPGRADER_ROLE, p.admin);
        _grantRole(PAUSER_ROLE, p.admin);

        share = StakeholdShare(payable(p.share));
        displayName = p.displayName;
        city = p.city;
        propertyType = p.propertyType;
        publicMetadataURI = p.publicMetadataURI;
        legalDocsURI = p.legalDocsURI;
        propertyValueUsd = p.propertyValueUsd;

        autoApproveThresholdUsd = 500 * 1e6;
        votingPeriod = 3 days;
        timelockDelay = 2 days;
        quorumBps = 2000;

        emit PropertyInitialized(
            p.share,
            p.displayName,
            p.city,
            p.propertyType,
            p.publicMetadataURI,
            p.legalDocsURI,
            p.propertyValueUsd
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ADMIN
    // ─────────────────────────────────────────────────────────────────────────
    function setGovernanceParams(
        uint256 autoApproveThresholdUsd_,
        uint64 votingPeriod_,
        uint64 timelockDelay_,
        uint16 quorumBps_
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (votingPeriod_ < 1 hours || votingPeriod_ > 30 days) revert InvalidParam();
        if (timelockDelay_ > 30 days) revert InvalidParam();
        if (quorumBps_ == 0 || quorumBps_ > 10_000) revert InvalidParam();

        autoApproveThresholdUsd = autoApproveThresholdUsd_;
        votingPeriod = votingPeriod_;
        timelockDelay = timelockDelay_;
        quorumBps = quorumBps_;

        emit GovernanceParamsUpdated(autoApproveThresholdUsd_, votingPeriod_, timelockDelay_, quorumBps_);
    }

    /// @notice Admin can rotate the legal-docs pointer (e.g. deeds re-filed,
    ///         insurance bundle refreshed). Display name + public metadata
    ///         are intentionally immutable — they're what investors saw when
    ///         they joined.
    function setLegalDocsURI(string calldata newURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit LegalDocsURIUpdated(legalDocsURI, newURI);
        legalDocsURI = newURI;
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    function cancelContribution(uint256 id) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Contribution storage c = contributions[id];
        if (c.contributor == address(0)) revert ContributionNotFound();
        if (c.status != Status.Pending && c.status != Status.Approved) revert NotPending();
        c.status = Status.Cancelled;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CONTRIBUTIONS
    // ─────────────────────────────────────────────────────────────────────────
    function submitContribution(
        uint256 valueUsd,
        bytes32 proofHash,
        string calldata descriptionURI
    ) external whenNotPaused returns (uint256 id, uint256 proposalId) {
        if (valueUsd == 0) revert ZeroAmount();
        if (proofHash == bytes32(0)) revert ProofRequired();

        id = ++nextContributionId;
        Contribution storage c = contributions[id];
        c.contributor = msg.sender;
        c.valueUsd = valueUsd;
        c.proofHash = proofHash;
        c.descriptionURI = descriptionURI;
        c.submittedAt = uint64(block.timestamp);

        if (valueUsd <= autoApproveThresholdUsd) {
            c.status = Status.Approved;
            c.proposalId = 0;
            emit ContributionSubmitted(id, msg.sender, valueUsd, proofHash, descriptionURI, 0);
        } else {
            proposalId = ++nextProposalId;
            Proposal storage p = proposals[proposalId];
            p.contributionId = id;
            uint48 clk = share.clock();
            uint48 snap = clk == 0 ? 0 : clk - 1;
            p.snapshotBlock = uint64(snap);
            p.votingDeadline = uint64(block.timestamp + votingPeriod);
            c.status = Status.Pending;
            c.proposalId = proposalId;
            emit ContributionSubmitted(id, msg.sender, valueUsd, proofHash, descriptionURI, proposalId);
            emit ProposalCreated(proposalId, id, p.snapshotBlock, p.votingDeadline);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VOTING
    // ─────────────────────────────────────────────────────────────────────────
    function voteOnProposal(uint256 proposalId, bool support) external whenNotPaused {
        Proposal storage p = proposals[proposalId];
        if (p.contributionId == 0) revert ProposalNotFound();
        if (block.timestamp > p.votingDeadline) revert VotingClosed();
        if (hasVoted[proposalId][msg.sender]) revert AlreadyVoted();

        uint256 weight = share.getPastVotes(msg.sender, p.snapshotBlock);
        if (weight == 0) revert ZeroAmount();

        hasVoted[proposalId][msg.sender] = true;
        if (support) p.yesVotes += weight; else p.noVotes += weight;

        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    /// @notice Finalize a proposal after voting closes. Permissionless.
    ///         First call after `votingDeadline` arms the timelock; subsequent
    ///         calls complete the execution once `executableAt` is reached.
    function executeProposal(uint256 proposalId) external whenNotPaused nonReentrant {
        Proposal storage p = proposals[proposalId];
        if (p.contributionId == 0) revert ProposalNotFound();
        if (p.executed) revert AlreadyExecuted();
        if (block.timestamp <= p.votingDeadline) revert VotingStillOpen();

        if (p.executableAt == 0) {
            p.executableAt = uint64(block.timestamp + timelockDelay);
            emit ProposalExecuted(proposalId, p.contributionId, false);
            return;
        }
        if (block.timestamp < p.executableAt) revert TimelockNotElapsed();

        p.executed = true;

        uint256 totalVotes = p.yesVotes + p.noVotes;
        uint256 supplyAtSnapshot = share.getPastTotalSupply(p.snapshotBlock);
        bool quorumMet = supplyAtSnapshot > 0 && totalVotes * 10_000 >= supplyAtSnapshot * quorumBps;
        bool approved = quorumMet && p.yesVotes > p.noVotes;

        Contribution storage c = contributions[p.contributionId];
        if (approved) {
            c.status = Status.Approved;
            _executeContribution(p.contributionId);
        } else {
            c.status = Status.Rejected;
        }
        emit ProposalExecuted(proposalId, p.contributionId, approved);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REBALANCE
    // ─────────────────────────────────────────────────────────────────────────
    function executeAutoApproved(uint256 contributionId) external whenNotPaused nonReentrant {
        Contribution storage c = contributions[contributionId];
        if (c.contributor == address(0)) revert ContributionNotFound();
        if (c.status != Status.Approved || c.proposalId != 0) revert NotPending();
        if (block.timestamp < c.submittedAt + timelockDelay) revert TimelockNotElapsed();
        _executeContribution(contributionId);
    }

    /// @notice Read-only: preview how many shares would mint for a contribution.
    function previewRebalance(uint256 contributionId)
        external
        view
        returns (uint256 sharesToMint, uint256 newTotalSupply, uint256 newPropertyValueUsd)
    {
        Contribution memory c = contributions[contributionId];
        if (c.contributor == address(0)) revert ContributionNotFound();
        (sharesToMint, newTotalSupply, newPropertyValueUsd) = _computeRebalance(c.valueUsd);
    }

    function _computeRebalance(uint256 valueUsd)
        internal
        view
        returns (uint256 sharesToMint, uint256 newTotalSupply, uint256 newPropertyValueUsd)
    {
        uint256 supply = share.totalSupply();
        // sharesToMint / (supply + sharesToMint) = valueUsd / (propertyValueUsd + valueUsd)
        // => sharesToMint = supply * valueUsd / propertyValueUsd
        // (multiply first to avoid precision loss)
        uint256 raw = (supply * valueUsd) / propertyValueUsd;
        uint256 cap = (supply * MAX_REBALANCE_BPS) / 10_000;
        sharesToMint = raw > cap ? cap : raw;
        newTotalSupply = supply + sharesToMint;
        newPropertyValueUsd = propertyValueUsd + valueUsd;
    }

    function _executeContribution(uint256 contributionId) internal {
        Contribution storage c = contributions[contributionId];
        if (c.status != Status.Approved) revert NotPending();

        (uint256 sharesToMint,, uint256 newValue) = _computeRebalance(c.valueUsd);

        uint256 oldValue = propertyValueUsd;
        propertyValueUsd = newValue;
        emit PropertyValueUpdated(oldValue, newValue);

        c.status = Status.Executed;

        uint256 grantId = ++nextGrantId;
        vestingGrants[grantId] = VestingGrant({
            beneficiary: c.contributor,
            shares: sharesToMint,
            cliffEnd: uint64(block.timestamp + VESTING_CLIFF),
            claimed: false
        });
        _grantsOf[c.contributor].push(grantId);

        emit ContributionExecuted(contributionId, c.contributor, sharesToMint, grantId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VESTING
    // ─────────────────────────────────────────────────────────────────────────
    /// @notice Claim a vesting grant after its cliff. Mints shares on Share
    ///         via the MINTER_ROLE this contract holds.
    function claimVestedShares(uint256 grantId) external whenNotPaused nonReentrant {
        VestingGrant storage g = vestingGrants[grantId];
        if (g.beneficiary == address(0)) revert GrantNotFound();
        if (g.beneficiary != msg.sender) revert NotBeneficiary();
        if (g.claimed) revert AlreadyClaimed();
        if (block.timestamp < g.cliffEnd) revert CliffNotReached();

        g.claimed = true;
        share.mint(g.beneficiary, g.shares);
        emit SharesVested(grantId, g.beneficiary, g.shares);
    }

    function grantsOf(address user) external view returns (uint256[] memory) {
        return _grantsOf[user];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UPGRADE AUTHORIZATION
    // ─────────────────────────────────────────────────────────────────────────
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {
        if (newImplementation == address(0)) revert ZeroAddress();
    }

    function version() external pure virtual returns (string memory) {
        return "1.0.0";
    }
}
