"use client";

import { useEnsName } from "wagmi";
import { mainnet } from "wagmi/chains";
import { useState } from "react";
import { shortAddress } from "@/lib/format";
import { cn } from "@/lib/cn";

type Props = {
  address: `0x${string}` | undefined;
  className?: string;
  explorerBase?: string; // default: sepolia
  showFull?: boolean;
};

export function AddressPill({
  address,
  className,
  explorerBase = "https://sepolia.etherscan.io",
  showFull = false,
}: Props) {
  // ENS lookup always happens on mainnet — Sepolia doesn't have ENS reverse.
  const { data: ens } = useEnsName({ address, chainId: mainnet.id });
  const [copied, setCopied] = useState(false);

  if (!address) return <span className="text-fg-muted">—</span>;

  const display = ens ?? (showFull ? address : shortAddress(address));

  const copy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-xs bg-surface-2 border border-border rounded-md px-2 py-1",
        className
      )}
    >
      <span className="text-fg">{display}</span>
      <button
        onClick={copy}
        className="text-fg-muted hover:text-fg transition-colors"
        title={copied ? "Copied!" : "Copy address"}
        aria-label="Copy address"
      >
        {copied ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15V5a2 2 0 012-2h10" />
          </svg>
        )}
      </button>
      <a
        href={`${explorerBase}/address/${address}`}
        target="_blank"
        rel="noreferrer"
        className="text-fg-muted hover:text-fg transition-colors"
        title="View on Etherscan"
        aria-label="View on block explorer"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </a>
    </span>
  );
}
