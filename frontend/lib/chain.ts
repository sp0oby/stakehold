import { sepolia } from "wagmi/chains";

/**
 * The single chain this app supports. Kept in its own tiny module so that
 * components which only need the chain metadata (e.g. `ConnectGate` for the
 * switch-network CTA) can import it without dragging `lib/wagmi.ts` — and
 * by extension RainbowKit's `getDefaultConfig`, which touches `indexedDB`
 * at module init — onto the server-render path.
 *
 * Only `app/providers-client.tsx` (loaded via `ssr: false`) should import
 * `wagmiConfig` from `lib/wagmi.ts`.
 */
export const targetChain = sepolia;
