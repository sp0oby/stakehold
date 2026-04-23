"use client";

import { useMemo } from "react";
import {
  useAccount,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { toast } from "sonner";
import { useProposals, type ProposalView } from "@/hooks/useProposals";
import { useContributions } from "@/hooks/useContributions";
import { useUserPosition } from "@/hooks/useUserPosition";
import { propertyConfigFor, isValidAddress } from "@/lib/contracts";
import { TxButton } from "@/components/TxButton";
import { AddressPill } from "@/components/AddressPill";
import { EmptyState } from "@/components/EmptyState";
import { formatEth, formatShares, formatUsd, parseContractError, relativeTime } from "@/lib/format";
import { resolveIpfs, isIpfsUri } from "@/lib/ipfs";

export default function ProposalsPage({
  params,
}: {
  params: { address: string };
}) {
  const { address } = params;
  const valid = isValidAddress(address);
  const { proposals, loading, refetch } = useProposals(address);
  const { contributions } = useContributions(address);
  const { address: wallet } = useAccount();
  const { data: position } = useUserPosition(valid ? address : undefined, wallet);

  const contribById = useMemo(() => {
    const m = new Map<string, (typeof contributions)[number]>();
    for (const c of contributions) m.set(c.id.toString(), c);
    return m;
  }, [contributions]);

  const hasVotedRes = useReadContracts({
    contracts: valid
      ? proposals.map(
          (p) =>
            ({
              ...propertyConfigFor(address as `0x${string}`),
              functionName: "hasVoted",
              args: [p.id, wallet ?? "0x0000000000000000000000000000000000000000"],
            }) as const
        )
      : [],
    query: { enabled: valid && !!wallet && proposals.length > 0 },
  });

  const votes = position?.votingPower ?? 0n;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Proposals</h1>
          <p className="text-fg-muted mt-2">
            Larger line items (above the review threshold) go to a co-owner vote.
            Your weight is the stake you already held when the item opened
            — buying more the same day won&rsquo;t change it.
          </p>
        </div>
        {wallet && (
          <div className="card py-3 px-4">
            <div className="stat-label">Your voting power</div>
            <div className="text-xl font-bold tabular-nums mt-1">
              {formatShares(votes)}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="card">Loading proposals…</div>
      ) : proposals.length === 0 ? (
        <EmptyState
          title="No proposals yet"
          description="A vote opens when someone submits a line item that needs full co-owner approval."
        />
      ) : (
        <ul className="space-y-4">
          {proposals
            .slice()
            .reverse()
            .map((p, i) => {
              const revIdx = proposals.length - 1 - i;
              const hasVoted = !!hasVotedRes.data?.[revIdx]?.result;
              return (
                <ProposalCard
                  key={p.id.toString()}
                  propertyAddress={address as `0x${string}`}
                  p={p}
                  contrib={contribById.get(p.contributionId.toString())}
                  userHasVoted={hasVoted}
                  canVote={!!wallet && votes > 0n}
                  refetch={refetch}
                />
              );
            })}
        </ul>
      )}
    </div>
  );
}

function ProposalCard({
  propertyAddress,
  p,
  contrib,
  userHasVoted,
  canVote,
  refetch,
}: {
  propertyAddress: `0x${string}`;
  p: ProposalView;
  contrib: ReturnType<typeof useContributions>["contributions"][number] | undefined;
  userHasVoted: boolean;
  canVote: boolean;
  refetch: () => void;
}) {
  const { writeContract, data: hash, isPending, variables } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  if (isSuccess) refetch();

  const now = BigInt(Math.floor(Date.now() / 1000));
  const votingOpen = p.votingDeadline > now && !p.executed;
  const voteEnded = p.votingDeadline <= now;
  const timelockReady = p.executableAt > 0n && p.executableAt <= now;

  const total = p.yesVotes + p.noVotes;
  const yesPct = total > 0n ? Number((p.yesVotes * 10_000n) / total) / 100 : 0;
  const noPct = total > 0n ? 100 - yesPct : 0;

  const vote = (support: boolean) => {
    writeContract(
      {
        ...propertyConfigFor(propertyAddress),
        functionName: "voteOnProposal",
        args: [p.id, support],
      },
      {
        onSuccess: () => toast.success(`Voted ${support ? "yes" : "no"}`),
        onError: (err) => toast.error(parseContractError(err)),
      }
    );
  };

  const execute = () => {
    writeContract(
      {
        ...propertyConfigFor(propertyAddress),
        functionName: "executeProposal",
        args: [p.id],
      },
      {
        onSuccess: () => toast.success("Execution tx sent"),
        onError: (err) => toast.error(parseContractError(err)),
      }
    );
  };

  const currentFn = variables?.functionName as string | undefined;

  return (
    <li className="card space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-fg-muted">#{p.id.toString()}</span>
            {p.executed ? (
              <span className="chip text-success">Executed</span>
            ) : votingOpen ? (
              <span className="chip text-accent">Voting open</span>
            ) : timelockReady ? (
              <span className="chip text-warning">Ready to execute</span>
            ) : voteEnded ? (
              <span className="chip">Voting closed</span>
            ) : null}
          </div>
          <h3 className="text-lg font-semibold mt-2">
            {contrib ? formatUsd(contrib.valueUsd) : "Contribution"} contribution
          </h3>
          {contrib && (
            <div className="text-sm text-fg-muted flex items-center gap-2 mt-1">
              by <AddressPill address={contrib.contributor} />
              {isIpfsUri(contrib.descriptionURI) && (
                <a
                  href={resolveIpfs(contrib.descriptionURI) ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline text-xs"
                >
                  view proof
                </a>
              )}
            </div>
          )}
        </div>
        <div className="text-right text-xs text-fg-muted shrink-0">
          {votingOpen && <div>Vote ends {relativeTime(p.votingDeadline)}</div>}
          {p.executableAt > 0n && !p.executed && (
            <div>Timelock: {relativeTime(p.executableAt)}</div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-2 rounded-full bg-surface-2 overflow-hidden flex">
          <div className="bg-success h-full" style={{ width: `${yesPct}%` }} />
          <div className="bg-danger h-full" style={{ width: `${noPct}%` }} />
        </div>
        <div className="flex justify-between text-xs text-fg-muted">
          <span>
            <span className="text-success font-medium">Yes</span>{" "}
            {formatEth(p.yesVotes, 0)} ({yesPct.toFixed(1)}%)
          </span>
          <span>
            <span className="text-danger font-medium">No</span>{" "}
            {formatEth(p.noVotes, 0)} ({noPct.toFixed(1)}%)
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
        {votingOpen && !userHasVoted && canVote && (
          <>
            <TxButton
              onClick={() => vote(true)}
              isPending={isPending && currentFn === "voteOnProposal" && variables?.args?.[1] === true}
              isConfirming={isConfirming && currentFn === "voteOnProposal" && variables?.args?.[1] === true}
              variant="primary"
            >
              Vote yes
            </TxButton>
            <TxButton
              onClick={() => vote(false)}
              isPending={isPending && currentFn === "voteOnProposal" && variables?.args?.[1] === false}
              isConfirming={isConfirming && currentFn === "voteOnProposal" && variables?.args?.[1] === false}
              variant="danger"
            >
              Vote no
            </TxButton>
          </>
        )}
        {userHasVoted && votingOpen && (
          <span className="chip text-success">✓ You voted</span>
        )}
        {voteEnded && !p.executed && (
          <TxButton
            onClick={execute}
            isPending={isPending && currentFn === "executeProposal"}
            isConfirming={isConfirming && currentFn === "executeProposal"}
            variant="secondary"
          >
            {p.executableAt === 0n
              ? "Arm timelock"
              : timelockReady
              ? "Execute now"
              : "Waiting for timelock"}
          </TxButton>
        )}
        {!canVote && votingOpen && !userHasVoted && (
          <p className="text-xs text-fg-muted">
            You need shares to vote. Become a co-owner by submitting contributions.
          </p>
        )}
      </div>
    </li>
  );
}
