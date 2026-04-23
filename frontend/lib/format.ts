import { formatEther, formatUnits } from "viem";

/** Format a uint256 wei value as ETH with compact decimals. */
export function formatEth(value: bigint | undefined, maxDecimals = 4): string {
  if (value === undefined) return "—";
  const full = formatEther(value);
  const [whole, frac] = full.split(".");
  if (!frac) return whole;
  const trimmed = frac.slice(0, maxDecimals).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

/** Format a 6-decimal USDC-style USD value. */
export function formatUsd(value: bigint | undefined): string {
  if (value === undefined) return "—";
  const whole = Number(formatUnits(value, 6));
  // Switch to compact notation ($2.1M, $2B) past a million so the
  // property-value stat card doesn't blow out of its grid cell on
  // high-value listings. Small values keep full precision.
  if (whole >= 1_000_000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(whole);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(whole);
}

/** Format an 18-decimal share amount as a compact number + "shares". */
export function formatShares(value: bigint | undefined, totalSupply?: bigint): string {
  if (value === undefined) return "—";
  const n = Number(formatEther(value));
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(n);
  if (totalSupply && totalSupply > 0n) {
    const pct = (Number(formatEther(value)) / Number(formatEther(totalSupply))) * 100;
    return `${formatted} (${pct.toFixed(2)}%)`;
  }
  return formatted;
}

/** Percentage of total as a friendly 0–100 number. */
export function sharePct(value: bigint | undefined, total: bigint | undefined): number {
  if (!value || !total || total === 0n) return 0;
  return (Number(value) / Number(total)) * 100;
}

/** Short middle-truncated address. */
export function shortAddress(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Format a unix timestamp as relative time (e.g. "in 2 days", "5 minutes ago"). */
export function relativeTime(ts: bigint | number | undefined): string {
  if (!ts) return "—";
  const target = typeof ts === "bigint" ? Number(ts) : ts;
  const now = Math.floor(Date.now() / 1000);
  const delta = target - now;
  const abs = Math.abs(delta);
  const suffix = delta >= 0 ? "in " : "";
  const ago = delta >= 0 ? "" : " ago";
  if (abs < 60) return `${suffix}${abs}s${ago}`;
  if (abs < 3600) return `${suffix}${Math.floor(abs / 60)}m${ago}`;
  if (abs < 86400) return `${suffix}${Math.floor(abs / 3600)}h${ago}`;
  return `${suffix}${Math.floor(abs / 86400)}d${ago}`;
}

/** Translate a raw contract error (viem BaseError) into a user-facing message. */
export function parseContractError(err: unknown): string {
  if (!err) return "Unknown error";
  // viem attaches a `shortMessage` on most errors; fall back to `message`.
  const anyErr = err as { shortMessage?: string; message?: string; details?: string };
  if (anyErr.shortMessage) return humanize(anyErr.shortMessage);
  if (anyErr.message) return humanize(anyErr.message);
  return "Transaction failed";
}

function humanize(raw: string): string {
  // Strip Solidity panic prefixes and map a few common cases to friendlier text.
  const map: Record<string, string> = {
    ZeroAmount: "Value must be greater than zero.",
    ProofRequired: "Upload a proof document first.",
    AlreadyVoted: "You've already voted on this proposal.",
    VotingClosed: "Voting has ended for this proposal.",
    VotingStillOpen: "Wait for the voting period to end.",
    TimelockNotElapsed: "Timelock hasn't elapsed yet — try again later.",
    CliffNotReached: "Vesting cliff hasn't completed yet.",
    AlreadyClaimed: "You already claimed this grant.",
    NoYield: "No yield to claim right now.",
    NotBeneficiary: "Only the grant's beneficiary can claim these shares.",
    User_denied: "You rejected the transaction in your wallet.",
  };
  for (const [key, msg] of Object.entries(map)) {
    if (raw.toLowerCase().includes(key.toLowerCase())) return msg;
  }
  return raw.replace(/^Error: /, "").slice(0, 240);
}
