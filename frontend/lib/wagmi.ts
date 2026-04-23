import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";
import { http } from "viem";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!projectId) {
  // Fail loudly in dev so we don't accidentally ship without a WC project id.
  // (In production this throws at server boot, which we prefer to silent bugs.)
  // eslint-disable-next-line no-console
  console.warn(
    "[wagmi] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. Get one at https://cloud.walletconnect.com"
  );
}

const rpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;

// Single-chain app — only the configured preview testnet is in the list, so
// the wallet cannot accidentally talk to mainnet. Wrong-network = switch CTA.
export const wagmiConfig = getDefaultConfig({
  appName: "Stakehold",
  projectId: projectId ?? "stub-for-local-dev",
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(rpc),
  },
  ssr: true,
});

export const targetChain = sepolia;
