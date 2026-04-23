"use client";

import { useEffect, useState } from "react";

/**
 * Lightweight ETH/USD price hook. Uses Coingecko's public spot endpoint
 * since we only need it for USD context on the yield screen. In a real
 * production build, swap for a Chainlink ETH/USD oracle read on-chain.
 */
export function useEthPrice() {
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
        );
        const j = await r.json();
        if (!cancelled) setPrice(j.ethereum?.usd ?? null);
      } catch {
        // non-fatal; UI falls back to "~—"
      }
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  return price;
}
