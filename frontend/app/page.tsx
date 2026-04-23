"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useProperties } from "@/hooks/useProperties";
import { useUserPositions } from "@/hooks/useUserPosition";
import { PropertyCard } from "@/components/PropertyCard";
import { EmptyState } from "@/components/EmptyState";
import { FEATURED_PROPERTY, isValidAddress, isConfigured } from "@/lib/contracts";

export default function Home() {
  const { properties, loading, configured } = useProperties(0n, 12n);
  const { address } = useAccount();
  const { heldOnly } = useUserPositions(address);

  const featured = isValidAddress(FEATURED_PROPERTY)
    ? properties.find((p) => p.property.toLowerCase() === FEATURED_PROPERTY.toLowerCase())
    : properties[0];

  const rest = properties.filter((p) => !featured || p.property !== featured.property);

  return (
    <div className="space-y-12 animate-fade-in">
      {/* Hero */}
      <section className="card bg-gradient-to-br from-surface via-surface to-surface-2 border-border overflow-hidden relative">
        <div
          aria-hidden
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-accent/10 blur-3xl pointer-events-none"
        />
        <div className="relative max-w-3xl">
          <p className="text-xs uppercase tracking-[0.18em] font-semibold text-accent mb-3">
            Fractional property ownership
          </p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Co-own buildings that reflect the actual work behind them.
          </h1>
          <p className="text-fg-muted mt-4 text-lg leading-relaxed">
            Every contribution — capital, upgrades, maintenance, taxes — is submitted
            with IPFS proof, voted on by shareholders, and rebalances the cap table
            when executed. Rental income streams pro-rata to every holder as ETH.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/properties" className="btn-primary">
              Browse properties
            </Link>
            <Link href="/launch" className="btn-secondary">
              Launch a property
            </Link>
          </div>
        </div>
      </section>

      {/* Not configured */}
      {!isConfigured() && (
        <div className="card border-warning/40 bg-warning/5">
          <h2 className="font-semibold text-warning">Frontend not wired up</h2>
          <p className="text-sm text-fg-muted mt-2">
            The <code className="font-mono text-xs">NEXT_PUBLIC_FACTORY_ADDRESS</code>{" "}
            and <code className="font-mono text-xs">NEXT_PUBLIC_LENS_ADDRESS</code> env
            vars are missing. Set them in <code className="font-mono text-xs">.env.local</code>
            {" "}after running the deploy script.
          </p>
        </div>
      )}

      {/* My positions (if any) */}
      {address && heldOnly.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Your holdings</h2>
            <Link href="/portfolio" className="text-sm text-accent hover:underline">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {heldOnly.slice(0, 3).map((pos) => {
              const card = properties.find((p) => p.property === pos.property);
              if (!card) return null;
              return <PropertyCard key={card.property} card={card} position={pos} />;
            })}
          </div>
        </section>
      )}

      {/* Featured */}
      {featured && (
        <section>
          <h2 className="text-xl font-bold mb-4">Featured</h2>
          <PropertyCard card={featured} size="hero" />
        </section>
      )}

      {/* All properties */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Latest launches</h2>
          {properties.length > 6 && (
            <Link href="/properties" className="text-sm text-accent hover:underline">
              View all →
            </Link>
          )}
        </div>
        {loading && properties.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card h-48 animate-pulse bg-surface-2/50" />
            ))}
          </div>
        ) : rest.length === 0 && !featured ? (
          configured ? (
            <EmptyState
              title="No properties yet"
              description="Be the first to launch one."
              action={
                <Link href="/launch" className="btn-primary">
                  Launch a property
                </Link>
              }
            />
          ) : null
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rest.map((p) => (
              <PropertyCard key={p.property} card={p} />
            ))}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="card">
        <h2 className="text-xl font-bold mb-4">How Stakehold works</h2>
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-6 list-none">
          <Step
            n="1"
            title="Someone launches a property"
            body="A creator calls the factory with a flat launch fee, metadata, and initial holders. Factory atomically deploys a paired Share token + Property governor, wires permissions, and renounces itself."
          />
          <Step
            n="2"
            title="Co-owners contribute work"
            body="Anyone can submit IPFS-proofed contributions (capital, upkeep, taxes). Small ones auto-approve after a timelock; large ones open a DAO vote on the Share token."
          />
          <Step
            n="3"
            title="Shares rebalance, yield streams"
            body="Executed contributions mint new shares on a 6-month cliff. Rental income is deposited in ETH and streamed pro-rata via a pull-pattern accumulator."
          />
        </ol>
      </section>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li>
      <div className="w-8 h-8 rounded-full bg-accent/15 text-accent font-semibold flex items-center justify-center text-sm mb-3">
        {n}
      </div>
      <h3 className="font-semibold text-fg">{title}</h3>
      <p className="text-sm text-fg-muted mt-1 leading-relaxed">{body}</p>
    </li>
  );
}
