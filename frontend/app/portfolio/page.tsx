"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useProperties } from "@/hooks/useProperties";
import { useUserPositions } from "@/hooks/useUserPosition";
import { PropertyCard } from "@/components/PropertyCard";
import { EmptyState } from "@/components/EmptyState";
import { StatCard } from "@/components/StatCard";
import { ConnectGate } from "@/components/ConnectGate";
import { formatEth } from "@/lib/format";

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const { properties } = useProperties(0n, 100n);
  const { heldOnly, loading } = useUserPositions(address);

  if (!isConnected) {
    return (
      <div className="max-w-lg mx-auto text-center pt-8">
        <h1 className="text-2xl md:text-3xl font-bold">Your holdings</h1>
        <p className="text-fg-muted mt-2 mb-6">
          Connect a wallet to see the properties you co-own.
        </p>
        <div className="inline-block">
          <ConnectGate>
            <span />
          </ConnectGate>
        </div>
      </div>
    );
  }

  const totalClaimable = heldOnly.reduce((sum, p) => sum + p.claimableYield, 0n);
  const totalVotingPower = heldOnly.reduce((sum, p) => sum + p.votingPower, 0n);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Your holdings</h1>
        <p className="text-fg-muted mt-2">
          Every property where you hold shares, plus unclaimed rental yield
          aggregated across them.
        </p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Properties held" value={heldOnly.length} />
        <StatCard
          label="Unclaimed yield"
          value={`${formatEth(totalClaimable, 6)} ETH`}
          tooltip="Sum of claimable yield across every property you hold."
        />
        <StatCard
          label="Voting power"
          value={`${formatEth(totalVotingPower, 0)} votes`}
          sublabel="Across all properties"
        />
      </section>

      {loading && heldOnly.length === 0 ? (
        <div className="card">Loading positions…</div>
      ) : heldOnly.length === 0 ? (
        <EmptyState
          title="You don't hold any shares yet"
          description="Browse properties and submit a contribution to become a co-owner."
          action={
            <Link href="/properties" className="btn-primary">
              Browse properties
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {heldOnly.map((pos) => {
            const card = properties.find((p) => p.property === pos.property);
            if (!card) return null;
            return <PropertyCard key={card.property} card={card} position={pos} />;
          })}
        </div>
      )}
    </div>
  );
}
