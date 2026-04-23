"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useProperties } from "@/hooks/useProperties";
import { PropertyCard } from "@/components/PropertyCard";
import { EmptyState } from "@/components/EmptyState";
import { PropertyTypeLabel } from "@/lib/contracts";
import { cn } from "@/lib/cn";

export default function PropertiesIndex() {
  const { properties, loading } = useProperties(0n, 100n);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<number | "all">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return properties.filter((p) => {
      if (typeFilter !== "all" && p.propertyType !== typeFilter) return false;
      if (!q) return true;
      return (
        p.displayName.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.tokenSymbol.toLowerCase().includes(q)
      );
    });
  }, [properties, query, typeFilter]);

  const types = [0, 1, 2, 3, 4] as const;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Properties</h1>
          <p className="text-fg-muted mt-2">
            Every listed building has its own co-owners, its own record of work, and
            its own rental payouts — nothing is mixed between properties.
          </p>
        </div>
        <Link href="/launch" className="btn-primary shrink-0">
          Launch a property
        </Link>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, city, or ticker…"
          className="flex-1 min-w-[200px] rounded-lg bg-surface-2 border border-border px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-accent"
        />
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setTypeFilter("all")}
            className={cn(
              "chip cursor-pointer",
              typeFilter === "all" && "border-accent text-accent bg-accent/10"
            )}
          >
            All
          </button>
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                "chip cursor-pointer",
                typeFilter === t && "border-accent text-accent bg-accent/10"
              )}
            >
              {PropertyTypeLabel[t]}
            </button>
          ))}
        </div>
      </div>

      {loading && properties.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card h-48 animate-pulse bg-surface-2/50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={properties.length === 0 ? "No properties yet" : "No matches"}
          description={
            properties.length === 0
              ? "Be the first to launch one."
              : "Try a different search or clear the filters."
          }
          action={
            properties.length === 0 ? (
              <Link href="/launch" className="btn-primary">
                Launch a property
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <PropertyCard key={p.property} card={p} />
          ))}
        </div>
      )}
    </div>
  );
}
