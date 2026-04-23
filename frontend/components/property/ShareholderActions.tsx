"use client";

import { useEffect, useState } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { isAddress, getAddress, parseEther } from "viem";
import { toast } from "sonner";
import { shareConfigFor, CHAIN_ID } from "@/lib/contracts";
import { TxButton } from "@/components/TxButton";
import { AddressPill } from "@/components/AddressPill";
import { parseContractError, formatShares } from "@/lib/format";

/**
 * Shareholder actions — rendered on the property page for anyone with a
 * non-zero share balance. Covers the two workflows missing from the rest of
 * the UI:
 *
 *   - Transfer shares to another address (onboarding a partner, exiting a
 *     position without going through a secondary market)
 *   - Delegate voting power (self by default; can delegate to a trustee /
 *     steward without giving up economic exposure)
 */
export function ShareholderActions({
  shareAddress,
  wallet,
  balance,
}: {
  shareAddress: `0x${string}`;
  wallet: `0x${string}`;
  balance: bigint;
}) {
  return (
    <section className="card space-y-6">
      <header>
        <h2 className="font-semibold text-fg">My shares</h2>
        <p className="text-xs text-fg-muted mt-0.5">
          You hold <span className="font-medium text-fg">{formatShares(balance)}</span> on this property.
        </p>
      </header>
      <TransferShares shareAddress={shareAddress} balance={balance} />
      <DelegateVotes shareAddress={shareAddress} wallet={wallet} />
    </section>
  );
}

// ─── Transfer ──────────────────────────────────────────────────────────────
function TransferShares({
  shareAddress,
  balance,
}: {
  shareAddress: `0x${string}`;
  balance: bigint;
}) {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) {
      toast.success("Shares transferred");
      setTo("");
      setAmount("");
    }
  }, [isSuccess]);

  const balanceFloat = Number(balance) / 1e18;

  const run = () => {
    if (!isAddress(to)) return toast.error("Invalid recipient address");
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return toast.error("Enter a positive share amount");
    let wei: bigint;
    try {
      wei = parseEther(n.toString());
    } catch {
      return toast.error("Invalid amount");
    }
    if (wei > balance) return toast.error("Amount exceeds your balance");

    writeContract(
      {
        ...shareConfigFor(shareAddress),
        functionName: "transfer",
        args: [getAddress(to), wei],
      },
      { onError: (e) => toast.error(parseContractError(e)) }
    );
  };

  return (
    <Subsection title="Transfer shares" hint="Standard ERC-20 transfer. Recipient auto-delegates on first receipt.">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
        <label>
          <span className="stat-label">Recipient</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="0x…"
            className="mt-1.5 w-full rounded-lg bg-surface-2 border border-border px-3 py-2 text-fg placeholder:text-fg-muted focus:outline-none focus:border-accent"
          />
        </label>
        <label>
          <span className="stat-label">Amount</span>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-32 rounded-lg bg-surface-2 border border-border px-3 py-2 text-fg placeholder:text-fg-muted focus:outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => setAmount(balanceFloat.toString())}
              className="text-xs text-accent hover:underline"
            >
              max
            </button>
          </div>
        </label>
      </div>
      <TxButton
        onClick={run}
        isPending={isPending}
        isConfirming={isConfirming}
        disabled={!to || !amount}
        className="mt-3"
      >
        Send shares
      </TxButton>
    </Subsection>
  );
}

// ─── Delegate ──────────────────────────────────────────────────────────────
function DelegateVotes({
  shareAddress,
  wallet,
}: {
  shareAddress: `0x${string}`;
  wallet: `0x${string}`;
}) {
  const [to, setTo] = useState("");

  const delegateRead = useReadContract({
    ...shareConfigFor(shareAddress),
    functionName: "delegates",
    args: [wallet],
    chainId: CHAIN_ID,
    query: { refetchInterval: 30_000 },
  });
  const current = delegateRead.data as `0x${string}` | undefined;

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) {
      toast.success("Delegation updated");
      setTo("");
      delegateRead.refetch();
    }
  }, [isSuccess, delegateRead]);

  const runDelegateSelf = () => delegate(wallet);
  const runDelegateOther = () => {
    if (!isAddress(to)) return toast.error("Invalid address");
    delegate(getAddress(to));
  };

  const delegate = (delegatee: `0x${string}`) => {
    writeContract(
      {
        ...shareConfigFor(shareAddress),
        functionName: "delegate",
        args: [delegatee],
      },
      { onError: (e) => toast.error(parseContractError(e)) }
    );
  };

  const noDelegate =
    !current || current === "0x0000000000000000000000000000000000000000";
  const selfDelegated = current && current.toLowerCase() === wallet.toLowerCase();

  return (
    <Subsection
      title="Voting power"
      hint={
        noDelegate
          ? "Your shares currently have no voting power — delegate to activate."
          : selfDelegated
          ? "Delegated to yourself. Votes are active."
          : "Delegated to another address."
      }
    >
      <div className="flex items-center gap-2 text-sm mb-3">
        <span className="text-fg-muted">Current delegate:</span>
        {current ? <AddressPill address={current} /> : <span className="text-fg-muted">—</span>}
      </div>
      {!selfDelegated && (
        <TxButton
          onClick={runDelegateSelf}
          isPending={isPending}
          isConfirming={isConfirming}
          variant="secondary"
          className="mb-3"
        >
          Delegate to myself
        </TxButton>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
        <label>
          <span className="stat-label">Delegate to a different address</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="0x…"
            className="mt-1.5 w-full rounded-lg bg-surface-2 border border-border px-3 py-2 text-fg placeholder:text-fg-muted focus:outline-none focus:border-accent"
          />
        </label>
        <TxButton
          onClick={runDelegateOther}
          isPending={isPending}
          isConfirming={isConfirming}
          disabled={!to}
        >
          Delegate
        </TxButton>
      </div>
    </Subsection>
  );
}

// ─── shared ────────────────────────────────────────────────────────────────
function Subsection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-border pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <h3 className="font-semibold text-sm text-fg">{title}</h3>
        {hint && <span className="text-xs text-fg-muted text-right max-w-xs">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
