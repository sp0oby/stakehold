# Legal considerations

> This document is **not legal advice**. It is a map of the real-world legal
> questions that have to be answered before a Stakehold-like protocol can
> hold title to actual property. Anyone building a production system from this
> codebase should engage securities and real-estate counsel in every relevant
> jurisdiction.

Stakehold's on-chain logic is deliberately jurisdiction-agnostic. What follows
is a sketch of the *off-chain* legal stack that would need to wrap the
protocol before real capital could flow through it.

## 1. The core gap: token ≠ deed

Putting a deed PDF on IPFS does not transfer legal ownership of real
property. Ownership is established by a deed recorded at a county recorder's
office (US) or equivalent land registry (UK, EU, APAC). The only legal claim
a token holder has is *against the entity that actually holds the recorded
deed*.

Stakehold's `legalDocsURI` is therefore a mirror of what that entity has
filed — it is evidence, not title.

## 2. Entity structure (pick one per property)

| Wrapper | Where it's used | Notes |
|---|---|---|
| **LLC per property** | US (all 50 states) | Most common. LLC holds the deed; token holders own LLC membership interests. Operating agreement ties the manager to on-chain votes. |
| **Series LLC** | DE, TX, IL, NV, TN + ~15 others | One parent LLC, per-property series with asset isolation. Cheaper to spin up, less battle-tested in court. |
| **Delaware Statutory Trust (DST)** | US syndicated real estate | 1031-exchange friendly; IRS-blessed for pass-through. |
| **Wyoming DAO LLC** | WY, 2021 statute | The DAO itself is recognised as a legal entity. |
| **Marshall Islands DAO LLC** | RMI | Similar, international-friendly. |
| **Wyoming DUNA** | WY, 2024 statute | Decentralized Unincorporated Nonprofit Association, purpose-built for DAOs. |

## 3. Securities law

Tokens representing fractional real-estate income almost certainly qualify as
securities under the US *Howey* test (investment of money, common enterprise,
profits expected, from efforts of others). Non-US regulators (EU MiCA, UK
FCA, Singapore MAS, UAE VARA, etc.) draw similar lines.

Viable US registration paths:

- **Reg D 506(b)** — accredited investors only, no public solicitation; cheapest.
- **Reg D 506(c)** — accredited only, public solicitation permitted, must verify accreditation.
- **Reg A+** — retail-friendly, up to $75M / yr. SEC filing required.
- **Reg CF** — crowdfunding, up to $5M / yr, lower disclosure bar but capped raise.
- **Reg S** — non-US investors only.

Non-US analogues: EU Prospectus Regulation, UK FSMA s.21, MiCA for crypto-asset offerings that also constitute MiFID securities, etc.

## 4. Transfer restrictions

If the token is a security:

- **Rule 144** one-year holding period for Reg D tokens before resale.
- **KYC / AML** on every transfer — the contract needs a compliance module. ERC-3643 (T-REX) and ERC-1400 are the two mature standards for this; both allow an on-chain allowlist maintained by a registered transfer agent.
- **Registered transfer agent** of record (e.g. Securitize, OpenEden, Clear Street).
- **Secondary trading** only via a licensed ATS (e.g. tZERO, Prometheum, INX) or regulated DEX (SEC-registered).

The current Stakehold `StakeholdShare` contract does *not* implement transfer
restrictions. On mainnet you would either (a) deploy behind a compliance
wrapper, or (b) add a `_beforeTokenTransfer` hook that checks an allowlist
module. Both choices are covered by the `__gap` slots in the upgradeable
implementation.

## 5. Tax plumbing

- **Pass-through taxation** via LLC — annual K-1s to every token holder, which requires off-chain identity resolution.
- **Property tax** paid by the LLC from rent (a line item in the yield math).
- **State transfer / stamp tax** on acquisition (1–4% in most US states; up to 15% in some EU jurisdictions for non-resident buyers).
- **FIRPTA** — 15% US withholding on dispositions by non-US persons owning US real estate (directly or via LLC).
- **1031 exchange** — only possible if the token represents a direct interest in the real property itself, typically via a DST; LLC membership interests generally don't qualify.

## 6. Operational legal layer

Per property, the LLC must maintain:

- Hazard + general liability insurance (premium funded from rent).
- A property-management agreement (several US states require a licensed broker for day-to-day management of rental property).
- Beneficial-ownership reporting — FinCEN CTA in the US (status: subject to ongoing litigation), AMLD5/6 equivalents in the EU.
- State-specific real-estate syndication filings (e.g. California Bureau of Real Estate requires filings for pooled investments).

## 7. The enforceability clause

The single most-often-overlooked piece: the LLC's **operating agreement must
explicitly bind the manager** to on-chain proposal outcomes for enumerated
categories (repairs above $X, sale, refinancing, manager replacement).

Without this, on-chain votes are advisory. The on-chain record is technically
public and verifiable, but absent a contractual link, a court sees a
members-vote that the manager ignored as a breach the members can sue over —
not automatic execution.

Recommended operating-agreement mechanics:

- Section defining "Recognised On-Chain Proposals" with a specific contract address, chain ID, and proposal-ID format.
- Section listing categories where the manager is bound.
- Section defining dispute resolution if the on-chain record conflicts with the off-chain (oracle disputes, reorg, etc.) — typically a fallback to member vote at the LLC level.

## 8. What this means for Stakehold on mainnet

| Concern | Today (Sepolia) | Mainnet requirement |
|---|---|---|
| Entity wrapper | None | LLC or DAO-LLC per property, recorded deed |
| Securities filing | None | Reg D/A/CF + matching non-US filings |
| Transfer gating | Open ERC-20 | ERC-3643 compliance module or allowlist hook |
| KYC | None | Transfer-agent integration (Securitize et al.) |
| Tax reporting | None | Annual K-1 / 1099 pipeline keyed to verified identity |
| Legal docs rotation | Admin-gated IPFS pointer | Same pattern, but docs are the county-filed deed + operating agreement + insurance binder |
| Governance binding | On-chain only | Operating agreement with recognised-proposals clause |
| Appraisal | Admin-settable `propertyValueUsd` | Independent attested appraisal signed by ≥ 2 licensed appraisers |

## 9. Not reinventing the wheel

Several platforms already operate under this framework and are useful
reference points:

- **RealT** (Detroit, Cleveland, Florida SFH rentals) — Reg D 506(c), LLC per property.
- **Lofty AI** — similar, Algorand-based.
- **Roofstock onChain** — DST wrapper, compliance via Securitize.
- **Landshare** — UK-focused, uses FCA innovation pathways.
- **Parcl** — synthetic real-estate prices, sidesteps the deed problem entirely.

Reading their offering circulars and operating agreements is the fastest
education in what this stack looks like in practice.

## 10. The fiat-to-crypto rent rail (non-legal, but structurally required)

Storing the deed, forming the LLC, and filing the securities offering only
matter once **real rental cash** can reach the on-chain `StakeholdShare`
contract as ETH (or, in a USDC-accepting fork, a stable asset). The smart
contract cannot pull ACH from a tenant's bank account. Today that conversion
is almost always a **licensed human treasurer** (RealT, Lofty) or a **payment
integrator** (Circle Mint, Bridge, Stripe) sitting between the bank account
and the chain.

| Operator model | How rent becomes claimable on-chain | Custodial? |
| --- | --- | --- |
| **Manual treasurer** (status quo) | Off-ramp fiat weekly → `distributeYield{value:}` on Share | Yes — you trust the treasurer not to commingle. |
| **ACH → stable → bridge** (2024+ APIs) | Bridge / Circle wires USDC to a multisig → swap to ETH (or use a USDC-accepting Share) | Minimally custodial at the fintech. |
| **Direct stablecoin from tenants** | Tenants with self-custody pay rent in USDC; multisig funnels to Share | Least human touch; smallest TAM. |

**What Stakehold ships today:** a permissionless, auditable, production-shaped
`distributeYield` entry point. What it does *not* ship: compliance around who
is allowed to press that button for a *specific* mainnet property — that
belongs in the operating agreement, the LLC charter, and (if the token is a
security) the transfer-gating module, not the generic ERC-20.

---

**Bottom line:** the contracts in this repo are the *on-chain half* of a
dual-layer system. The off-chain half — entity formation, securities
registration, transfer agent, operating agreement, **and** a compliant rent
on-rail — is where most of the cost, time, and failure modes live, and where
most attempted tokenized-real-estate projects actually fail.
