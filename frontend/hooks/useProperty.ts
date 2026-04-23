"use client";

import { useReadContract, useWatchContractEvent } from "wagmi";
import {
  lensConfig,
  propertyAbi,
  shareAbi,
  isConfigured,
  isValidAddress,
  CHAIN_ID,
} from "@/lib/contracts";

export type PropertyDetail = {
  property: `0x${string}`;
  share: `0x${string}`;
  creator: `0x${string}`;
  displayName: string;
  city: string;
  propertyType: number;
  publicMetadataURI: string;
  legalDocsURI: string;
  propertyValueUsd: bigint;
  totalShares: bigint;
  tokenName: string;
  tokenSymbol: string;
  version: string;
  autoApproveThresholdUsd: bigint;
  votingPeriod: bigint;
  timelockDelay: bigint;
  quorumBps: number;
  nextContributionId: bigint;
  nextProposalId: bigint;
  nextGrantId: bigint;
  totalYieldDistributed: bigint;
  accYieldPerShare: bigint;
  paused: boolean;
};

/**
 * Property detail via Lens + auto-refresh on the key state-changing events
 * emitted by that property or its share. We register event watchers at the
 * top level (unconditional) and let wagmi's `enabled` flag gate them; this
 * avoids the type gymnastics of conditionally spreading a contract config.
 */
export function useProperty(propertyAddress: string | undefined) {
  const address = isValidAddress(propertyAddress) ? propertyAddress : undefined;
  const enabled = isConfigured() && !!address;

  const res = useReadContract({
    ...lensConfig,
    functionName: "getPropertyDetail",
    args: address ? [address] : undefined,
    query: {
      enabled,
      refetchInterval: 15_000,
      staleTime: 5_000,
    },
  });

  const shareAddr = (res.data as PropertyDetail | undefined)?.share;

  useWatchContractEvent({
    address,
    abi: propertyAbi,
    chainId: CHAIN_ID,
    eventName: "ContributionExecuted",
    onLogs: () => res.refetch(),
    enabled: !!address,
  });
  useWatchContractEvent({
    address,
    abi: propertyAbi,
    chainId: CHAIN_ID,
    eventName: "ProposalExecuted",
    onLogs: () => res.refetch(),
    enabled: !!address,
  });
  useWatchContractEvent({
    address: isValidAddress(shareAddr) ? shareAddr : undefined,
    abi: shareAbi,
    chainId: CHAIN_ID,
    eventName: "YieldDeposited",
    onLogs: () => res.refetch(),
    enabled: isValidAddress(shareAddr),
  });

  return {
    loading: res.isLoading,
    error: res.error,
    data: res.data as PropertyDetail | undefined,
    refetch: res.refetch,
  };
}
