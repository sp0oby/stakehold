"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits, decodeEventLog, isAddress, getAddress } from "viem";
import { toast } from "sonner";
import { factoryConfig, factoryAbi, PropertyType } from "@/lib/contracts";
import { TxButton } from "@/components/TxButton";
import { ConnectGate } from "@/components/ConnectGate";
import { formatEth, parseContractError } from "@/lib/format";

// Total share supply per property is fixed by the Share contract at 1,000,000.
// We work in basis points (0..10000) for UI precision (2 decimal places).
// 1 bps  = 0.01%  = 100 shares
// 10000  = 100%   = 1,000,000 shares
const TOTAL_BPS = 10_000;
const SHARES_PER_BPS = 100n * 10n ** 18n; // 100 shares in 1e18 units

type FounderRow = {
  id: string;
  address: string;
  /** Percentage as a decimal string (e.g. "33.33"). */
  percentage: string;
};

type FormState = {
  tokenName: string;
  tokenSymbol: string;
  displayName: string;
  city: string;
  propertyType: number;
  publicMetadataURI: string;
  legalDocsURI: string;
  propertyValueUsd: string;
};

const initialForm: FormState = {
  tokenName: "",
  tokenSymbol: "",
  displayName: "",
  city: "",
  propertyType: PropertyType.Residential,
  publicMetadataURI: "",
  legalDocsURI: "",
  propertyValueUsd: "",
};

function pctToBps(pct: string): number {
  const n = Number(pct);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100); // 2 decimals of precision
}

function rid() {
  return Math.random().toString(36).slice(2, 9);
}

export default function LaunchPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [form, setForm] = useState<FormState>(initialForm);
  const [founders, setFounders] = useState<FounderRow[]>(() => [
    { id: rid(), address: "", percentage: "100" },
  ]);

  // When the wallet connects, prefill the first row with the connected address
  // unless the user has already typed something.
  useEffect(() => {
    if (!address) return;
    setFounders((rows) => {
      if (rows.length === 1 && rows[0].address === "") {
        return [{ ...rows[0], address }];
      }
      return rows;
    });
  }, [address]);

  const { data: launchFee } = useReadContract({
    ...factoryConfig,
    functionName: "launchFee",
  });
  const feeWei = (launchFee as bigint | undefined) ?? 0n;

  const { writeContract, data: hash, isPending } = useWriteContract();
  const {
    isLoading: isConfirming,
    isSuccess,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash });

  // Pull the new property address out of the PropertyCreated event so we can
  // navigate straight to /p/[address] after confirmation.
  const newPropertyAddr = useMemo(() => {
    if (!receipt) return undefined;
    for (const log of receipt.logs) {
      try {
        const parsed = decodeEventLog({
          abi: factoryAbi,
          data: log.data,
          topics: log.topics,
        });
        if (parsed.eventName === "PropertyCreated") {
          return (parsed.args as unknown as { property: `0x${string}` }).property;
        }
      } catch {
        /* not our event — move on */
      }
    }
    return undefined;
  }, [receipt]);

  if (isSuccess && newPropertyAddr) {
    setTimeout(() => router.push(`/p/${newPropertyAddr}`), 1500);
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // ── Founder row helpers ───────────────────────────────────────────────────
  const totalBps = founders.reduce((sum, r) => sum + pctToBps(r.percentage), 0);
  const remainderBps = TOTAL_BPS - totalBps;
  const sumExact = totalBps === TOTAL_BPS;

  const addFounder = () => {
    if (founders.length >= 20) return;
    setFounders((rows) => [
      ...rows,
      { id: rid(), address: "", percentage: "" },
    ]);
  };

  const removeFounder = (id: string) => {
    setFounders((rows) => (rows.length === 1 ? rows : rows.filter((r) => r.id !== id)));
  };

  const updateFounder = (id: string, patch: Partial<FounderRow>) => {
    setFounders((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const balanceLastRow = () => {
    setFounders((rows) => {
      if (rows.length === 0) return rows;
      const headBps = rows
        .slice(0, -1)
        .reduce((s, r) => s + pctToBps(r.percentage), 0);
      const tailBps = Math.max(0, TOTAL_BPS - headBps);
      const tailPct = (tailBps / 100).toFixed(2).replace(/\.?0+$/, "");
      return [
        ...rows.slice(0, -1),
        { ...rows[rows.length - 1], percentage: tailPct || "0" },
      ];
    });
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const founderErrors: Record<string, string> = {};
  const seenAddrs = new Set<string>();
  for (const r of founders) {
    if (!r.address) {
      founderErrors[r.id] = "Address required";
    } else if (!isAddress(r.address)) {
      founderErrors[r.id] = "Not a valid address";
    } else {
      const lower = r.address.toLowerCase();
      if (seenAddrs.has(lower)) founderErrors[r.id] = "Duplicate address";
      else seenAddrs.add(lower);
    }
    if (!founderErrors[r.id]) {
      const bps = pctToBps(r.percentage);
      if (bps <= 0) founderErrors[r.id] = "Percentage must be > 0";
    }
  }

  const capTableValid =
    Object.keys(founderErrors).length === 0 && sumExact && founders.length > 0;

  // ── Submit ────────────────────────────────────────────────────────────────
  const submit = () => {
    if (!address) return;

    const valueUsd = Number(form.propertyValueUsd);
    if (!form.tokenName || !form.tokenSymbol) {
      toast.error("Token name and symbol are required");
      return;
    }
    if (!form.displayName || !form.city) {
      toast.error("Display name and city are required");
      return;
    }
    if (!Number.isFinite(valueUsd) || valueUsd <= 0) {
      toast.error("Enter a positive property value");
      return;
    }
    if (!capTableValid) {
      toast.error("Cap table must total exactly 100% with valid addresses");
      return;
    }

    // Convert rows to share allocations in 1e18 units.
    // We work in basis points to avoid float drift; any residual goes to the
    // last row (which `balanceLastRow` already makes exact via the UI).
    const holders: `0x${string}`[] = [];
    const amounts: bigint[] = [];
    let runningBps = 0;
    for (let i = 0; i < founders.length; i++) {
      const r = founders[i];
      const bps = BigInt(pctToBps(r.percentage));
      let shares: bigint;
      if (i === founders.length - 1) {
        // Last row absorbs any rounding residual so the sum is exact.
        const remainder = BigInt(TOTAL_BPS - runningBps);
        shares = remainder * SHARES_PER_BPS;
      } else {
        shares = bps * SHARES_PER_BPS;
        runningBps += Number(bps);
      }
      holders.push(getAddress(r.address));
      amounts.push(shares);
    }

    writeContract(
      {
        ...factoryConfig,
        functionName: "createProperty",
        value: feeWei,
        args: [
          {
            tokenName: form.tokenName,
            tokenSymbol: form.tokenSymbol,
            displayName: form.displayName,
            city: form.city,
            propertyType: form.propertyType,
            publicMetadataURI: form.publicMetadataURI || "ipfs://",
            legalDocsURI: form.legalDocsURI || "ipfs://",
            propertyValueUsd: parseUnits(valueUsd.toString(), 6),
            admin: address,
            initialHolders: holders,
            initialAmounts: amounts,
          },
        ],
      },
      {
        onSuccess: () => toast.success("Deployment tx sent"),
        onError: (e) => toast.error(parseContractError(e)),
      }
    );
  };

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold">Launch a property</h1>
        <p className="text-fg-muted mt-2 mb-6">
          Deploy a new Share token + governance pair via the Stakehold factory.
          Connect a wallet to get started.
        </p>
        <ConnectGate>
          <span />
        </ConnectGate>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Launch a property</h1>
        <p className="text-fg-muted mt-2">
          Deploy a new Share token + governance pair via the Stakehold factory.
          The factory atomically configures both proxies, grants mint rights to
          the governance contract, and renounces itself. You become DAO admin.
        </p>
      </div>

      {/* Launch fee banner */}
      <div className="card bg-accent/5 border-accent/30 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="stat-label">Flat launch fee</div>
          <div className="text-lg font-semibold tabular-nums">
            {formatEth(feeWei)} ETH
          </div>
          <p className="text-xs text-fg-muted mt-1">
            Forwarded to the protocol treasury on success. Overpayment is
            refunded.
          </p>
        </div>
      </div>

      {/* Identity */}
      <section className="card space-y-4">
        <h2 className="font-semibold">Identity</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Display name"
            placeholder="Brooklyn Brownstone"
            value={form.displayName}
            onChange={(v) => update("displayName", v)}
          />
          <Field
            label="City / region (public)"
            placeholder="Brooklyn, NY"
            value={form.city}
            onChange={(v) => update("city", v)}
          />
          <Field
            label="Share token name"
            placeholder="Brooklyn Brownstone Shares"
            value={form.tokenName}
            onChange={(v) => update("tokenName", v)}
          />
          <Field
            label="Share token symbol"
            placeholder="BKS"
            value={form.tokenSymbol}
            onChange={(v) => update("tokenSymbol", v.toUpperCase().slice(0, 8))}
          />
          <Field
            label="Property type"
            select={[
              { label: "Residential", value: 0 },
              { label: "Commercial", value: 1 },
              { label: "Mixed use", value: 2 },
              { label: "Land", value: 3 },
              { label: "Other", value: 4 },
            ]}
            value={String(form.propertyType)}
            onChange={(v) => update("propertyType", Number(v))}
          />
          <Field
            label="Property value (USD)"
            type="number"
            placeholder="500000"
            value={form.propertyValueUsd}
            onChange={(v) => update("propertyValueUsd", v)}
            prefix="$"
          />
        </div>
      </section>

      {/* Cap table */}
      <section className="card space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-semibold">Founding cap table</h2>
            <p className="text-xs text-fg-muted mt-1 max-w-md">
              Split the 1,000,000 initial shares across co-founders / partners.
              Each holder gets auto-delegated voting power on launch. Shares are
              fully transferable afterwards.
            </p>
          </div>
          <div
            className={`text-sm font-mono tabular-nums px-3 py-1.5 rounded-lg border ${
              sumExact
                ? "text-success border-success/40 bg-success/10"
                : totalBps > TOTAL_BPS
                ? "text-danger border-danger/40 bg-danger/10"
                : "text-warning border-warning/40 bg-warning/10"
            }`}
          >
            {(totalBps / 100).toFixed(2)}% / 100.00%
          </div>
        </div>

        <div className="space-y-2">
          {founders.map((r, i) => {
            const err = founderErrors[r.id];
            const bps = pctToBps(r.percentage);
            const shares = Math.floor((bps * 1_000_000) / TOTAL_BPS);
            return (
              <div key={r.id} className="space-y-1">
                <div className="flex gap-2 items-start">
                  <div className="flex-1 min-w-0">
                    <input
                      value={r.address}
                      onChange={(e) =>
                        updateFounder(r.id, { address: e.target.value.trim() })
                      }
                      placeholder="0x…  (EVM address)"
                      className={`w-full rounded-lg bg-surface-2 border px-3 py-2.5 text-fg placeholder:text-fg-muted focus:outline-none font-mono text-sm ${
                        err && r.address
                          ? "border-danger/60 focus:border-danger"
                          : "border-border focus:border-accent"
                      }`}
                    />
                  </div>
                  <div className="relative w-32 shrink-0">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      inputMode="decimal"
                      value={r.percentage}
                      onChange={(e) =>
                        updateFounder(r.id, { percentage: e.target.value })
                      }
                      placeholder="0.00"
                      className="w-full rounded-lg bg-surface-2 border border-border pl-3 pr-7 py-2.5 text-fg placeholder:text-fg-muted focus:outline-none focus:border-accent tabular-nums text-right"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted text-sm">
                      %
                    </span>
                  </div>
                  <button
                    onClick={() => removeFounder(r.id)}
                    disabled={founders.length === 1}
                    className="shrink-0 h-[42px] w-[42px] rounded-lg border border-border text-fg-muted hover:text-danger hover:border-danger/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                    aria-label="Remove founder"
                  >
                    ×
                  </button>
                </div>
                <div className="flex justify-between px-1 text-xs text-fg-muted">
                  <span>
                    {err ? (
                      <span className="text-danger">{err}</span>
                    ) : r.address.toLowerCase() === address?.toLowerCase() ? (
                      <span>You</span>
                    ) : (
                      <span>Founder #{i + 1}</span>
                    )}
                  </span>
                  <span className="tabular-nums">
                    {bps > 0 ? `${shares.toLocaleString()} shares` : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={addFounder}
            disabled={founders.length >= 20}
            className="btn-secondary text-sm"
          >
            + Add founder
          </button>
          {!sumExact && founders.length > 0 && (
            <button
              onClick={balanceLastRow}
              className="btn-secondary text-sm"
              title="Set the last row to absorb the remaining percentage"
            >
              {remainderBps >= 0
                ? `Balance last row to 100% (+${(remainderBps / 100).toFixed(2)}%)`
                : `Trim last row (${(remainderBps / 100).toFixed(2)}%)`}
            </button>
          )}
        </div>
      </section>

      {/* Media */}
      <section className="card space-y-4">
        <h2 className="font-semibold">Metadata</h2>
        <Field
          label="Public media URI"
          placeholder="ipfs://bafy…"
          value={form.publicMetadataURI}
          onChange={(v) => update("publicMetadataURI", v)}
          hint="Photos, description, type-appropriate public info. Anyone can read."
        />
        <Field
          label="Legal docs URI (gated)"
          placeholder="ipfs://bafy…"
          value={form.legalDocsURI}
          onChange={(v) => update("legalDocsURI", v)}
          hint="Full street address, deeds, insurance. Only revealed to shareholders in the UI."
        />
      </section>

      <div className="sticky bottom-4 flex flex-wrap justify-end gap-3">
        <Link href="/properties" className="btn-secondary">
          Cancel
        </Link>
        <TxButton
          onClick={submit}
          isPending={isPending}
          isConfirming={isConfirming}
          disabled={!capTableValid}
        >
          Launch property ({formatEth(feeWei)} ETH)
        </TxButton>
      </div>

      {isSuccess && newPropertyAddr && (
        <div className="card bg-success/5 border-success/30">
          <p className="text-sm">
            ✓ Property deployed at{" "}
            <span className="font-mono text-xs">{newPropertyAddr}</span>. Redirecting…
          </p>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  prefix,
  hint,
  select,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  prefix?: string;
  hint?: string;
  select?: { label: string; value: number }[];
}) {
  return (
    <label className="block">
      <span className="stat-label">{label}</span>
      <div className="relative mt-1.5">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted text-sm">
            {prefix}
          </span>
        )}
        {select ? (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg bg-surface-2 border border-border px-3 py-2.5 text-fg focus:outline-none focus:border-accent"
          >
            {select.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={type}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full rounded-lg bg-surface-2 border border-border py-2.5 text-fg placeholder:text-fg-muted focus:outline-none focus:border-accent ${
              prefix ? "pl-7 pr-3" : "px-3"
            }`}
          />
        )}
      </div>
      {hint && <p className="text-xs text-fg-muted mt-1.5">{hint}</p>}
    </label>
  );
}
