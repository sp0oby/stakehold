<div align="center">

# Stakehold

**Own the work. Not just the walls.**

A protocol for dynamic real-estate co-ownership. Cap tables rebalance as co-owners contribute real work — maintenance, upgrades, taxes, capital. Ownership tracks reality, not just day-one capital.

[![Network](https://img.shields.io/badge/network-Sepolia-14b87a?style=flat-square)](https://sepolia.etherscan.io/)
[![Solidity](https://img.shields.io/badge/solidity-0.8.24-363636?style=flat-square)](https://soliditylang.org/)
[![Foundry](https://img.shields.io/badge/built%20with-Foundry-ff7a00?style=flat-square)](https://book.getfoundry.sh/)
[![Next.js](https://img.shields.io/badge/frontend-Next.js%2014-000000?style=flat-square)](https://nextjs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](./LICENSE)

[Live app](https://stakehold.vercel.app) · [Architecture](#architecture) · [Live addresses](#live-addresses) · [Run it locally](#local-development) · [Mainnet readiness](#mainnet-readiness-checklist) · [Security](./SECURITY.md) · [Legal](./LEGAL.md)

</div>

---

## What is Stakehold?

Traditional fractional real estate freezes the cap table on day one. The person who wrote the biggest check owns the most, forever — even if they never lift a finger afterwards.

**Stakehold takes the opposite approach.** For every property, contributions — capital, renovations, maintenance, taxes — are submitted on-chain with IPFS proof, voted on by shareholders, and rebalance the cap table when executed. Rental income is paid pro-rata in ETH via a pull-pattern accumulator.

Stakehold is a **platform**, not a single property. Anyone can launch a property through the `StakeholdFactory`, which atomically deploys a paired Share token + Property governor with all permissions wired correctly.

## Where does ETH come from?

Three honest answers — the protocol never prints ETH.

1. **The factory launch fee** — a flat-ETH `createProperty` payment to
   `StakeholdFactory` (treasury / protocol operator). It pays for deployment
   gas and compensates the platform; it is **not** rent.

2. **Rental & pass-through yield** — ETH enters each property at the
   **`StakeholdShare`** contract, never at `StakeholdProperty`. Call
   `distributeYield{value: x}` (or a plain transfer — both hit the
   `receive()` hook) to stream the deposit pro-rata into the pull-pattern
   accumulator. Shareholders `claimYield()` to withdraw. This is
   indistinguishable from a fully automated on-chain system once someone has
   already converted off-chain rent to ETH. That conversion is the **fiat
   rail** — today it's a human with a bank account, tomorrow a Bridge.xyz /
   Circle / Stripe Crypto integration, but it is *always* outside the smart
   contracts.

3. **Not contributions** — a capital contribution (invoice + IPFS hash) is an
   off-chain *expense* that mints *equity* (shares) after a vote, not a
   deposit of ETH. The co-owner already sent dollars to a contractor; the
   on-chain system records the *claim*, not the wire transfer.

**Bottom line for recruiters:** the contracts solve governance math, cap-table
dynamics, upgrade safety, and O(1) pull-yield. They deliberately do **not**
solve ACH → ETH — that is operational plumbing every tokenized-RE product
(RealT, Lofty, Roofstock) still runs through a licensed treasurer. The
frontend exposes a *production-shaped* rent deposit flow that calls
`distributeYield` so you can demonstrate the full loop on Sepolia with test
ETH.

## Why it's interesting

- **Four-contract architecture** — Factory launches properties; each property is a `Share` (ERC20Votes + yield) + `Property` (governor + vesting) pair, with a stateless `Lens` aggregator for read-heavy frontends. Independent upgrade surfaces, least-authority wiring.
- **Dynamic cap table** — Shares mint to contributors post-vote, capped at 5% per execution (`MAX_REBALANCE_BPS`) to prevent silent takeovers.
- **Real governance, not theatre** — `ERC20Votes` snapshots voting power at proposal creation so late-stage share purchases can't swing votes. Small contributions auto-approve after a timelock; large ones hit quorum.
- **Six-month vesting cliff** — Newly minted shares are locked behind a vesting grant. Discourages one-shot dilution attacks and rewards long-term co-owners.
- **Pull-based yield** — Rental income flows in as ETH; each holder claims independently via a MasterChef-style `accYieldPerShare` accumulator. O(1) deposits regardless of shareholder count. Yield settles inside `_update`, so transfers always leave both parties made whole.
- **Privacy by design** — Public city / region on-chain; full street address, deeds, and insurance live at `legalDocsURI` and are only surfaced in the UI to verified shareholders.
- **UUPS-upgradeable, safely** — Share and Property proxies upgrade independently. The Factory and Lens are intentionally **non-upgradeable** so launchers always know what they're getting.
- **Permissionless by default** — Launching a property, submitting contributions, executing proposals, distributing yield, claiming yield — every path is permissionless. No keeper, no cron.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        StakeholdFactory  (non-upgradeable)           │
│  createProperty(fee) ─▶ deploys Share proxy + Property proxy         │
│                         wires roles, renounces self, emits event     │
└──────────────┬────────────────────────────────────┬──────────────────┘
               │ deploys                            │ deploys
               ▼                                    ▼
┌──────────────────────────┐              ┌───────────────────────────┐
│   StakeholdShare (UUPS)  │◀────mints────│  StakeholdProperty (UUPS) │
│   ERC20 + Votes + Permit │  shares to   │  contributions, proposals,│
│   ETH yield accumulator  │  beneficiary │  vesting, rebalance math  │
│   _update settles yield  │              │  timelock + quorum        │
└──────────────▲───────────┘              └─────────────┬─────────────┘
               │                                        │
               │  getPropertyCard  ┌───────────────┐    │  getPropertyDetail
               └───────────────────│ StakeholdLens │◀───┘  getUserPosition
                                   │ (stateless)   │       getUserGrants
                                   └───────┬───────┘
                                           │ single-call reads
                                           ▼
                                 ┌──────────────────┐
                                 │   Frontend (UI)  │
                                 └──────────────────┘
```

Each property is fully **isolated**: its own Share token, its own cap table, its own governance parameters, its own treasury balance. The Factory is the only shared global; the Lens is just a read helper with no state.

## Live addresses

| Contract | Address |
|---|---|
| **Factory** (launch new properties) | [`0x2d4C7Ae731bD1c360E3f7bCBDB88CaeB1BA5f7Bf`](https://sepolia.etherscan.io/address/0x2d4C7Ae731bD1c360E3f7bCBDB88CaeB1BA5f7Bf#code) |
| **Lens** (read aggregator) | [`0xEE4F179eB8d1fc460012CA6782860c611995d86a`](https://sepolia.etherscan.io/address/0xEE4F179eB8d1fc460012CA6782860c611995d86a#code) |
| **Share implementation** (UUPS logic) | [`0xfb7b468780F3396b1De427aB543237303B58fe3d`](https://sepolia.etherscan.io/address/0xfb7b468780F3396b1De427aB543237303B58fe3d#code) |
| **Property implementation** (UUPS logic) | [`0x5951569685Cbf13CA5A6F797d2E3b10186994645`](https://sepolia.etherscan.io/address/0x5951569685Cbf13CA5A6F797d2E3b10186994645#code) |
| **Genesis property** (proxy) | [`0x6bAc6Ca15D70a0D1FCB5347Df3B3b2b99367BA80`](https://sepolia.etherscan.io/address/0x6bAc6Ca15D70a0D1FCB5347Df3B3b2b99367BA80#code) |
| **Genesis share token** (proxy) | [`0xDfd0764136f900b33cbDe0548BE5AE8C66c8edaF`](https://sepolia.etherscan.io/address/0xDfd0764136f900b33cbDe0548BE5AE8C66c8edaF#code) |
| **Deployer / treasury** | [`0xc7f16B436594ef356751C0094F5542162f040223`](https://sepolia.etherscan.io/address/0xc7f16B436594ef356751C0094F5542162f040223) |

- Network: **Sepolia** (chainId `11155111`)
- Deploy block: [`10713323`](https://sepolia.etherscan.io/block/10713323)
- Launch fee: `0.001 ETH` (configurable by factory admin)
- Genesis property: *Stakehold Genesis* (London, UK) · token `SHG` · initial supply 1,000,000
- All six contracts verified on [Sepolia Etherscan](https://sepolia.etherscan.io/)

## Flow — what happens when someone launches a property

1. **Launcher** calls `factory.createProperty{value: fee}(params)` with metadata (name, city, type, token name/symbol, supply, initial holders, IPFS URIs).
2. **Factory** deploys `ERC1967Proxy(shareImpl)` and `ERC1967Proxy(propertyImpl)` back-to-back, initializing both.
3. **Factory** grants `MINTER_ROLE` on the new Share to the new Property, then **renounces** every temporary role it held. Net result: the Property is the *only* minter of its Share; the Factory is a no-op from that point on.
4. **Factory** registers the pair and forwards the launch fee to the treasury. Overpayment is refunded.
5. **Launcher** receives the initial supply and becomes the property admin (`DEFAULT_ADMIN_ROLE`, `PAUSER_ROLE`, `UPGRADER_ROLE` on both proxies).

## Flow — what happens when someone contributes

```
submitContribution(valueUsd, proofHash, descriptionURI)
                │
                ▼
      valueUsd ≤ threshold ?
          │           │
       yes │           │ no
          │           │
          ▼           ▼
 auto-approved  createProposal() on StakeholdProperty
 (timelock)     vote window + quorum + timelock
          │           │
          ▼           ▼
  executeAutoApproved(id)   executeProposal(id)
                │
                ▼
        rebalance math (capped 5%)
                │
                ▼
        createVestingGrant() — 6-month cliff
                │
                ▼
        claimVestedShares(grantId)
                │
                ▼
        share.mint() — auto self-delegate

─── parallel: rental income ───
anyone → share.distributeYield{value: ethAmt}() → accYieldPerShare += amt * 1e18 / supply
holder → share.claimYield()                     → ETH transfer
```

## Tech stack

**Contracts** — Solidity 0.8.24 · OpenZeppelin Upgradeable v5 · Foundry · UUPS (EIP-1822) · ERC-1967 proxies · ERC-20 Votes + Permit
**Frontend** — Next.js 14 App Router · TypeScript · Tailwind CSS · viem 2 · wagmi 2 · RainbowKit 2 · Chart.js · react-dropzone · sonner
**Infra** — Vercel (frontend) · Filebase (IPFS pinning, 5 GB free tier) · Etherscan (verification)

The IPFS layer is provider-agnostic: contracts only store content-addressed hashes, so swapping pinning providers — Filebase, Pinata, 4EVERLAND, a self-hosted IPFS node — requires zero redeployment. The current default is Filebase, accessed through an IPFS-compatible RPC endpoint proxied by a Next.js API route so the access token never reaches the browser.

### Why split the contract?

An earlier monolith ran into the EIP-170 24,576-byte limit as features stacked up. Rather than hack the compiler, the logic was factored into:

| Contract | Responsibility | Upgradeable? |
|---|---|---|
| `StakeholdFactory` | Property launchpad + registry + fee sink | No — intentional |
| `StakeholdShare` | ERC20 Votes + Permit + yield accumulator | Yes (UUPS) |
| `StakeholdProperty` | Contributions, DAO, vesting, metadata | Yes (UUPS) |
| `StakeholdLens` | Read aggregator for the UI | No — stateless |

Benefits: clean separation of concerns, independent upgrade paths, minimal factory attack surface, trivial read ergonomics for the frontend.

## Security posture

| Concern | Mitigation |
|---|---|
| Reentrancy | `nonReentrant` guards + CEI on every ETH transfer |
| Dilution attacks | `MAX_REBALANCE_BPS = 500` (5%) per execution, 6-month cliff on minted shares |
| Flash-governance | `ERC20Votes` snapshots voting power at proposal creation |
| Storage collisions | `uint256[50] __gap` on every upgradeable implementation |
| Locked yield | Yield claims are **not** pausable; pause halts governance and transfers, never exits |
| Admin takeover | `UPGRADER_ROLE` separate from `DEFAULT_ADMIN_ROLE`; production wants multisig + timelock |
| Unauthorized upgrades | `_authorizeUpgrade` reverts without `UPGRADER_ROLE` |
| Unauthorized mints | `MINTER_ROLE` on Share is held *only* by its paired Property; Factory renounces after wiring |
| Cross-property contamination | Every property has its own Share/Property proxy pair — no shared state |

**Stakehold is unaudited.** Sepolia testnet only. Do not use with real funds.

## Test coverage

```bash
cd contracts
forge test --summary
```

**74 tests** across unit, fuzz, invariant, and upgrade-roundtrip:

- `StakeholdShare.t.sol` — auto-delegation, mint gating, yield math, transfer-triggered settlement
- `StakeholdProperty.t.sol` — contribution flow, auto-approve, DAO vote, rebalance math, vesting, governance params
- `StakeholdFactory.t.sol` — constructor validation, fee forwarding, refunds, multi-property isolation
- `StakeholdLens.t.sol` — every view function across shareholder and non-shareholder cases
- `Invariant.t.sol` — stateful fuzzing asserts:
  - `sum(balanceOf) == totalSupply` after any sequence of actions
  - `address(share).balance >= sum(pending yield)`
  - `totalSupply` only grows or holds
- `Upgrade.t.sol` — upgrade Share and Property independently, verify state preservation + role gating

## Local development

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) — `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- Node **20+**
- A Sepolia RPC URL
- A [WalletConnect project ID](https://cloud.walletconnect.com/)
- A [Filebase IPFS access token](https://console.filebase.com/) (free tier, 5 GB)

### 1. Contracts

```bash
cd contracts
cp .env.example .env        # SEPOLIA_RPC_URL, PRIVATE_KEY, ETHERSCAN_API_KEY
forge build
forge test -vv
```

### 2. Deploy the stack to Sepolia

```bash
set -a; source .env; set +a

forge script script/DeployFactory.s.sol:DeployFactory \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  -vvvv
```

This deploys the Share implementation, Property implementation, Factory, Lens, and one Genesis property in a single broadcast. Customize the genesis property with env vars:

```bash
GENESIS_DISPLAY_NAME="Brooklyn Brownstone" \
GENESIS_CITY="Brooklyn, NY"                \
GENESIS_TOKEN_SYMBOL="BKB"                 \
GENESIS_VALUE_USD=1500000000000            \
LAUNCH_FEE_WEI=1000000000000000            \
forge script script/DeployFactory.s.sol:DeployFactory …
```

Addresses are written to `contracts/deployments/latest.json`.

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# paste factory + lens addresses into NEXT_PUBLIC_FACTORY_ADDRESS / NEXT_PUBLIC_LENS_ADDRESS
npm run dev
```

Visit `http://localhost:3000`, connect a Sepolia-funded wallet, browse an existing property, or launch your own.

## Upgrading

```bash
# Upgrade the Share implementation for a given proxy
PROXY_ADDRESS=0xShareProxy   \
PROXY_KIND=share             \
forge script script/Upgrade.s.sol:Upgrade --rpc-url $SEPOLIA_RPC_URL --broadcast --verify -vvvv

# Upgrade the Property implementation
PROXY_ADDRESS=0xPropertyProxy \
PROXY_KIND=property           \
forge script script/Upgrade.s.sol:Upgrade --rpc-url $SEPOLIA_RPC_URL --broadcast --verify -vvvv
```

Each proxy upgrades independently. The Factory and Lens are immutable by design — to change their behaviour, deploy a new one and point the UI at it.

## Repository layout

```
adaptive-coownership/
├── contracts/                       Foundry project
│   ├── src/
│   │   ├── StakeholdFactory.sol        Launchpad + registry + fee sink
│   │   ├── StakeholdShare.sol          ERC20Votes + Permit + yield accumulator
│   │   ├── StakeholdProperty.sol       Governance + vesting + metadata
│   │   └── StakeholdLens.sol           Read aggregator for the UI
│   ├── test/
│   │   ├── Base.t.sol                  Shared harness
│   │   ├── StakeholdShare.t.sol
│   │   ├── StakeholdProperty.t.sol
│   │   ├── StakeholdFactory.t.sol
│   │   ├── StakeholdLens.t.sol
│   │   ├── Invariant.t.sol
│   │   └── Upgrade.t.sol
│   ├── script/
│   │   ├── DeployFactory.s.sol         Canonical deployment
│   │   └── Upgrade.s.sol               UUPS upgrade (Share | Property)
│   └── foundry.toml
│
└── frontend/                        Next.js 14 App Router + TS + Tailwind
    ├── app/
    │   ├── page.tsx                    Home — hero + featured + list
    │   ├── properties/                 Browse every property
    │   ├── launch/                     Launch a new property via factory
    │   ├── portfolio/                  Your holdings across properties
    │   ├── p/[address]/                Per-property dashboard + subroutes
    │   │   ├── page.tsx                  Overview (stats, ownership, activity)
    │   │   ├── contribute/               IPFS upload → submitContribution
    │   │   ├── proposals/                Vote + execute
    │   │   ├── yield/                    Claim / deposit ETH
    │   │   └── rebalance/                Vesting grants + preview
    │   ├── about/                      User-facing docs, guides, FAQ
    │   └── api/ipfs/route.ts           Filebase proxy (token stays on server)
    ├── components/                     Logo · Header · PropertyCard · TxButton …
    ├── hooks/                          useProperty · useProperties · useUserPosition …
    └── lib/
        ├── abis/                       Auto-generated TS ABIs (share, property, factory, lens)
        ├── contracts.ts                Address wiring + typed configs
        ├── wagmi.ts                    wagmi config (Sepolia)
        ├── ipfs.ts                     Gateway helper (provider-agnostic)
        └── format.ts                   Number, USD, ETH, duration formatters
```

## Roadmap

- [x] Factory-based multi-property launchpad
- [x] Per-property isolated Share + Property proxies
- [x] Privacy-aware metadata (public city, gated legal docs)
- [x] Read aggregator (Lens) for frontend efficiency
- [x] Provider-agnostic IPFS pinning (Filebase today, zero-migration swap)
- [x] In-app admin console (rotate legal docs, pause, governance params, role grants)
- [x] In-app shareholder actions (transfer shares, delegate votes)
- [ ] Subgraph / Ponder indexer for historical analytics at scale
- [ ] Secondary market for share transfers (AMM pool per property)
- [ ] On-chain valuation oracle (currently admin-submitted)
- [ ] Timelock + Safe multisig for `UPGRADER_ROLE` on mainnet
- [ ] Full security audit before mainnet

## Mainnet readiness checklist

Stakehold is deployed to **Sepolia only**. The gap between "works on Sepolia"
and "can hold real capital on mainnet" is non-trivial; the checklist below is
the real list we'd burn down before any mainnet deployment. Items marked ✅
are in place today; items marked ◻ are deliberate follow-ups.

**Contracts**

- ✅ UUPS proxies with `_authorizeUpgrade` role-gated
- ✅ Reentrancy guards + checks-effects-interactions on every ETH path
- ✅ `__gap` reserved on every upgradeable implementation
- ✅ Pausable without locking users out of earned yield
- ✅ 74+ unit / fuzz / invariant / upgrade-roundtrip tests
- ◻ External audit (Trail of Bits, Spearbit, OpenZeppelin, etc.)
- ◻ Formal verification of critical invariants (balances ≤ supply, ETH ≥ pending yield)
- ◻ Immunefi bug bounty funded before launch

**Governance & access control**

- ✅ Separate `DEFAULT_ADMIN_ROLE`, `PAUSER_ROLE`, `UPGRADER_ROLE`
- ✅ Factory renounces all roles atomically after launch
- ✅ In-app role-grant UI to hand control to a multisig without Etherscan calls
- ◻ Safe multisig (3-of-5 minimum) as admin on every launched property
- ◻ OpenZeppelin `TimelockController` in front of `UPGRADER_ROLE` (48h minimum)
- ◻ Renounce launcher EOA after verified multisig handoff

**Valuations & oracles**

- ◻ Chainlink (or equivalent) price feed for ETH/USD conversions at yield deposit
- ◻ Attested valuation oracle for `propertyValueUsd` (signed by ≥ 2 independent appraisers; current field is admin-settable)
- ◻ Circuit breaker on rebalance math if valuation changes more than *N*% per epoch

**Monitoring & ops**

- ◻ OpenZeppelin Defender sentinels for: paused state changes, role grants, proposal executions, large yield deposits, upgrade calls
- ◻ Tenderly alerts on revert spikes + gas anomalies
- ◻ On-call runbook (who flips the pause, who signs multisig, who rotates keys)
- ◻ Subgraph + analytics so shareholders can audit rebalance math historically

**Frontend / off-chain**

- ✅ Server-side IPFS proxy keeps pinning credentials off the browser
- ✅ Provider-agnostic gateway selection
- ✅ Graceful rendering when metadata URIs are missing or malformed
- ◻ Second pinning provider + automatic failover
- ◻ CSP, subresource integrity, and rate-limited `/api/ipfs`
- ◻ Replace WalletConnect v2 with SIWE session management for admin paths

**Legal & regulatory** — full treatment in [`LEGAL.md`](./LEGAL.md)

- ◻ Entity wrapper per property (LLC / Series LLC / DST / Wyoming DAO-LLC / DUNA) holding the recorded deed
- ◻ Securities registration (Reg D 506(b)/(c), Reg A+, Reg CF, or non-US equivalents)
- ◻ Transfer-restriction module (ERC-3643 / ERC-1400) + registered transfer agent
- ◻ KYC / AML allowlist on share transfers for security-classified properties
- ◻ Operating agreement with a *recognised on-chain proposals* clause binding the LLC manager to on-chain votes
- ◻ Annual K-1 / 1099 pipeline keyed to verified identity
- ◻ Licensed property-management agreement (broker licensing where required)
- ◻ Terms of service, privacy policy, offering documents

Responsible-disclosure policy lives in [SECURITY.md](./SECURITY.md).
Full legal-stack walkthrough in [LEGAL.md](./LEGAL.md).

## License

MIT — see [LICENSE](./LICENSE).

---

<div align="center">
<sub>Stakehold is open-source infrastructure for dynamic real-estate co-ownership. Built on Ethereum.</sub>
</div>
