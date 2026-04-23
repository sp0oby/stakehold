"use client";

import { usePublicClient } from "wagmi";
import { useEffect, useState } from "react";
import type { Abi, Log } from "viem";

/**
 * Light-weight event log scanner. Pulls *all* historical logs of a given
 * event from the supplied contract's genesis block. Sufficient for current
 * early-stage traffic volume; at scale this would be a subgraph or Ponder
 * indexer.
 *
 * Why the chunked fallback:
 *   Infura (and most public RPCs) reject a single `eth_getLogs` call that
 *   spans millions of blocks. When the fast path fails (timeout, "query
 *   returned more than N results", or 400), we fall back to scanning the
 *   recent window in 9_999-block chunks — which is inside Infura's
 *   documented 10k-block ceiling. We intentionally DON'T walk all the way
 *   back to block 0: for a testnet app this would fan out to hundreds of
 *   requests. The property was deployed in the last few months, so
 *   ~250k blocks of recent history covers everything and still fits in
 *   a few chunked calls.
 */

// Most free RPCs cap eth_getLogs at 10k blocks per call.
const CHUNK_SIZE = 9_999n;
// How far back the chunked fallback looks. ~500k Sepolia blocks is roughly
// ten weeks — plenty for any property in this preview.
const FALLBACK_LOOKBACK = 500_000n;
// Chunks to run concurrently. 5 keeps the proxy warm without hammering any
// single upstream hard enough to get rate-limited.
const CHUNK_CONCURRENCY = 5;

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
      // Fast path: ask for all history in a single call. Works on archive
      // nodes and for young contracts.
      try {
        const got = await client.getLogs({
          address,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          event: event as any,
          fromBlock: 0n,
          toBlock: "latest",
        });
        if (!cancelled) setLogs(got as Log[]);
        return;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          `[useEventLogs:${eventName}] wide scan failed, falling back to chunked scan`,
          err
        );
      }

      // Fallback: chunked scan of the recent window.
      try {
        const headRaw = await client.getBlockNumber().catch(() => undefined);
        // getBlockNumber can come back `undefined` when the transport is
        // momentarily broken (batching misalignment, proxy warmup, etc.).
        // Treat that as a transient empty state instead of throwing.
        if (typeof headRaw !== "bigint") {
          // eslint-disable-next-line no-console
          console.warn(
            `[useEventLogs:${eventName}] head block unavailable, skipping fallback`
          );
          if (!cancelled) setLogs([]);
          return;
        }
        const head = headRaw;
        const earliest =
          head > FALLBACK_LOOKBACK ? head - FALLBACK_LOOKBACK : 0n;

        // Build the full chunk list up-front so we can run them with
        // bounded concurrency. Serial scanning of 50 chunks was taking
        // 15-25s on prod; 5-way concurrency cuts that to ~3-5s.
        const ranges: { from: bigint; to: bigint }[] = [];
        for (let from = earliest; from <= head; from += CHUNK_SIZE + 1n) {
          const to = from + CHUNK_SIZE > head ? head : from + CHUNK_SIZE;
          ranges.push({ from, to });
        }

        const collected: Log[] = [];
        for (let i = 0; i < ranges.length; i += CHUNK_CONCURRENCY) {
          if (cancelled) return;
          const batch = ranges.slice(i, i + CHUNK_CONCURRENCY);
          const results = await Promise.all(
            batch.map(async ({ from, to }) => {
              try {
                const chunk = await client.getLogs({
                  address,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  event: event as any,
                  fromBlock: from,
                  toBlock: to,
                });
                return Array.isArray(chunk) ? (chunk as Log[]) : [];
              } catch (chunkErr) {
                // One bad chunk shouldn't kill the scan — log and continue.
                // eslint-disable-next-line no-console
                console.warn(
                  `[useEventLogs:${eventName}] chunk ${from}-${to} failed`,
                  chunkErr
                );
                return [] as Log[];
              }
            })
          );
          for (const got of results) collected.push(...got);
        }
        if (!cancelled) setLogs(collected);
      } catch (fatal) {
        // eslint-disable-next-line no-console
        console.error(`[useEventLogs:${eventName}] fallback scan failed`, fatal);
        if (!cancelled) setLogs([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, address, abi, eventName]);

  return logs;
}
