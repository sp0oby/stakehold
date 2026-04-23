"use client";

import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { isAddress, getAddress, parseUnits } from "viem";
import { toast } from "sonner";
import { propertyConfigFor } from "@/lib/contracts";
import { Spinner } from "@/components/Spinner";
import { TxButton } from "@/components/TxButton";
import { parseContractError } from "@/lib/format";
import { isResolvableIpfs } from "@/lib/ipfs";
import type { PropertyDetail } from "@/hooks/useProperty";
import { ROLES, type RoleFlags } from "@/hooks/useIsAdmin";

/**
 * AdminPanel — rendered on the property overview page when the connected
 * wallet holds any admin-flavoured role on the property. Surfaces every
 * admin-gated function of StakeholdProperty in one place:
 *
 *   - Rotate legal docs URI (upload → setLegalDocsURI)
 *   - Pause / unpause governance + transfers (not yield claims)
 *   - Update governance parameters (threshold, voting period, timelock, quorum)
 *   - Cancel a pending / approved contribution
 *   - Grant admin-like roles to another address (e.g. a Safe multisig)
 *
 * Each subsection owns its own transaction state so the user can fire them
 * independently without being blocked by another pending confirmation.
 */
export function AdminPanel({
  propertyAddress,
  data,
  roles,
}: {
  propertyAddress: `0x${string}`;
  data: PropertyDetail;
  roles: RoleFlags;
}) {
  return (
    <section className="card border-warning/25 bg-warning/5 space-y-6">
      <header className="flex items-center gap-3">
        <span className="inline-flex chip border-warning/30 bg-warning/10 text-warning text-xs">
          Admin only
        </span>
        <div>
          <h2 className="font-semibold text-fg">Property admin</h2>
          <p className="text-xs text-fg-muted mt-0.5">
            You have{" "}
            {[
              roles.isAdmin ? "DEFAULT_ADMIN" : null,
              roles.isPauser ? "PAUSER" : null,
              roles.isUpgrader ? "UPGRADER" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </header>

      {roles.isAdmin && <LegalDocsRotator propertyAddress={propertyAddress} data={data} />}
      {roles.isPauser && <PauseToggle propertyAddress={propertyAddress} paused={data.paused} />}
      {roles.isAdmin && <GovernanceParams propertyAddress={propertyAddress} data={data} />}
      {roles.isAdmin && <CancelContribution propertyAddress={propertyAddress} />}
      {roles.isAdmin && <RoleGrant propertyAddress={propertyAddress} />}
    </section>
  );
}

// ─── Legal docs ────────────────────────────────────────────────────────────
function LegalDocsRotator({
  propertyAddress,
  data,
}: {
  propertyAddress: `0x${string}`;
  data: PropertyDetail;
}) {
  const [cid, setCid] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) {
      toast.success("Legal docs URI updated");
      setCid(null);
    }
  }, [isSuccess]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    maxSize: 15 * 1024 * 1024,
    onDrop: async (files) => {
      const file = files[0];
      if (!file) return;
      setUploading(true);
      setUploadError(null);
      const fd = new FormData();
      fd.append("file", file);
      try {
        const r = await fetch("/api/ipfs", { method: "POST", body: fd });
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Upload failed");
        setCid(json.cid);
        toast.success("Uploaded — confirm the on-chain rotate below");
      } catch (e) {
        const msg = (e as Error).message || "Upload failed";
        setUploadError(msg);
        toast.error(msg);
      } finally {
        setUploading(false);
      }
    },
  });

  const rotate = () => {
    if (!cid) return;
    writeContract(
      {
        ...propertyConfigFor(propertyAddress),
        functionName: "setLegalDocsURI",
        args: [`ipfs://${cid}`],
      },
      { onError: (e) => toast.error(parseContractError(e)) }
    );
  };

  const currentIsReal = isResolvableIpfs(data.legalDocsURI);

  return (
    <Subsection title="Legal docs" hint={currentIsReal ? "A file is currently linked." : "No real file linked yet — upload one."}>
      <div className="text-xs text-fg-muted mb-2 break-all">
        Current: <code className="text-fg-muted/80">{data.legalDocsURI || "—"}</code>
      </div>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors text-sm ${
          isDragActive ? "border-accent bg-accent/5" : "border-border hover:border-fg-muted bg-surface-2/50"
        }`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-fg-muted">
            <Spinner /> Uploading…
          </div>
        ) : cid ? (
          <div className="text-success">
            ✓ Pinned{" "}
            <span className="font-mono text-xs text-fg-muted">
              {cid.slice(0, 14)}…{cid.slice(-6)}
            </span>
          </div>
        ) : (
          <div className="text-fg-muted">
            {isDragActive ? "Drop to upload" : "Drop deed / insurance PDF to replace"}
          </div>
        )}
      </div>
      {uploadError && <p className="text-xs text-danger mt-2">{uploadError}</p>}
      <TxButton
        onClick={rotate}
        isPending={isPending}
        isConfirming={isConfirming}
        disabled={!cid}
        className="mt-3"
        fullWidth
      >
        Set legal docs URI on-chain
      </TxButton>
    </Subsection>
  );
}

// ─── Pause / unpause ───────────────────────────────────────────────────────
function PauseToggle({
  propertyAddress,
  paused,
}: {
  propertyAddress: `0x${string}`;
  paused: boolean;
}) {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const toggle = () => {
    writeContract(
      {
        ...propertyConfigFor(propertyAddress),
        functionName: paused ? "unpause" : "pause",
        args: [],
      },
      { onError: (e) => toast.error(parseContractError(e)) }
    );
  };

  const busy = isPending || isConfirming;
  const label = isConfirming ? "Confirming…" : isPending ? "Confirm…" : paused ? "Unpause" : "Pause";

  return (
    <Subsection
      title="Emergency pause"
      hint="Halts contributions, proposals, transfers, and minting. Yield claims remain open."
    >
      <div className="flex items-center gap-2">
        <span
          className={`chip ${
            paused
              ? "border-danger/30 bg-danger/10 text-danger"
              : "border-success/25 bg-success/10 text-success"
          }`}
        >
          {paused ? "Paused" : "Active"}
        </span>
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            paused
              ? "border-success/30 bg-success/10 text-success hover:bg-success/20"
              : "border-danger/25 bg-transparent text-danger hover:bg-danger/10"
          }`}
        >
          {label}
        </button>
      </div>
    </Subsection>
  );
}

// ─── Governance params ─────────────────────────────────────────────────────
function GovernanceParams({
  propertyAddress,
  data,
}: {
  propertyAddress: `0x${string}`;
  data: PropertyDetail;
}) {
  const [thresholdUsd, setThresholdUsd] = useState(String(Number(data.autoApproveThresholdUsd) / 1e6));
  const [votingHours, setVotingHours] = useState(String(Number(data.votingPeriod) / 3600));
  const [timelockHours, setTimelockHours] = useState(String(Number(data.timelockDelay) / 3600));
  const [quorumPct, setQuorumPct] = useState(String(Number(data.quorumBps) / 100));

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) toast.success("Governance parameters updated");
  }, [isSuccess]);

  const save = () => {
    const threshold = Number(thresholdUsd);
    const voting = Number(votingHours);
    const timelock = Number(timelockHours);
    const quorum = Number(quorumPct);

    if (!Number.isFinite(threshold) || threshold < 0) return toast.error("Invalid threshold");
    if (!Number.isFinite(voting) || voting < 1 || voting > 24 * 30) return toast.error("Voting period must be 1h–30d");
    if (!Number.isFinite(timelock) || timelock < 0 || timelock > 24 * 30) return toast.error("Timelock must be 0h–30d");
    if (!Number.isFinite(quorum) || quorum <= 0 || quorum > 100) return toast.error("Quorum must be (0, 100]%");

    writeContract(
      {
        ...propertyConfigFor(propertyAddress),
        functionName: "setGovernanceParams",
        args: [
          parseUnits(threshold.toString(), 6),
          BigInt(Math.floor(voting * 3600)),
          BigInt(Math.floor(timelock * 3600)),
          Math.floor(quorum * 100),
        ],
      },
      { onError: (e) => toast.error(parseContractError(e)) }
    );
  };

  return (
    <Subsection title="Governance parameters" hint="Applies immediately. In-flight proposals use their original params.">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <LabeledInput label="Auto-approve threshold (USD)" value={thresholdUsd} onChange={setThresholdUsd} type="number" />
        <LabeledInput label="Voting period (hours)" value={votingHours} onChange={setVotingHours} type="number" />
        <LabeledInput label="Timelock delay (hours)" value={timelockHours} onChange={setTimelockHours} type="number" />
        <LabeledInput label="Quorum (%)" value={quorumPct} onChange={setQuorumPct} type="number" />
      </div>
      <TxButton onClick={save} isPending={isPending} isConfirming={isConfirming} className="mt-3">
        Save parameters
      </TxButton>
    </Subsection>
  );
}

// ─── Cancel contribution ───────────────────────────────────────────────────
function CancelContribution({ propertyAddress }: { propertyAddress: `0x${string}` }) {
  const [id, setId] = useState("");
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) {
      toast.success("Contribution cancelled");
      setId("");
    }
  }, [isSuccess]);

  const run = () => {
    const n = Number(id);
    if (!Number.isInteger(n) || n < 0) return toast.error("Enter a valid contribution id");
    writeContract(
      {
        ...propertyConfigFor(propertyAddress),
        functionName: "cancelContribution",
        args: [BigInt(n)],
      },
      { onError: (e) => toast.error(parseContractError(e)) }
    );
  };

  return (
    <Subsection
      title="Cancel a contribution"
      hint="Works for contributions still Pending or Approved. Executed / Rejected / Cancelled are immutable."
    >
      <div className="flex gap-2 items-end">
        <LabeledInput
          label="Contribution id"
          value={id}
          onChange={setId}
          type="number"
          className="flex-1"
        />
        <TxButton onClick={run} isPending={isPending} isConfirming={isConfirming} variant="danger" disabled={!id}>
          Cancel
        </TxButton>
      </div>
    </Subsection>
  );
}

// ─── Role grants ───────────────────────────────────────────────────────────
function RoleGrant({ propertyAddress }: { propertyAddress: `0x${string}` }) {
  const [grantee, setGrantee] = useState("");
  const [role, setRole] = useState<keyof typeof ROLES>("DEFAULT_ADMIN");

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) toast.success("Role granted");
  }, [isSuccess]);

  const run = () => {
    if (!isAddress(grantee)) return toast.error("Invalid address");
    const checksummed = getAddress(grantee);
    writeContract(
      {
        ...propertyConfigFor(propertyAddress),
        functionName: "grantRole",
        args: [ROLES[role], checksummed],
      },
      { onError: (e) => toast.error(parseContractError(e)) }
    );
  };

  return (
    <Subsection
      title="Grant a role"
      hint="Typical handoff: grant operator, pause, and upgrade access to a Safe multisig, confirm each role on-chain, then remove your own access from the block explorer when you are sure the multisig works."
    >
      <div className="space-y-2">
        <LabeledInput
          label="Grantee address (Safe multisig recommended)"
          value={grantee}
          onChange={setGrantee}
          placeholder="0x…"
        />
        <div className="flex gap-2 items-end">
          <label className="flex-1">
            <span className="stat-label">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as keyof typeof ROLES)}
              className="mt-1.5 w-full rounded-lg bg-surface-2 border border-border px-3 py-2 text-fg focus:outline-none focus:border-accent"
            >
              <option value="DEFAULT_ADMIN">DEFAULT_ADMIN (governance + metadata)</option>
              <option value="PAUSER">PAUSER (pause / unpause)</option>
              <option value="UPGRADER">UPGRADER (UUPS upgrades)</option>
            </select>
          </label>
          <TxButton onClick={run} isPending={isPending} isConfirming={isConfirming} disabled={!grantee}>
            Grant
          </TxButton>
        </div>
        <p className="text-xs text-fg-muted">
          Sequential grants (DEFAULT_ADMIN → PAUSER → UPGRADER) hand full control to a multisig without leaving a gap.
          To fully step down afterwards, renounce each role you still hold from the
          contract&apos;s &ldquo;Write&rdquo; screen in a block explorer once the
          multisig is live.
        </p>
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
    <div className="border-t border-warning/15 pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <h3 className="font-semibold text-sm text-fg">{title}</h3>
        {hint && <span className="text-xs text-fg-muted text-right max-w-xs">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="stat-label">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-lg bg-surface-2 border border-border px-3 py-2 text-fg placeholder:text-fg-muted focus:outline-none focus:border-accent"
      />
    </label>
  );
}
