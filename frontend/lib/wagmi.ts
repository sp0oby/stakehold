import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";
import { http } from "viem";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!projectId) {
  // eslint-disable-next-line no-console
  console.warn(
    "[wagmi] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. Get one at https://cloud.walletconnect.com"
  );
}

/**
 * RPC URL resolution.
 *
 * - In the browser, we ALWAYS go through our own `/api/rpc` proxy. The
 *   Infura/Alchemy key lives in `SEPOLIA_RPC_URL` on the server and is never
 *   shipped to the client, which stops quota-stealing and DevTools leaks.
 *
 * - During SSR / RSC rendering we either hit the proxy (same Next server) or
 *   talk to upstream directly if an absolute URL is available. A relative
 *   `/api/rpc` works fine in the browser but not in Node, so on the server we
 *   prefer the raw URL.
 *
 * - For local dev you can still set `NEXT_PUBLIC_SEPOLIA_RPC_URL` to skip the
 *   proxy entirely.
 */
function resolveRpcUrl(): string | undefined {
  // Local-dev escape hatch: if the legacy public var is set we use it as-is.
  const legacyPublic = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
  if (legacyPublic && legacyPublic.length > 0) return legacyPublic;

  if (typeof window !== "undefined") {
    return "/api/rpc";
  }

  // Server rendering: hit upstream directly if configured, otherwise let viem
  // fall back to its public RPC list.
  return process.env.SEPOLIA_RPC_URL;
}

const rpcUrl = resolveRpcUrl();

/**
 * NOTE: Do not import this module from anywhere that might run during SSR.
 * `getDefaultConfig` touches `indexedDB` at evaluation time (via WalletConnect
 * storage), so it MUST stay client-only. The only legitimate importer is
 * `app/providers-client.tsx`, which is dynamic-imported with `ssr: false`.
 *
 * If you just need the chain constant (e.g. for a switch-network CTA), import
 * `targetChain` from `@/lib/chain` instead — that module has no web3 side
 * effects and is safe to import from anywhere.
 */
export const wagmiConfig = getDefaultConfig({
  appName: "Stakehold",
  projectId: projectId ?? "stub-for-local-dev",
  chains: [sepolia],
  transports: {
    // Batch simultaneous reads into a single upstream request — cuts call
    // volume ~5-10x on busy tabs. `batchSize: 20` keeps any individual batch
    // small enough that one slow call (e.g. a wide eth_getLogs) can't push
    // the whole batch past the serverless function timeout; `wait: 16` is
    // short enough that the user never perceives the delay.
    [sepolia.id]: http(rpcUrl, {
      batch: { wait: 16, batchSize: 20 },
    }),
  },
  ssr: true,
});
