import { sepolia } from "wagmi/chains";
import { shareAbi } from "./abis/share";
import { propertyAbi } from "./abis/property";
import { factoryAbi } from "./abis/factory";
import { lensAbi } from "./abis/lens";

/**
 * The Stakehold frontend talks to a fixed Factory and Lens on a fixed chain,
 * plus a dynamic set of per-property Share+Property proxies discovered at
 * runtime. Envs are only consulted once, at module load, so type-narrowed
 * addresses are stable across renders.
 */
const ZERO = "0x0000000000000000000000000000000000000000" as const;

export const FACTORY_ADDRESS =
  (process.env.NEXT_PUBLIC_FACTORY_ADDRESS as `0x${string}` | undefined) ?? ZERO;

export const LENS_ADDRESS =
  (process.env.NEXT_PUBLIC_LENS_ADDRESS as `0x${string}` | undefined) ?? ZERO;

/** Optional: a curated property to feature on the home page. */
export const FEATURED_PROPERTY =
  (process.env.NEXT_PUBLIC_FEATURED_PROPERTY as `0x${string}` | undefined) ?? ZERO;

export const CHAIN_ID = sepolia.id;

export { shareAbi, propertyAbi, factoryAbi, lensAbi };

/** ── Pre-built wagmi `contractConfig` objects ────────────────────────────── */

export const factoryConfig = {
  address: FACTORY_ADDRESS,
  abi: factoryAbi,
  chainId: CHAIN_ID,
} as const;

export const lensConfig = {
  address: LENS_ADDRESS,
  abi: lensAbi,
  chainId: CHAIN_ID,
} as const;

export const shareConfigFor = (address: `0x${string}`) =>
  ({
    address,
    abi: shareAbi,
    chainId: CHAIN_ID,
  }) as const;

export const propertyConfigFor = (address: `0x${string}`) =>
  ({
    address,
    abi: propertyAbi,
    chainId: CHAIN_ID,
  }) as const;

/** ── Config-status helpers ───────────────────────────────────────────────── */

export function isConfigured(): boolean {
  return FACTORY_ADDRESS !== ZERO && LENS_ADDRESS !== ZERO;
}

export function isValidAddress(addr: string | undefined): addr is `0x${string}` {
  return !!addr && /^0x[a-fA-F0-9]{40}$/.test(addr);
}

/** ── PropertyType enum ──────────────────────────────────────────────────── */
export const PropertyType = {
  Residential: 0,
  Commercial: 1,
  MixedUse: 2,
  Land: 3,
  Other: 4,
} as const;

export const PropertyTypeLabel: Record<number, string> = {
  0: "Residential",
  1: "Commercial",
  2: "Mixed use",
  3: "Land",
  4: "Other",
};
