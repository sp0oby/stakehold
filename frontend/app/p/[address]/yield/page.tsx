"use client";

import { useState } from "react";
import { parseEther } from "viem";
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { toast } from "sonner";
import { shareConfigFor, isValidAddress } from "@/lib/contracts";
import { useUserPosition } from "@/hooks/useUserPosition";
import { useProperty } from "@/hooks/useProperty";
import { useEthPrice } from "@/hooks/useEthPrice";
import { TxButton } from "@/components/TxButton";
import { StatCard } from "@/components/StatCard";
import { formatEth, formatShares, parseContractError } from "@/lib/format";

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

  const shareCfg = data?.share ? shareConfigFor(data.share) : undefined;

  const claim = useWriteContract();
  const claimTx = useWaitForTransactionReceipt({ hash: claim.data });
  if (claimTx.isSuccess) refetchPos();

  const distribute = useWriteContract();
  const distTx = useWaitForTransactionReceipt({ hash: distribute.data });
  if (distTx.isSuccess) {
    refetchPos();
    refetchProp();
  }

  const claimable = position?.claimableYield ?? 0n;
  const balance = position?.shareBalance ?? 0n;

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
          Rental income is deposited into the Share token as ETH and streamed to every
          shareholder pro-rata. Claims use a pull pattern — each holder pays their own
          claim gas.
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
                You don&rsquo;t hold any shares yet. Submit a contribution to become a co-owner.
              </p>
            )}
          </div>
          <TxButton
            onClick={doClaim}
            isPending={claim.isPending}
            isConfirming={claimTx.isLoading}
            disabled={claimable === 0n}
            className="!px-6 !py-3 !text-base"
          >
            Claim yield
          </TxButton>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-fg">Deposit rental income</h2>
        <p className="text-sm text-fg-muted mt-1">
          Anyone (property manager, rental platform, tenant) can call
          <code className="mx-1 font-mono text-xs bg-surface-2 px-1.5 py-0.5 rounded">
            distributeYield()
          </code>
          with ETH. The deposit is streamed into the per-share accumulator
          immediately and becomes claimable by all current holders.
        </p>

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
            disabled={!depositAmount}
            variant="secondary"
          >
            Deposit rental income
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
    </div>
  );
}
