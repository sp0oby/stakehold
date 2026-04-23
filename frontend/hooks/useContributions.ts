"use client";

import { useReadContracts } from "wagmi";
import { propertyConfigFor, isValidAddress } from "@/lib/contracts";
import { useProperty } from "./useProperty";
import { useMemo } from "react";

export type ContributionView = {
  id: bigint;
  contributor: `0x${string}`;
  valueUsd: bigint;
  proofHash: `0x${string}`;
  descriptionURI: string;
  submittedAt: bigint;
  proposalId: bigint;
  status: number;
};

export const StatusLabel = ["Pending", "Approved", "Executed", "Rejected", "Cancelled"] as const;

export function useContributions(propertyAddress: string | undefined) {
  const address = isValidAddress(propertyAddress) ? propertyAddress : undefined;
  const { data } = useProperty(address);
  const count = Number(data?.nextContributionId ?? 0n);

  const ids = useMemo(
    () => Array.from({ length: count }, (_, i) => BigInt(count - i)),
    [count]
  );

  const res = useReadContracts({
    contracts: address
      ? ids.map(
          (id) =>
            ({
              ...propertyConfigFor(address),
              functionName: "contributions",
              args: [id],
            }) as const
        )
      : [],
    query: { enabled: !!address && count > 0, refetchInterval: 30_000 },
  });

  const contributions: ContributionView[] = useMemo(() => {
    if (!res.data) return [];
    return res.data
      .map((r, i) => {
        const t = r.result as
          | readonly [`0x${string}`, bigint, `0x${string}`, string, bigint, bigint, number]
          | undefined;
        if (!t) return null;
        return {
          id: ids[i],
          contributor: t[0],
          valueUsd: t[1],
          proofHash: t[2],
          descriptionURI: t[3],
          submittedAt: t[4],
          proposalId: t[5],
          status: t[6],
        } as ContributionView;
      })
      .filter(
        (c): c is ContributionView =>
          c !== null && c.contributor !== "0x0000000000000000000000000000000000000000"
      );
  }, [res.data, ids]);

  return { contributions, loading: res.isLoading, refetch: res.refetch };
}
