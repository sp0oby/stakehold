"use client";

import dynamic from "next/dynamic";

// WalletConnect + wagmi reach for browser-only globals (indexedDB, window)
// at module-init time. Dynamically importing the provider tree with
// ssr: false guarantees none of that runs during Next's server render.
// The initial HTML paints without the web3 context; it hydrates on client.
const ClientProviders = dynamic(
  () => import("./providers-client").then((m) => m.ClientProviders),
  { ssr: false }
);

export function Providers({ children }: { children: React.ReactNode }) {
  return <ClientProviders>{children}</ClientProviders>;
}
