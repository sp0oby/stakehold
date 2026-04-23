"use client";

import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useAccount,
} from "wagmi";
import { toast } from "sonner";
import { useContributions } from "@/hooks/useContributions";
import { useProperty } from "@/hooks/useProperty";
import { useUserGrants, type UserGrant } from "@/hooks/useUserPosition";
import { propertyConfigFor, isValidAddress } from "@/lib/contracts";
import { TxButton } from "@/components/TxButton";
import { AddressPill } from "@/components/AddressPill";
import { EmptyState } from "@/components/EmptyState";
import { formatShares, formatUsd, parseContractError, relativeTime } from "@/lib/format";

export default function RebalancePage({
  params,
}: {
  params: { address: string };
}) {
  const { address } = params;
  const valid = isValidAddress(address);
  const { data } = useProperty(valid ? address : undefined);
  const { contributions, loading, refetch } = useContributions(valid ? address : undefined);
  const { address: wallet } = useAccount();
  const { grants } = useUserGrants(valid ? address : undefined, wallet);

  const executable = contributions.filter(
    (c) => c.status === 1 && c.proposalId === 0n
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Rebalance</h1>
        <p className="text-fg-muted mt-2">
          Approved contributions wait for a timelock, then anyone can execute
          them to mint the contributor&rsquo;s (vested) shares. Your vested grants
          appear here once the 6-month cliff completes.
        </p>
      </div>

      <section>
        <h2 className="font-semibold text-fg mb-3">Pending executions</h2>
        {loading ? (
          <div className="card">Loading…</div>
        ) : executable.length === 0 ? (
          <EmptyState
            title="Nothing to execute right now"
            description="Submit a contribution from the Contribute tab to see it here after the timelock."
          />
        ) : (
          <ul className="space-y-3">
            {executable.map((c) => (
              <ExecuteCard
                key={c.id.toString()}
                propertyAddress={address as `0x${string}`}
                totalSupply={data?.totalShares}
                timelockDelay={data?.timelockDelay ?? 0n}
                contribId={c.id}
                valueUsd={c.valueUsd}
                contributor={c.contributor}
                submittedAt={c.submittedAt}
                refetch={refetch}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-semibold text-fg mb-3">Your vesting grants</h2>
        {!wallet ? (
          <EmptyState
            title="Connect your wallet"
            description="Your personal vesting schedule appears here once you connect."
          />
        ) : grants.length === 0 ? (
          <EmptyState
            title="No vesting grants yet"
            description="When you contribute and the DAO approves it, your shares vest here for 6 months before you can claim them."
          />
        ) : (
          <ul className="space-y-3">
            {grants.map((g) => (
              <GrantCard
                key={g.grantId.toString()}
                propertyAddress={address as `0x${string}`}
                grant={g}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ExecuteCard({
  propertyAddress,
  totalSupply,
  timelockDelay,
  contribId,
  valueUsd,
  contributor,
  submittedAt,
  refetch,
}: {
  propertyAddress: `0x${string}`;
  totalSupply: bigint | undefined;
  timelockDelay: bigint;
  contribId: bigint;
  valueUsd: bigint;
  contributor: `0x${string}`;
  submittedAt: bigint;
  refetch: () => void;
}) {
  const { data: preview } = useReadContract({
    ...propertyConfigFor(propertyAddress),
    functionName: "previewRebalance",
    args: [contribId],
  });

  const readyAt = submittedAt + timelockDelay;
  const now = BigInt(Math.floor(Date.now() / 1000));
  const isReady = now >= readyAt;

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  if (isSuccess) refetch();

  const [sharesToMint, newSupply] =
    (preview as readonly [bigint, bigint, bigint] | undefined) ?? [0n, 0n, 0n];

  const currentPct =
    totalSupply && sharesToMint > 0n && newSupply > 0n
      ? (Number(sharesToMint) / Number(newSupply)) * 100
      : 0;

  const execute = () => {
    writeContract(
      {
        ...propertyConfigFor(propertyAddress),
        functionName: "executeAutoApproved",
        args: [contribId],
      },
      {
        onSuccess: () => toast.success("Execution tx sent"),
        onError: (e) => toast.error(parseContractError(e)),
      }
    );
  };

  return (
    <li className="card space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-fg-muted">#{contribId.toString()}</span>
            <span className={`chip ${isReady ? "text-success" : "text-warning"}`}>
              {isReady ? "Ready" : "Timelocked"}
            </span>
          </div>
          <h3 className="text-lg font-semibold mt-2">{formatUsd(valueUsd)} contribution</h3>
          <div className="text-sm text-fg-muted flex items-center gap-2 mt-1">
            by <AddressPill address={contributor} />
          </div>
        </div>
        <div className="text-right text-xs text-fg-muted">
          {isReady ? "Ready to execute" : `Unlocks ${relativeTime(readyAt)}`}
        </div>
      </div>

      <div className="bg-surface-2/60 border border-border rounded-lg p-3 text-sm space-y-1">
        <div className="text-xs stat-label">Rebalance preview</div>
        <div className="flex justify-between">
          <span className="text-fg-muted">Shares to mint</span>
          <span className="font-mono tabular-nums">{formatShares(sharesToMint)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-fg-muted">New stake</span>
          <span className="font-mono tabular-nums">{currentPct.toFixed(3)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-fg-muted">Vesting cliff</span>
          <span>6 months from execution</span>
        </div>
      </div>

      <TxButton
        onClick={execute}
        isPending={isPending}
        isConfirming={isConfirming}
        disabled={!isReady}
        fullWidth
      >
        Execute rebalance
      </TxButton>
    </li>
  );
}

function GrantCard({
  propertyAddress,
  grant,
}: {
  propertyAddress: `0x${string}`;
  grant: UserGrant;
}) {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const cliffReached = now >= grant.cliffEnd;

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const claim = () => {
    writeContract(
      {
        ...propertyConfigFor(propertyAddress),
        functionName: "claimVestedShares",
        args: [grant.grantId],
      },
      {
        onSuccess: () => toast.success("Claim tx sent"),
        onError: (e) => toast.error(parseContractError(e)),
      }
    );
  };

  return (
    <li className="card flex items-center justify-between gap-4 flex-wrap">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-fg-muted">
            grant #{grant.grantId.toString()}
          </span>
          {grant.claimed ? (
            <span className="chip text-success">Claimed</span>
          ) : grant.claimable ? (
            <span className="chip text-accent">Ready</span>
          ) : (
            <span className="chip text-warning">Vesting</span>
          )}
        </div>
        <div className="text-lg font-semibold mt-1">{formatShares(grant.shares)}</div>
        {!cliffReached && !grant.claimed && (
          <div className="text-xs text-fg-muted mt-1">
            Cliff ends {relativeTime(grant.cliffEnd)}
          </div>
        )}
      </div>
      {!grant.claimed && (
        <TxButton
          onClick={claim}
          isPending={isPending}
          isConfirming={isConfirming}
          disabled={!grant.claimable}
          variant="primary"
        >
          Claim shares
        </TxButton>
      )}
    </li>
  );
}
