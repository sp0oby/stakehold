"use client";

import { Spinner } from "./Spinner";
import { cn } from "@/lib/cn";
import { ConnectGate } from "./ConnectGate";

type Props = {
  onClick: () => void;
  isPending?: boolean;
  isConfirming?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
  fullWidth?: boolean;
};

/**
 * A button that:
 *   - Sits behind the ConnectGate (so it only ever fires when wallet is
 *     connected to Sepolia).
 *   - Shows an INLINE spinner next to its label instead of replacing the
 *     label with className="loading" (ethskills frontend-ux Rule 1).
 *   - Uses per-action pending flags, not a global `isLoading`.
 */
export function TxButton({
  onClick,
  isPending,
  isConfirming,
  disabled,
  children,
  variant = "primary",
  className,
  fullWidth,
}: Props) {
  const busy = !!(isPending || isConfirming);
  const label = isConfirming ? "Confirming…" : isPending ? "Confirm in wallet…" : null;

  const classes = cn(
    variant === "primary" && "btn-primary",
    variant === "secondary" && "btn-secondary",
    variant === "danger" && "btn-danger",
    fullWidth && "w-full",
    className
  );

  return (
    <ConnectGate>
      <button onClick={onClick} disabled={busy || disabled} className={classes}>
        {busy && <Spinner />}
        <span>{label ?? children}</span>
      </button>
    </ConnectGate>
  );
}
