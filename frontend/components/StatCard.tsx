import { cn } from "@/lib/cn";

type Props = {
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  tooltip?: string;
  className?: string;
};

export function StatCard({ label, value, sublabel, tooltip, className }: Props) {
  return (
    <div className={cn("card", className)}>
      <div className="flex items-center gap-2">
        <span className="stat-label">{label}</span>
        {tooltip && (
          <span
            className="inline-grid place-items-center w-4 h-4 rounded-full bg-surface-2 border border-border text-fg-muted text-[10px] cursor-help"
            title={tooltip}
          >
            ?
          </span>
        )}
      </div>
      <div className="stat-value">{value}</div>
      {sublabel && <div className="text-xs text-fg-muted mt-1">{sublabel}</div>}
    </div>
  );
}
