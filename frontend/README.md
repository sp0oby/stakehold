# Stakehold — Frontend

Next.js 14 App Router + TypeScript + Tailwind + wagmi/viem/RainbowKit.

See the top-level [../README.md](../README.md) for the full project story.

## Dev

```bash
cp .env.example .env.local
# fill in envs (see table below)
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Env vars

| Var | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL` | Browser | Alchemy/Infura/QuickNode Sepolia RPC |
| `NEXT_PUBLIC_FACTORY_ADDRESS` | Browser | `StakeholdFactory` address on Sepolia |
| `NEXT_PUBLIC_LENS_ADDRESS` | Browser | `StakeholdLens` address on Sepolia |
| `NEXT_PUBLIC_FEATURED_PROPERTY` | Browser | Optional — property pinned to the homepage |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Browser | From [cloud.walletconnect.com](https://cloud.walletconnect.com/) |
| `NEXT_PUBLIC_IPFS_GATEWAY` | Browser | Optional override for IPFS reads (default: `ipfs.filebase.io/ipfs/`) |
| `FILEBASE_IPFS_TOKEN` | **Server only** | Filebase IPFS access key — never ship to browser |
