"use client";

import { useReadContracts } from "wagmi";
import { propertyConfigFor, isValidAddress } from "@/lib/contracts";
import { useProperty } from "./useProperty";
import { useMemo } from "react";

export type ProposalView = {
  id: bigint;
  contributionId: bigint;
  snapshotBlock: bigint;
  votingDeadline: bigint;
  executableAt: bigint;
  yesVotes: bigint;
  noVotes: bigint;
  executed: boolean;
};

export function useProposals(propertyAddress: string | undefined) {
  const address = isValidAddress(propertyAddress) ? propertyAddress : undefined;
  const { data } = useProperty(address);
  const count = Number(data?.nextProposalId ?? 0n);

  const ids = useMemo(
    () => Array.from({ length: count }, (_, i) => BigInt(i + 1)),
    [count]
  );

  const res = useReadContracts({
    contracts: address
      ? ids.map(
          (id) =>
            ({
              ...propertyConfigFor(address),
              functionName: "proposals",
              args: [id],
            }) as const
        )
      : [],
    query: { enabled: !!address && count > 0, refetchInterval: 15_000 },
  });

  const proposals: ProposalView[] = useMemo(() => {
    if (!res.data) return [];
    return res.data
      .map((r, i) => {
        const tup = r.result as
          | readonly [bigint, bigint, bigint, bigint, bigint, bigint, boolean]
          | undefined;
        if (!tup) return null;
        return {
          id: ids[i],
          contributionId: tup[0],
          snapshotBlock: tup[1],
          votingDeadline: tup[2],
          executableAt: tup[3],
          yesVotes: tup[4],
          noVotes: tup[5],
          executed: tup[6],
        } as ProposalView;
      })
      .filter((p): p is ProposalView => p !== null && p.contributionId !== 0n);
  }, [res.data, ids]);

  return { proposals, loading: res.isLoading, refetch: res.refetch };
}
