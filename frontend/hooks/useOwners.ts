"use client";

import { useReadContracts } from "wagmi";
import { shareAbi, shareConfigFor, isValidAddress } from "@/lib/contracts";
import { useMemo } from "react";
import { useEventLogs } from "./useEventLogs";

/**
 * Derive the set of shareholders by scanning Transfer events on a given
 * Share contract. `shareAddress` is supplied by the property dashboard that
 * owns this hook — kept here rather than inside the hook so the hook remains
 * reusable for any property's share token.
 */
export function useOwners(shareAddress: string | undefined) {
  const address = isValidAddress(shareAddress) ? shareAddress : undefined;
  const logs = useEventLogs(address, shareAbi, "Transfer");

  const candidates = useMemo(() => {
    const set = new Set<`0x${string}`>();
    for (const l of logs) {
      const args = (l as unknown as { args: { from: `0x${string}`; to: `0x${string}` } }).args;
      if (args?.to && args.to !== "0x0000000000000000000000000000000000000000") {
        set.add(args.to);
      }
    }
    return Array.from(set);
  }, [logs]);

  const balances = useReadContracts({
    contracts: address
      ? candidates.map(
          (a) =>
            ({
              ...shareConfigFor(address),
              functionName: "balanceOf",
              args: [a],
            }) as const
        )
      : [],
    query: { enabled: !!address && candidates.length > 0 },
  });

  const owners = useMemo(() => {
    if (!balances.data) return [];
    return candidates
      .map((addr, i) => ({
        address: addr,
        shares: balances.data![i].result as bigint | undefined,
      }))
      .filter((o) => (o.shares ?? 0n) > 0n)
      .sort((a, b) => Number((b.shares ?? 0n) - (a.shares ?? 0n)));
  }, [candidates, balances.data]);

  return { owners, loading: !address || balances.isLoading };
}
