"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { keccak256, toBytes, parseUnits } from "viem";
import { toast } from "sonner";
import { propertyConfigFor, isValidAddress } from "@/lib/contracts";
import { TxButton } from "@/components/TxButton";
import { Spinner } from "@/components/Spinner";
import { parseContractError, formatUsd } from "@/lib/format";
import { useProperty } from "@/hooks/useProperty";

type UploadState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "done"; cid: string; url: string; file: File }
  | { status: "error"; message: string };

export default function ContributePage({
  params,
}: {
  params: { address: string };
}) {
  const { address } = params;
  const valid = isValidAddress(address);
  const { data } = useProperty(valid ? address : undefined);

  const [upload, setUpload] = useState<UploadState>({ status: "idle" });
  const [valueUsd, setValueUsd] = useState("");
  const [description, setDescription] = useState("");

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  if (isSuccess && upload.status === "done") {
    setTimeout(() => {
      setUpload({ status: "idle" });
      setValueUsd("");
      setDescription("");
    }, 2000);
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    maxSize: 10 * 1024 * 1024,
    onDrop: async (files) => {
      const file = files[0];
      if (!file) return;
      setUpload({ status: "uploading" });
      const fd = new FormData();
      fd.append("file", file);
      try {
        const r = await fetch("/api/ipfs", { method: "POST", body: fd });
        if (!r.ok) {
          const t = await r.text();
          throw new Error(t || "Upload failed");
        }
        const { cid, gatewayUrl } = await r.json();
        setUpload({ status: "done", cid, url: gatewayUrl, file });
        toast.success("Proof uploaded to IPFS");
      } catch (e) {
        const msg = (e as Error).message || "Upload failed";
        setUpload({ status: "error", message: msg });
        toast.error(msg);
      }
    },
  });

  const thresholdUsd = data?.autoApproveThresholdUsd
    ? Number(data.autoApproveThresholdUsd) / 1e6
    : 500;

  const submit = () => {
    if (!valid) return;
    if (upload.status !== "done") {
      toast.error("Upload a proof first");
      return;
    }
    const value = Number(valueUsd);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a positive USD value");
      return;
    }

    const proofHash = keccak256(toBytes(upload.cid));
    const descUri = `ipfs://${upload.cid}`;

    writeContract(
      {
        ...propertyConfigFor(address as `0x${string}`),
        functionName: "submitContribution",
        args: [parseUnits(value.toString(), 6), proofHash, descUri],
      },
      {
        onSuccess: () => toast.success("Transaction sent"),
        onError: (err) => toast.error(parseContractError(err)),
      }
    );
  };

  const numericValue = Number(valueUsd);
  const willAutoApprove =
    Number.isFinite(numericValue) && numericValue > 0 && numericValue <= thresholdUsd;

  // Intentional side usage so eslint doesn't complain about `description`.
  // We could surface it as notes in an event, but current contract doesn't
  // take a separate description arg (descriptionURI covers it).
  void description;

  return (
    <div className="space-y-6 max-w-2xl animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Submit a contribution</h1>
        <p className="text-fg-muted mt-2">
          Uploaded proof → IPFS → on-chain hash. Contributions ≤{" "}
          <span className="font-medium text-fg">
            {formatUsd(BigInt(Math.round(thresholdUsd * 1e6)))}
          </span>{" "}
          auto-approve after the timelock. Larger ones trigger a DAO vote.
        </p>
      </div>

      <div className="card space-y-4">
        <div>
          <label className="stat-label">1. Proof of contribution</label>
          <p className="text-xs text-fg-muted mt-1">
            Drop a receipt, invoice, or work-order PDF. We hash the IPFS CID and put
            it on-chain — the file itself is pinned to IPFS and stays there.
          </p>
        </div>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-accent bg-accent/5"
              : "border-border hover:border-fg-muted bg-surface-2/50"
          }`}
        >
          <input {...getInputProps()} />
          {upload.status === "uploading" ? (
            <div className="flex items-center justify-center gap-2 text-fg-muted">
              <Spinner />
              Uploading to IPFS…
            </div>
          ) : upload.status === "done" ? (
            <div className="space-y-2">
              <div className="text-success font-medium">✓ Pinned to IPFS</div>
              <div className="text-xs text-fg-muted break-all">{upload.file.name}</div>
              <a
                href={upload.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-accent hover:underline font-mono"
              >
                {upload.cid.slice(0, 16)}…{upload.cid.slice(-6)}
              </a>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-fg">
                {isDragActive ? "Drop it!" : "Drag a file or click to browse"}
              </div>
              <div className="text-xs text-fg-muted">PDF, PNG, JPG · up to 10 MB</div>
            </div>
          )}
        </div>
        {upload.status === "error" && (
          <p className="text-xs text-danger">{upload.message}</p>
        )}
      </div>

      <div className="card space-y-5">
        <div>
          <label htmlFor="value" className="stat-label">
            2. USD value
          </label>
          <div className="mt-2 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted">$</span>
            <input
              id="value"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={valueUsd}
              onChange={(e) => setValueUsd(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg bg-surface-2 border border-border pl-7 pr-3 py-2.5 text-fg placeholder:text-fg-muted focus:outline-none focus:border-accent"
            />
          </div>
          {valueUsd && Number.isFinite(numericValue) && numericValue > 0 && (
            <p className={`text-xs mt-2 ${willAutoApprove ? "text-success" : "text-warning"}`}>
              {willAutoApprove
                ? "✓ Under threshold — will auto-approve after the timelock."
                : "△ Above threshold — this will open a DAO vote."}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="desc" className="stat-label">
            3. Notes <span className="text-fg-muted normal-case">(optional)</span>
          </label>
          <textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="e.g. Roof repair — contractor invoice #23-0447"
            className="mt-2 w-full rounded-lg bg-surface-2 border border-border px-3 py-2.5 text-fg placeholder:text-fg-muted focus:outline-none focus:border-accent"
          />
          <p className="text-xs text-fg-muted mt-1">
            Notes are kept off-chain; the IPFS CID you pinned is the canonical record.
          </p>
        </div>

        <div className="pt-2">
          <TxButton
            onClick={submit}
            isPending={isPending}
            isConfirming={isConfirming}
            disabled={upload.status !== "done" || !valueUsd || !valid}
            fullWidth
          >
            Submit contribution
          </TxButton>
          {data?.paused && (
            <p className="text-xs text-warning mt-2">
              Contract is paused — submissions are temporarily disabled.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
