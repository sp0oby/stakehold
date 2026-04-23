import Link from "next/link";
import type { PropertyCard as PropertyCardData } from "@/hooks/useProperties";
import type { UserPosition } from "@/hooks/useUserPosition";
import { PropertyTypeLabel } from "@/lib/contracts";
import { formatEth, formatShares, formatUsd } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Compact card used on the home page, /properties, /portfolio. Optional
 * `position` decorates the card with the viewer's own stake when the viewer
 * holds shares in this property.
 */
export function PropertyCard({
  card,
  position,
  size = "default",
}: {
  card: PropertyCardData;
  position?: UserPosition;
  size?: "default" | "hero";
}) {
  const isHero = size === "hero";
  const ownershipPct =
    position && card.totalShares > 0n
      ? (Number(position.shareBalance) / Number(card.totalShares)) * 100
      : 0;

  return (
    <Link
      href={`/p/${card.property}`}
      className={cn(
        "card block hover:border-accent/40 transition-colors group relative overflow-hidden",
        isHero && "md:p-8 bg-gradient-to-br from-surface via-surface to-accent/5"
      )}
    >
      {isHero && (
        <div
          aria-hidden
          className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-accent/10 blur-3xl pointer-events-none"
        />
      )}
      <div className="relative">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex flex-wrap gap-1.5">
            <span className="chip text-xs">{PropertyTypeLabel[card.propertyType]}</span>
            {card.paused && (
              <span className="chip text-xs text-warning border-warning/40 bg-warning/10">
                Paused
              </span>
            )}
            {position?.isShareholder && (
              <span className="chip text-xs text-accent border-accent/40 bg-accent/10">
                You own {ownershipPct.toFixed(2)}%
              </span>
            )}
          </div>
          <span className="text-xs text-fg-muted group-hover:text-accent transition-colors">
            →
          </span>
        </div>

        <h3
          className={cn(
            "font-bold tracking-tight truncate",
            isHero ? "text-2xl md:text-3xl" : "text-lg"
          )}
        >
          {card.displayName}
        </h3>
        <p className="text-sm text-fg-muted mt-1 truncate">{card.city}</p>

        <dl
          className={cn(
            "grid gap-3 mt-4 pt-4 border-t border-border",
            isHero ? "grid-cols-4" : "grid-cols-3"
          )}
        >
          <Stat label="Value" value={formatUsd(card.propertyValueUsd)} />
          <Stat label="Shares" value={formatShares(card.totalShares)} />
          <Stat
            label="Yield paid"
            value={`${formatEth(card.totalYieldDistributed, 2)} ETH`}
          />
          {isHero && (
            <Stat
              label="Token"
              value={card.tokenSymbol}
              sub={card.tokenName}
            />
          )}
        </dl>
      </div>
    </Link>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-fg-muted font-medium">
        {label}
      </dt>
      <dd className="font-semibold text-fg text-sm md:text-base tabular-nums truncate">
        {value}
      </dd>
      {sub && (
        <dd className="text-[10px] text-fg-muted truncate">{sub}</dd>
      )}
    </div>
  );
}
