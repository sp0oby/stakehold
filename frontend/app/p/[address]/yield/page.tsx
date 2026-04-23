"use client";

import { useState, useEffect } from "react";
import { parseEther } from "viem";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  useReadContract,
} from "wagmi";
import { toast } from "sonner";
import { shareConfigFor, isValidAddress, CHAIN_ID } from "@/lib/contracts";
import { useUserPosition } from "@/hooks/useUserPosition";
import { useProperty } from "@/hooks/useProperty";
import { useEthPrice } from "@/hooks/useEthPrice";
import { TxButton } from "@/components/TxButton";
import { StatCard } from "@/components/StatCard";
import { AddressPill } from "@/components/AddressPill";
import { formatEth, formatShares, parseContractError } from "@/lib/format";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

export default function YieldPage({
  params,
}: {
  params: { address: string };
}) {
  const { address } = params;
  const valid = isValidAddress(address);
  const { address: wallet, isConnected } = useAccount();
  const { data, refetch: refetchProp } = useProperty(valid ? address : undefined);
  const { data: position, refetch: refetchPos } = useUserPosition(
    valid ? address : undefined,
    wallet
  );
  const ethUsd = useEthPrice();

  const [depositAmount, setDepositAmount] = useState("");

  const shareAddr =
    data?.share && isValidAddress(data.share) ? (data.share as `0x${string}`) : undefined;
  const shareCfg = shareAddr ? shareConfigFor(shareAddr) : undefined;

  const sharePaused = useReadContract({
    ...shareConfigFor(shareAddr ?? ZERO),
    functionName: "paused",
    chainId: CHAIN_ID,
    query: { enabled: !!shareAddr },
  });

  const claim = useWriteContract();
  const claimTx = useWaitForTransactionReceipt({ hash: claim.data });

  const distribute = useWriteContract();
  const distTx = useWaitForTransactionReceipt({ hash: distribute.data });

  useEffect(() => {
    if (claimTx.isSuccess) {
      void refetchPos();
    }
  }, [claimTx.isSuccess, refetchPos]);

  useEffect(() => {
    if (distTx.isSuccess) {
      void refetchPos();
      void refetchProp();
      setDepositAmount("");
    }
  }, [distTx.isSuccess, refetchPos, refetchProp]);

  const claimable = position?.claimableYield ?? 0n;
  const balance = position?.shareBalance ?? 0n;
  const paused = !!(sharePaused.data as boolean | undefined);

  const claimableEth = Number(claimable) / 1e18;
  const claimableUsd = ethUsd ? claimableEth * ethUsd : null;

  const doClaim = () => {
    if (!shareCfg) return;
    claim.writeContract(
      { ...shareCfg, functionName: "claimYield" },
      {
        onSuccess: () => toast.success("Claim tx sent"),
        onError: (e) => toast.error(parseContractError(e)),
      }
    );
  };

  const doDistribute = () => {
    if (!shareCfg) return;
    if (paused) {
      toast.error("Share contract is paused — cannot distribute (unpause the Share token or wait).");
      return;
    }
    const n = Number(depositAmount);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Enter a positive ETH amount");
      return;
    }
    distribute.writeContract(
      {
        ...shareCfg,
        functionName: "distributeYield",
        value: parseEther(depositAmount),
      },
      {
        onSuccess: () => toast.success("Distribution tx sent"),
        onError: (e) => toast.error(parseContractError(e)),
      }
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Rental yield</h1>
        <p className="text-fg-muted mt-2">
          Rental income is deposited into the <strong>Share</strong> token as ETH
          and streamed to every holder pro rata. Claims use a pull pattern — each
          holder pays their own claim gas. On mainnet, someone still converts
          off-chain rent to ETH; that rail is the operator&apos;s job — see{" "}
          <a href="/about#concepts" className="text-accent hover:underline">
            How it works
          </a>{" "}
          and the repo README.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Total distributed"
          value={`${formatEth(data?.totalYieldDistributed)} ETH`}
          sublabel={
            ethUsd && data?.totalYieldDistributed
              ? `~${new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                }).format((Number(data.totalYieldDistributed) / 1e18) * ethUsd)}`
              : undefined
          }
          tooltip="All-time rental income deposited into the Share token."
        />
        <StatCard
          label="Your balance"
          value={formatShares(balance, data?.totalShares)}
          sublabel={!isConnected ? "Connect wallet to see" : undefined}
        />
        <StatCard
          label="ETH / USD"
          value={ethUsd ? `$${ethUsd.toLocaleString()}` : "—"}
          sublabel="spot price"
          tooltip="Live price from Coingecko. A production build would read Chainlink ETH/USD on-chain."
        />
      </div>

      <div id="rent-payments" className="card border-accent/20 bg-accent/5">
        <h2 className="font-semibold text-fg">Add rent &amp; pass-through payments</h2>
        <p className="text-sm text-fg-muted mt-1 max-w-3xl">
          Call{" "}
          <code className="font-mono text-xs bg-surface-2 px-1.5 py-0.5 rounded">
            distributeYield()
          </code>{" "}
          with ETH attached. It streams the deposit into the per-share
          yield accumulator; every current holder can claim a proportional slice.
          Permissionless on purpose — in production, a property manager, DAO
          operator, or automated service signs this after converting fiat rent
          to ETH. On Sepolia, use this to simulate a rent run with test ETH.
        </p>
        {data?.share && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-fg-muted">Share contract</span>
            <AddressPill address={data.share} showFull className="text-[11px]" />
            <a
              href={`https://sepolia.etherscan.io/address/${data.share}#code`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-accent hover:underline"
            >
              View on Etherscan ↗
            </a>
          </div>
        )}
        {paused && (
          <p className="text-xs text-warning mt-3">
            <strong>Share contract is paused</strong> — <code className="font-mono">distributeYield</code>{" "}
            reverts. Unpause the Share token to deposit (Property pause does not
            always pause the Share; check Etherscan).
          </p>
        )}

        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="number"
              min="0"
              step="0.001"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="0.0"
              className="w-full rounded-lg bg-surface-2 border border-border pl-3 pr-16 py-2.5 text-fg placeholder:text-fg-muted focus:outline-none focus:border-accent"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted text-sm">
              ETH
            </span>
          </div>
          <TxButton
            onClick={doDistribute}
            isPending={distribute.isPending}
            isConfirming={distTx.isLoading}
            disabled={!depositAmount || !shareCfg || paused}
            variant="primary"
            className="shrink-0"
          >
            Send ETH as rent
          </TxButton>
        </div>
        {ethUsd && Number(depositAmount) > 0 && (
          <p className="text-xs text-fg-muted mt-2 tabular-nums">
            ≈{" "}
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(Number(depositAmount) * ethUsd)}
          </p>
        )}
        <p className="text-xs text-fg-muted/80 mt-3 border-t border-border pt-3">
          <strong>Plain ETH works too</strong> — a raw transfer to the Share
          contract address calls <code className="font-mono">receive()</code> and
          has the same accounting effect, but the UI only supports{" "}
          <code className="font-mono">distributeYield</code> so you get clear
          reverts, events, and <code className="font-mono">whenNotPaused</code>{" "}
          behaviour.
        </p>
      </div>

      <div className="card bg-gradient-to-br from-surface to-accent/10 border-accent/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="stat-label">You can claim</div>
            <div className="text-4xl md:text-5xl font-bold mt-2 tabular-nums">
              {formatEth(claimable, 6)}{" "}
              <span className="text-xl text-fg-muted font-medium">ETH</span>
            </div>
            {claimableUsd !== null && claimable > 0n && (
              <div className="text-sm text-fg-muted mt-1 tabular-nums">
                ≈{" "}
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 2,
                }).format(claimableUsd)}{" "}
                at current price
              </div>
            )}
            {balance === 0n && wallet && (
              <p className="text-xs text-fg-muted mt-3">
                You don&rsquo;t hold any shares yet. Submit a contribution to become a
                co-owner.
              </p>
            )}
          </div>
          <TxButton
            onClick={doClaim}
            isPending={claim.isPending}
            isConfirming={claimTx.isLoading}
            disabled={claimable === 0n || paused}
            className="!px-6 !py-3 !text-base"
          >
            Claim yield
          </TxButton>
        </div>
        {paused && (
          <p className="text-xs text-warning mt-3">
            <strong>Share contract is paused</strong> — claims and distributions are
            blocked.
          </p>
        )}
      </div>
    </div>
  );
}
