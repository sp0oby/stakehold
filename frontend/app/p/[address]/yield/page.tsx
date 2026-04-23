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
import { BRAND } from "@/lib/brand";
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
      toast.error("Income deposits are temporarily paused.");
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
        <p className="text-fg-muted mt-2 max-w-3xl">
          When rent is received, it&apos;s posted in ETH and split across everyone
          who holds a stake. You claim your piece whenever you&apos;re ready — no
          one else has to click &ldquo;send&rdquo; for you. For a fuller walkthrough,
          see{" "}
          <a href="/about" className="text-accent hover:underline">
            How {BRAND.name} works
          </a>
          .
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
          tooltip="All rental and pass-through income posted for this property to date."
        />
        <StatCard
          label="Your balance"
          value={formatShares(balance, data?.totalShares)}
          sublabel={!isConnected ? "Connect wallet to see" : undefined}
        />
        <StatCard
          label="ETH / USD"
          value={ethUsd ? `$${ethUsd.toLocaleString()}` : "—"}
          sublabel="market rate (indicative)"
          tooltip="Used for the approximate dollar figures shown here — for display only."
        />
      </div>

      <div id="rent-payments" className="card border-accent/20 bg-accent/5">
        <h2 className="font-semibold text-fg">Record rent &amp; other income</h2>
        <p className="text-sm text-fg-muted mt-1 max-w-3xl">
          Post a payment in ETH for this property. The amount is split across
          current co-owners right away, based on their stakes. In day-to-day use,
          whoever runs the property&apos;s books (manager, lead partner, or
          back-office) records income here after rent is collected. In a preview
          environment, you can use test funds to see the flow end to end.
        </p>
        {data?.share && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-fg-muted">On-chain account</span>
            <AddressPill address={data.share} showFull className="text-[11px]" />
            <a
              href={`https://sepolia.etherscan.io/address/${data.share}#code`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-accent hover:underline"
            >
              View public record ↗
            </a>
          </div>
        )}
        {paused && (
          <p className="text-xs text-warning mt-3">
            <strong>Income is paused for this property.</strong> A property
            operator can turn deposits back on when ready.
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
            Add payment
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
            <strong>Payouts are paused for this property.</strong> You&apos;ll be able
            to claim again when your operator re-opens them.
          </p>
        )}
      </div>
    </div>
  );
}
