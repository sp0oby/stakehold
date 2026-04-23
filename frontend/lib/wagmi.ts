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

// Sepolia ONLY — this app cannot misbehave on mainnet because mainnet is
// simply not in the chain list. The Connect button's "Switch to Sepolia"
// dropdown picks up on any other current chain.
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
