// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import {ERC20VotesUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {NoncesUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/NoncesUpgradeable.sol";

/**
 * @title  StakeholdShare
 * @custom:product Stakehold — https://stakehold.xyz
 * @notice ERC-20 "share" token for a single Stakehold property. Combines:
 *           • ERC20Votes  — on-chain vote weight checkpoints (ERC-5805)
 *           • ERC20Permit — gasless approvals (EIP-2612)
 *           • Yield accumulator — MasterChef-style pull pattern, distributes
 *                                 ETH (rent) pro-rata to every holder
 *           • AccessControl + Pausable + UUPS — role-gated ops controls and
 *                                               per-proxy upgradeability
 *
 *         One StakeholdShare proxy is deployed per property (by StakeholdFactory),
 *         paired 1:1 with a StakeholdProperty proxy that holds the governance /
 *         vesting / rebalance logic. StakeholdProperty is the only account
 *         that receives MINTER_ROLE — meaning new shares can only mint as the
 *         outcome of an approved contribution, never arbitrarily.
 *
 * ─── Why yield lives on the SHARE contract, not a separate escrow ──────────
 *  Yield settlement has to happen inside `_update()` on every mint/burn/transfer
 *  (you must credit the sender for yield earned up to their pre-transfer
 *  balance before the balance changes). Keeping yield state local avoids one
 *  external call per transfer and matches the OpenZeppelin Governor pattern
 *  where token-side concerns (balance, votes, yield) live with the token and
 *  governance-side concerns live on the Governor. Cross-contract boundary is
 *  Property → Share for `mint` and vote reads, not Share → anywhere.
 * ────────────────────────────────────────────────────────────────────────────
 */
contract StakeholdShare is
    Initializable,
    ERC20Upgradeable,
    ERC20PermitUpgradeable,
    ERC20VotesUpgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    // ─────────────────────────────────────────────────────────────────────────
    // ROLES
    // ─────────────────────────────────────────────────────────────────────────
    /// @notice Holder of UPGRADER_ROLE may swap this proxy's implementation.
    ///         On Sepolia: the property admin. In prod: a Safe + Timelock.
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    /// @notice Holder of PAUSER_ROLE may freeze share transfers for incident
    ///         response. Does NOT block tenants sending rent (see receive()).
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    /// @notice Held exclusively by the paired StakeholdProperty contract.
    ///         Only vector for new shares to exist post-init.
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // ─────────────────────────────────────────────────────────────────────────
    // CONSTANTS
    // ─────────────────────────────────────────────────────────────────────────
    /// @notice 1e18-denominated initial supply == 1,000,000 shares == "100%".
    uint256 public constant INITIAL_SHARES = 1_000_000 ether;

    /// @dev Scaling factor for yield-per-share accumulator (1e27) — enough
    ///      precision that 1 wei across 1M shares does not truncate to zero.
    uint256 private constant YIELD_PRECISION = 1e27;

    // ─────────────────────────────────────────────────────────────────────────
    // DATA TYPES
    // ─────────────────────────────────────────────────────────────────────────
    /// @notice Initializer bundle. Passed by the factory during `createProperty`.
    struct InitParams {
        string name;                  // ERC-20 name, e.g. "Stakehold: Brooklyn Heights"
        string symbol;                // ERC-20 symbol, e.g. "SHBH"
        address admin;                // DEFAULT_ADMIN + UPGRADER + PAUSER after wiring
        address minter;               // the paired StakeholdProperty proxy
        address[] initialHolders;     // founding share book
        uint256[] initialAmounts;     // must sum to INITIAL_SHARES
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STORAGE  (APPEND-ONLY — never reorder)
    // ─────────────────────────────────────────────────────────────────────────
    /// @notice Scaled yield-per-share accumulator.
    uint256 public accYieldPerShare;
    /// @notice Per-holder checkpoint of accumulator at last settlement.
    mapping(address => uint256) public yieldDebt;
    /// @notice Settled-but-unclaimed yield per holder.
    mapping(address => uint256) public pendingYield;
    /// @notice Lifetime ETH received for distribution. Only goes up.
    uint256 public totalYieldDistributed;

    /// @dev Reserve storage slots for future upgrades. Append new state ABOVE
    ///      this gap and shrink the gap by the number of new slots used.
    uint256[46] private __gap;

    // ─────────────────────────────────────────────────────────────────────────
    // EVENTS
    // ─────────────────────────────────────────────────────────────────────────
    event YieldDeposited(address indexed from, uint256 amount, uint256 newAccPerShare);
    event YieldClaimed(address indexed holder, uint256 amount);
    event MinterConfigured(address indexed minter);

    // ─────────────────────────────────────────────────────────────────────────
    // CUSTOM ERRORS
    // ─────────────────────────────────────────────────────────────────────────
    error ZeroAddress();
    error ZeroAmount();
    error ArrayLengthMismatch();
    error InvalidShares(uint256 supplied, uint256 expected);
    error NoYield();
    error EthTransferFailed();

    // ─────────────────────────────────────────────────────────────────────────
    // CONSTRUCTOR / INITIALIZER
    // ─────────────────────────────────────────────────────────────────────────
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(InitParams calldata p) external initializer {
        if (p.admin == address(0)) revert ZeroAddress();
        if (p.minter == address(0)) revert ZeroAddress();
        if (p.initialHolders.length == 0) revert ArrayLengthMismatch();
        if (p.initialHolders.length != p.initialAmounts.length) revert ArrayLengthMismatch();

        __ERC20_init(p.name, p.symbol);
        __ERC20Permit_init(p.name);
        __ERC20Votes_init();
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, p.admin);
        _grantRole(UPGRADER_ROLE, p.admin);
        _grantRole(PAUSER_ROLE, p.admin);
        _grantRole(MINTER_ROLE, p.minter);
        emit MinterConfigured(p.minter);

        uint256 sum;
        for (uint256 i; i < p.initialHolders.length; ++i) {
            address o = p.initialHolders[i];
            uint256 s = p.initialAmounts[i];
            if (o == address(0)) revert ZeroAddress();
            if (s == 0) revert ZeroAmount();
            sum += s;
            _mint(o, s);
            // ERC20Votes only counts delegated balances. Auto self-delegate
            // so founders have usable voting power immediately.
            _delegate(o, o);
        }
        if (sum != INITIAL_SHARES) revert InvalidShares(sum, INITIAL_SHARES);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ADMIN / OPS
    // ─────────────────────────────────────────────────────────────────────────
    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    // ─────────────────────────────────────────────────────────────────────────
    // MINTING (gated to StakeholdProperty)
    // ─────────────────────────────────────────────────────────────────────────
    /// @notice Mint new shares. Only callable by the paired Property contract
    ///         as the outcome of vesting claims. There is no burn path — shares
    ///         are non-redeemable in V1.
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        _mint(to, amount);
        // Auto self-delegate first-time mints so vested recipients have
        // immediate voting power without a second tx.
        if (delegates(to) == address(0)) _delegate(to, to);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // YIELD DISTRIBUTION (pull pattern)
    // ─────────────────────────────────────────────────────────────────────────
    //  On deposit:       accYieldPerShare += msg.value * 1e27 / totalSupply()
    //  On transfer/mint: _settleYield(from) and _settleYield(to) before the
    //                    balance change, then bump their debt checkpoints.
    //  On claim:         pay out whatever was settled into pendingYield.
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Deposit rental income (ETH) for distribution to all current
    ///         holders. Anyone can call — property managers, platforms, or
    ///         individual tenants. The msg.value is streamed into
    ///         `accYieldPerShare` and becomes claimable immediately.
    function distributeYield() external payable whenNotPaused nonReentrant {
        _depositYield();
    }

    /// @notice View the total ETH a holder can currently claim.
    function claimableYield(address holder) public view returns (uint256) {
        return pendingYield[holder]
            + ((balanceOf(holder) * accYieldPerShare) / YIELD_PRECISION) - yieldDebt[holder];
    }

    /// @notice Withdraw accumulated yield. Pull pattern keeps us safe from
    ///         gas-griefing receivers (each holder pays their own gas).
    function claimYield() external whenNotPaused nonReentrant {
        _settleYield(msg.sender);
        uint256 amount = pendingYield[msg.sender];
        if (amount == 0) revert NoYield();
        pendingYield[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert EthTransferFailed();
        emit YieldClaimed(msg.sender, amount);
    }

    function _depositYield() internal {
        if (msg.value == 0) revert ZeroAmount();
        uint256 supply = totalSupply();
        if (supply == 0) revert ZeroAmount();
        accYieldPerShare += (msg.value * YIELD_PRECISION) / supply;
        totalYieldDistributed += msg.value;
        emit YieldDeposited(msg.sender, msg.value, accYieldPerShare);
    }

    function _settleYield(address account) internal {
        if (account == address(0)) return;
        uint256 bal = balanceOf(account);
        uint256 gross = (bal * accYieldPerShare) / YIELD_PRECISION;
        uint256 debt = yieldDebt[account];
        if (gross > debt) pendingYield[account] += gross - debt;
        yieldDebt[account] = gross;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // OVERRIDES
    // ─────────────────────────────────────────────────────────────────────────
    /// @dev Settle yield for BOTH parties with their PRE-transfer balance,
    ///      then apply the transfer, then bump both debt checkpoints to the
    ///      current accumulator.
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20Upgradeable, ERC20VotesUpgradeable)
        whenNotPaused
    {
        _settleYield(from);
        _settleYield(to);
        super._update(from, to, value);
        if (from != address(0)) yieldDebt[from] = (balanceOf(from) * accYieldPerShare) / YIELD_PRECISION;
        if (to != address(0))   yieldDebt[to]   = (balanceOf(to)   * accYieldPerShare) / YIELD_PRECISION;
    }

    function nonces(address owner)
        public
        view
        override(ERC20PermitUpgradeable, NoncesUpgradeable)
        returns (uint256)
    {
        return super.nonces(owner);
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

    // ─────────────────────────────────────────────────────────────────────────
    // VERSION
    // ─────────────────────────────────────────────────────────────────────────
    function version() external pure virtual returns (string memory) {
        return "1.0.0";
    }

    /// @notice Accept raw ETH transfers as yield deposits (best-effort).
    ///         Deliberately NOT gated by whenNotPaused — a tenant's scheduled
    ///         rent payment should not fail just because an admin paused
    ///         share transfers for incident response.
    receive() external payable {
        _depositYield();
    }
}
