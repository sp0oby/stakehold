"use client";

import { usePublicClient } from "wagmi";
import { useEffect, useState } from "react";
import type { Abi, Log } from "viem";

/**
 * Light-weight event log scanner. Pulls *all* historical logs of a given
 * event from the supplied contract's genesis block. Sufficient for current
 * Sepolia volume; at scale this would be a subgraph or Ponder indexer.
 */
export function useEventLogs(
  address: `0x${string}` | undefined,
  abi: Abi,
  eventName: string
) {
  const client = usePublicClient();
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    if (!client || !address) {
      setLogs([]);
      return;
    }
    let cancelled = false;
    const event = (abi as readonly { type: string; name?: string }[]).find(
      (i) => i.type === "event" && i.name === eventName
    );
    if (!event) return;

    (async () => {
      try {
        const got = await client.getLogs({
          address,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          event: event as any,
          fromBlock: "earliest",
          toBlock: "latest",
        });
        if (!cancelled) setLogs(got as Log[]);
      } catch {
        if (!cancelled) setLogs([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, address, abi, eventName]);

  return logs;
}
