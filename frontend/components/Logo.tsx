import { cn } from "@/lib/cn";

/**
 * Stakehold wordmark + icon. The mark is a stylized house silhouette
 * (pentagon with peaked roof) sitting on a foundation line — the literal
 * "stake" and "hold" of the brand. Solid, architectural, reads at 16px.
 */
export function Logo({
  size = 28,
  className,
  showWordmark = true,
}: {
  size?: number;
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="32" height="32" rx="7" fill="hsl(var(--accent))" />
        {/* House pentagon */}
        <path
          d="M16 6.5 L25.5 14 L25.5 24 L6.5 24 L6.5 14 Z"
          fill="hsl(var(--accent-fg))"
          strokeLinejoin="round"
        />
        {/* Foundation bar — the "hold" */}
        <rect
          x="5"
          y="25"
          width="22"
          height="2"
          rx="1"
          fill="hsl(var(--accent-fg))"
        />
      </svg>
      {showWordmark && <span>Stakehold</span>}
    </span>
  );
}
