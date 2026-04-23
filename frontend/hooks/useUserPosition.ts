"use client";

import { useReadContract } from "wagmi";
import {
  lensConfig,
  isConfigured,
  isValidAddress,
} from "@/lib/contracts";

export type UserPosition = {
  property: `0x${string}`;
  share: `0x${string}`;
  shareBalance: bigint;
  votingPower: bigint;
  claimableYield: bigint;
  grantIds: readonly bigint[];
  isShareholder: boolean;
};

export type UserGrant = {
  grantId: bigint;
  beneficiary: `0x${string}`;
  shares: bigint;
  cliffEnd: bigint;
  claimed: boolean;
  claimable: boolean;
};

/** A single user position on one property. */
export function useUserPosition(
  propertyAddress: string | undefined,
  user: string | undefined
) {
  const pAddr = isValidAddress(propertyAddress) ? propertyAddress : undefined;
  const uAddr = isValidAddress(user) ? user : undefined;
  const enabled = isConfigured() && !!pAddr && !!uAddr;

  const res = useReadContract({
    ...lensConfig,
    functionName: "getUserPosition",
    args: pAddr && uAddr ? [pAddr, uAddr] : undefined,
    query: { enabled, refetchInterval: 30_000, staleTime: 15_000 },
  });

  return {
    loading: res.isLoading,
    data: res.data as UserPosition | undefined,
    refetch: res.refetch,
  };
}

/** Vesting grants for a user on a property. */
export function useUserGrants(
  propertyAddress: string | undefined,
  user: string | undefined
) {
  const pAddr = isValidAddress(propertyAddress) ? propertyAddress : undefined;
  const uAddr = isValidAddress(user) ? user : undefined;
  const enabled = isConfigured() && !!pAddr && !!uAddr;

  const res = useReadContract({
    ...lensConfig,
    functionName: "getUserGrants",
    args: pAddr && uAddr ? [pAddr, uAddr] : undefined,
    query: { enabled, refetchInterval: 60_000, staleTime: 20_000 },
  });

  return {
    loading: res.isLoading,
    grants: (res.data as UserGrant[] | undefined) ?? [],
    refetch: res.refetch,
  };
}

/** All positions for a user across every property. */
export function useUserPositions(
  user: string | undefined,
  offset: bigint = 0n,
  limit: bigint = 24n
) {
  const uAddr = isValidAddress(user) ? user : undefined;
  const enabled = isConfigured() && !!uAddr;

  const res = useReadContract({
    ...lensConfig,
    functionName: "getUserPositions",
    args: uAddr ? [uAddr, offset, limit] : undefined,
    query: { enabled, refetchInterval: 60_000, staleTime: 20_000 },
  });

  const all = (res.data as UserPosition[] | undefined) ?? [];
  return {
    loading: res.isLoading,
    all,
    heldOnly: all.filter((p) => p.isShareholder),
    refetch: res.refetch,
  };
}
