"use client";

import { useReadContracts } from "wagmi";
import { keccak256, toBytes } from "viem";
import { propertyConfigFor, isValidAddress, CHAIN_ID } from "@/lib/contracts";

/** Role hashes (AccessControl `keccak256("ROLE_NAME")`). */
export const ROLES = {
  DEFAULT_ADMIN: "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
  PAUSER: keccak256(toBytes("PAUSER_ROLE")),
  UPGRADER: keccak256(toBytes("UPGRADER_ROLE")),
} as const;

export type RoleFlags = {
  isAdmin: boolean;      // DEFAULT_ADMIN_ROLE
  isPauser: boolean;
  isUpgrader: boolean;
  isAnyAdmin: boolean;   // admin OR pauser OR upgrader
  loading: boolean;
};

/**
 * Returns which admin-ish roles `wallet` holds on the given property.
 * Batches all three `hasRole` reads into one multicall for a single RPC round.
 */
export function useIsAdmin(
  propertyAddress: string | undefined,
  wallet: string | undefined
): RoleFlags {
  const enabled = isValidAddress(propertyAddress) && isValidAddress(wallet);

  const res = useReadContracts({
    contracts: enabled
      ? [
          {
            ...propertyConfigFor(propertyAddress as `0x${string}`),
            functionName: "hasRole",
            args: [ROLES.DEFAULT_ADMIN, wallet as `0x${string}`],
          },
          {
            ...propertyConfigFor(propertyAddress as `0x${string}`),
            functionName: "hasRole",
            args: [ROLES.PAUSER, wallet as `0x${string}`],
          },
          {
            ...propertyConfigFor(propertyAddress as `0x${string}`),
            functionName: "hasRole",
            args: [ROLES.UPGRADER, wallet as `0x${string}`],
          },
        ]
      : [],
    allowFailure: true,
    query: {
      enabled,
      refetchInterval: 30_000,
      staleTime: 15_000,
    },
    // pin to Sepolia so stray wallet chain changes don't re-issue these calls
    // @ts-expect-error wagmi carries chainId down per-call via config spread
    chainId: CHAIN_ID,
  });

  const isAdmin = !!(res.data?.[0]?.status === "success" && res.data[0].result);
  const isPauser = !!(res.data?.[1]?.status === "success" && res.data[1].result);
  const isUpgrader = !!(res.data?.[2]?.status === "success" && res.data[2].result);

  return {
    isAdmin,
    isPauser,
    isUpgrader,
    isAnyAdmin: isAdmin || isPauser || isUpgrader,
    loading: res.isLoading,
  };
}
