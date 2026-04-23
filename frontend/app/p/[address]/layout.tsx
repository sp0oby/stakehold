"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProperty } from "@/hooks/useProperty";
import { cn } from "@/lib/cn";
import { AddressPill } from "@/components/AddressPill";
import { PropertyTypeLabel, isValidAddress } from "@/lib/contracts";

/**
 * Shared scaffold for every `/p/[address]/*` route. Shows a property-scoped
 * header (identity, city, address pills) and a sub-nav for the page set.
 *
 * Implemented as a client layout because the inner nav uses `usePathname` and
 * live reads via the Lens.
 */
export default function PropertyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { address: string };
}) {
  const { address } = params;
  const path = usePathname();
  const { data, loading } = useProperty(address);

  if (!isValidAddress(address)) {
    return (
      <div className="card">
        <h1 className="text-lg font-semibold text-danger">Invalid property address</h1>
        <p className="text-fg-muted mt-2 text-sm">
          `{address}` isn&rsquo;t a valid Ethereum address.
        </p>
        <Link href="/properties" className="btn-secondary mt-4 inline-flex">
          Browse properties
        </Link>
      </div>
    );
  }

  const tabs = [
    { href: `/p/${address}`, label: "Overview", exact: true },
    { href: `/p/${address}/contribute`, label: "Contribute" },
    { href: `/p/${address}/proposals`, label: "Proposals" },
    { href: `/p/${address}/yield`, label: "Yield" },
    { href: `/p/${address}/rebalance`, label: "Rebalance" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Property header */}
      <header className="card bg-gradient-to-br from-surface via-surface to-surface-2 overflow-hidden relative">
        <div
          aria-hidden
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-accent/10 blur-3xl pointer-events-none"
        />
        <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="chip">
                {data ? PropertyTypeLabel[data.propertyType] : "…"}
              </span>
              {data?.paused && (
                <span className="chip text-warning border-warning/40 bg-warning/10">
                  Paused
                </span>
              )}
              {data?.version && <span className="chip">v{data.version}</span>}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate">
              {loading ? "Loading property…" : data?.displayName ?? "Unknown property"}
            </h1>
            <p className="text-fg-muted mt-1 text-sm">
              {data?.city ?? "\u00A0"}
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs items-center">
              <span className="text-fg-muted">Property:</span>
              <AddressPill address={address as `0x${string}`} />
              {data?.share && (
                <>
                  <span className="text-fg-muted ml-2">Share token:</span>
                  <AddressPill address={data.share} />
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Sub-nav */}
      <nav className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((t) => {
          const active = t.exact ? path === t.href : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "px-3 py-2 text-sm rounded-t-md border-b-2 transition-colors -mb-px",
                active
                  ? "border-accent text-fg"
                  : "border-transparent text-fg-muted hover:text-fg"
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
