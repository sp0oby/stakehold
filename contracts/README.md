# Stakehold — Contracts

Solidity `0.8.24` + Foundry + OpenZeppelin (upgradeable) `^5.0`.

Single main contract (`src/AdaptiveCoOwnership.sol`) behind a UUPS proxy.

See the top-level [../README.md](../README.md) for the full project story.

## Build

```bash
forge build
```

## Test

```bash
forge test -vv
forge coverage --report summary
```

Current: **50 tests, 97.4% line coverage**, including fuzz + invariants + upgrade roundtrip.

## Deploy (Sepolia)

```bash
export SEPOLIA_RPC_URL=...
export PRIVATE_KEY=...
export ETHERSCAN_API_KEY=...

forge script script/Deploy.s.sol:Deploy \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  -vvvv
```

## Upgrade

```bash
export PROXY_ADDRESS=0x...
forge script script/Upgrade.s.sol:Upgrade \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  -vvvv
```
