"use client";

import { useReadContract, useWatchContractEvent } from "wagmi";
import { factoryConfig, lensConfig, isConfigured } from "@/lib/contracts";

/**
 * Lists every property launched via the StakeholdFactory, as compact
 * `PropertyCard` records ready to render in a grid. One RPC round-trip thanks
 * to the Lens aggregator.
 *
 * Auto-refreshes whenever `PropertyCreated` fires on the factory.
 */
export type PropertyCard = {
  property: `0x${string}`;
  share: `0x${string}`;
  creator: `0x${string}`;
  displayName: string;
  city: string;
  propertyType: number;
  publicMetadataURI: string;
  propertyValueUsd: bigint;
  totalShares: bigint;
  tokenName: string;
  tokenSymbol: string;
  totalYieldDistributed: bigint;
  paused: boolean;
};

export function useProperties(offset: bigint = 0n, limit: bigint = 24n) {
  const enabled = isConfigured();

  const res = useReadContract({
    ...lensConfig,
    functionName: "getPropertyCards",
    args: [offset, limit],
    query: {
      enabled,
      refetchInterval: 60_000,
      staleTime: 10_000,
    },
  });

  useWatchContractEvent({
    ...factoryConfig,
    eventName: "PropertyCreated",
    onLogs: () => res.refetch(),
    enabled,
  });

  const cards = (res.data as PropertyCard[] | undefined) ?? [];

  return {
    loading: res.isLoading,
    error: res.error,
    properties: cards,
    configured: enabled,
    refetch: res.refetch,
  };
}
