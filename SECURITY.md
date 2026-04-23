# Security Policy

## Scope

This policy covers the Stakehold protocol:

- Contracts in `contracts/src/`:
  - `StakeholdFactory.sol`
  - `StakeholdShare.sol`
  - `StakeholdProperty.sol`
  - `StakeholdLens.sol`
- Any deployed proxies and implementations derived from them on Ethereum mainnet or Sepolia.
- The reference frontend in `frontend/` (specifically the `/api/ipfs` proxy, which handles a server-only pinning credential).

Out of scope:

- Issues in third-party providers (Filebase, WalletConnect, RainbowKit, etc.). Report those directly to the vendor.
- Issues that require an attacker to have possession of another user's private key or wallet session.
- Generic best-practice advice that is not a concrete exploit (e.g. "you should use a timelock"); we're happy to read it but it won't qualify for any reward.
- Testnet-only deployments — Sepolia contracts hold no real value. Please test there, but report vulnerabilities only if they apply to a mainnet deployment plan.

## Current state

**Stakehold is not audited.** It is deployed on Sepolia for public demonstration. No mainnet deployment exists. Do not use real assets with any current deployment.

Before any mainnet deployment the following would be required:

- At least one external audit from a reputable firm.
- A public bug bounty (see below).
- All privileged roles (`DEFAULT_ADMIN_ROLE`, `PAUSER_ROLE`, `UPGRADER_ROLE`) held by a Safe multisig behind a timelock.
- A formally verified on-chain valuation oracle, or a documented off-chain valuation process signed by multiple independent attestors.
- A review of the IPFS pinning strategy (single provider is acceptable with a pinning-service-agnostic fallback; content is addressed so any gateway resolves).

## Reporting a vulnerability

Please **do not open a public GitHub issue** for vulnerabilities.

Email: `security@stakehold.xyz` (replace with your preferred address when forking).

Include, at minimum:

1. A description of the issue and its impact.
2. Steps to reproduce, ideally a Foundry test against a stock `forge build`.
3. Any suggested mitigations.
4. A PGP public key if you want to encrypt follow-ups.

We aim to respond within **72 hours**, issue a fix or mitigation plan within **14 days**, and publish a post-mortem after disclosure.

## Bug bounty (planned)

A formal bounty is not yet live. Pre-bounty, we'll recognize good-faith reports publicly (with permission) and coordinate any on-chain deployments together.

Planned tier brackets on mainnet launch:

| Severity | Example | Bounty range |
|---|---|---|
| Critical | Loss or lock of user funds, unauthorized share minting, unauthorized yield withdrawal | TBD — proportional to TVL |
| High | Denial of yield, permanent state corruption, governance bypass | TBD |
| Medium | Frontend privilege bypass, IPFS pin DoS | TBD |
| Low | UX / informational | Swag / recognition |

Severity is decided jointly with the reporter using Immunefi's classification framework as a reference.

## Safe-harbour

In coordinated good-faith testing — i.e. reports that follow this policy, don't exfiltrate user data, don't destroy data, and respect the 72-hour response window — we will not pursue civil action and will petition any relevant law enforcement to do the same.

## Known trust assumptions

The protocol's security model assumes:

1. **The admin is honest or controlled by a multisig / timelock.** A compromised `DEFAULT_ADMIN_ROLE` can update governance parameters, cancel pending contributions, rotate the legal-docs URI, and grant roles. It cannot mint shares, seize existing shares, or redirect yield.
2. **The UUPS upgrade path is authorised correctly.** A compromised `UPGRADER_ROLE` could deploy a malicious implementation. This is why mainnet requires multisig + timelock control.
3. **Off-chain property valuation is attested correctly.** The `propertyValueUsd` field governs how many shares a contribution mints; a tampered value enables disproportionate dilution. On testnet this is admin-settable; mainnet requires an oracle.
4. **IPFS gateways resolve honestly.** Content is content-addressed, so the bytes cannot be forged; but a misbehaving gateway can refuse to serve or slow down. The frontend defaults to Filebase's gateway and permits override via `NEXT_PUBLIC_IPFS_GATEWAY`.

## Credits

We gratefully acknowledge researchers who have helped improve Stakehold. Names are added here with permission after disclosure.
