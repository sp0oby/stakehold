"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useProperty } from "@/hooks/useProperty";
import { useOwners } from "@/hooks/useOwners";
import { useContributions, StatusLabel } from "@/hooks/useContributions";
import { useUserPosition } from "@/hooks/useUserPosition";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { StatCard } from "@/components/StatCard";
import { OwnershipChart } from "@/components/OwnershipChart";
import { AddressPill } from "@/components/AddressPill";
import { EmptyState } from "@/components/EmptyState";
import { AdminPanel } from "@/components/property/AdminPanel";
import { ShareholderActions } from "@/components/property/ShareholderActions";
import { formatEth, formatShares, formatUsd, relativeTime } from "@/lib/format";
import { resolveIpfs, isIpfsUri, isResolvableIpfs } from "@/lib/ipfs";

const PALETTE = [
  "hsl(158, 77%, 52%)",
  "hsl(198, 77%, 58%)",
  "hsl(262, 62%, 65%)",
  "hsl(38, 92%, 55%)",
  "hsl(340, 75%, 60%)",
  "hsl(180, 64%, 50%)",
  "hsl(90, 60%, 55%)",
];

export default function PropertyOverview({
  params,
}: {
  params: { address: string };
}) {
  const { address } = params;
  const { data } = useProperty(address);
  const { owners } = useOwners(data?.share);
  const { contributions } = useContributions(address);
  const { address: wallet } = useAccount();
  const { data: position } = useUserPosition(address, wallet);
  const roles = useIsAdmin(address, wallet);

  const totalSupplyN = data?.totalShares ? Number(data.totalShares) / 1e18 : 0;

  const slices = owners.slice(0, 7).map((o, i) => ({
    label: `${o.address.slice(0, 6)}…${o.address.slice(-4)}`,
    value:
      totalSupplyN > 0 && o.shares
        ? (Number(o.shares) / 1e18 / totalSupplyN) * 100
        : 0,
    color: PALETTE[i % PALETTE.length],
  }));

  const recent = contributions.slice(0, 5);
  const isShareholder = !!position?.isShareholder;

  return (
    <div className="space-y-8">
      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Property value"
          value={formatUsd(data?.propertyValueUsd)}
          tooltip="Latest book value the group is working from. It moves as approved contributions land."
        />
        <StatCard
          label="Total shares"
          value={formatShares(data?.totalShares)}
          sublabel="1,000,000 at genesis"
        />
        <StatCard
          label="Yield distributed"
          value={`${formatEth(data?.totalYieldDistributed)} ETH`}
          tooltip="All-time rental income paid out to shareholders."
        />
        <StatCard
          label="Co-owners"
          value={owners.length === 0 ? "…" : owners.length}
          sublabel={`${contributions.length} contributions`}
        />
      </section>

      {/* CTAs */}
      <section className="flex flex-wrap gap-2">
        <Link href={`/p/${address}/contribute`} className="btn-primary">
          Submit contribution
        </Link>
        <Link href={`/p/${address}/proposals`} className="btn-secondary">
          View proposals
        </Link>
        <Link href={`/p/${address}/yield#rent-payments`} className="btn-secondary">
          Rental &amp; yield
        </Link>
      </section>

      <section className="card !py-3 !px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-sm text-fg-muted max-w-2xl">
          <span className="text-fg font-medium">Add rental income</span> — When rent is
          received, it can be posted here so every co-owner&apos;s share updates
          together. On the live network you&apos;d do this from the property&apos;s
          operating account; in this environment you can try it with test funds.
        </p>
        <Link
          href={`/p/${address}/yield#rent-payments`}
          className="btn-primary shrink-0 self-start sm:self-center"
        >
          Record income
        </Link>
      </section>

      {/* Admin panel (role-gated) */}
      {data && roles.isAnyAdmin && (
        <AdminPanel
          propertyAddress={address as `0x${string}`}
          data={data}
          roles={roles}
        />
      )}

      {/* My shares (shareholder-gated) */}
      {data && wallet && isShareholder && position && (
        <ShareholderActions
          shareAddress={data.share}
          wallet={wallet as `0x${string}`}
          balance={position.shareBalance}
        />
      )}

      {/* Public details */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card md:col-span-2">
          <h2 className="font-semibold mb-2">About this property</h2>
          <dl className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
            <dt className="text-fg-muted">Location</dt>
            <dd>{data?.city ?? "—"}</dd>
            <dt className="text-fg-muted">Token</dt>
            <dd>
              {data?.tokenName} ({data?.tokenSymbol})
            </dd>
            <dt className="text-fg-muted">Creator</dt>
            <dd>{data && <AddressPill address={data.creator} />}</dd>
          </dl>

          {data?.publicMetadataURI && isResolvableIpfs(data.publicMetadataURI) ? (
            <a
              href={resolveIpfs(data.publicMetadataURI) ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 mt-4 text-sm text-accent hover:underline"
            >
              View public media bundle →
            </a>
          ) : data?.publicMetadataURI ? (
            <p className="mt-4 text-xs text-fg-muted italic">
              Public media bundle not uploaded yet.
            </p>
          ) : null}
        </div>

        <div className="card">
          <h2 className="font-semibold mb-2">Legal docs</h2>
          {isShareholder ? (
            isResolvableIpfs(data?.legalDocsURI) ? (
              <>
                <p className="text-xs text-fg-muted mb-3">
                  You hold shares — full legal bundle unlocked.
                </p>
                <a
                  href={resolveIpfs(data!.legalDocsURI) ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary w-full justify-center"
                >
                  Open legal docs
                </a>
              </>
            ) : (
              <>
                <p className="text-xs text-fg-muted mb-3">
                  You hold shares — full legal bundle unlocked once the admin
                  uploads it.
                </p>
                <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-fg-muted">
                  Not yet uploaded by the admin.
                </div>
              </>
            )
          ) : (
            <>
              <p className="text-xs text-fg-muted">
                Deeds, insurance, and the full street address stay private to
                shareholders. Become a co-owner to unlock them.
              </p>
              <div className="mt-3 rounded-lg border border-dashed border-border p-3 text-center text-xs text-fg-muted">
                🔒 Shareholder-only
              </div>
            </>
          )}
        </div>
      </section>

      {/* Chart + recent activity */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="card lg:col-span-2">
          <h2 className="font-semibold text-fg mb-4">Ownership split</h2>
          {owners.length > 0 ? (
            <OwnershipChart slices={slices} />
          ) : (
            <EmptyState
              title="No owners yet"
              description="Share activity will appear here as soon as the cap table is populated."
            />
          )}
        </div>

        <div className="card lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-fg">Recent contributions</h2>
            <Link
              href={`/p/${address}/contribute`}
              className="text-xs text-fg-muted hover:text-fg"
            >
              Submit one →
            </Link>
          </div>
          {recent.length === 0 ? (
            <EmptyState
              title="Nothing submitted yet"
              description="Line items from co-owners will appear here as soon as someone submits one."
            />
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((c) => (
                <li key={c.id.toString()} className="py-3 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${statusDot(c.status)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-fg">{formatUsd(c.valueUsd)}</span>
                      <span className="chip">{StatusLabel[c.status]}</span>
                      <span className="text-xs text-fg-muted">
                        {relativeTime(c.submittedAt)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-fg-muted">
                      by <AddressPill address={c.contributor} />
                    </div>
                  </div>
                  {isIpfsUri(c.descriptionURI) && (
                    <a
                      href={resolveIpfs(c.descriptionURI) ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-accent hover:underline shrink-0"
                    >
                      view proof
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Top owners table */}
      {owners.length > 0 && (
        <section className="card">
          <h2 className="font-semibold text-fg mb-4">Shareholders</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-fg-muted text-xs uppercase tracking-wider">
                  <th className="py-2 font-medium">Owner</th>
                  <th className="py-2 font-medium text-right">Shares</th>
                  <th className="py-2 font-medium text-right">% Ownership</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {owners.map((o) => (
                  <tr key={o.address}>
                    <td className="py-3">
                      <AddressPill address={o.address} />
                    </td>
                    <td className="py-3 text-right tabular-nums text-fg">
                      {formatShares(o.shares)}
                    </td>
                    <td className="py-3 text-right tabular-nums text-fg font-medium">
                      {data?.totalShares && o.shares
                        ? ((Number(o.shares) / Number(data.totalShares)) * 100).toFixed(2)
                        : "0"}
                      %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function statusDot(status: number): string {
  switch (status) {
    case 0: return "bg-warning";
    case 1: return "bg-accent";
    case 2: return "bg-success";
    case 3: return "bg-danger";
    case 4: return "bg-fg-muted";
    default: return "bg-fg-muted";
  }
}
