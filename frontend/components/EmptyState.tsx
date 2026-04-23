export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card border-dashed text-center py-12">
      <div className="w-14 h-14 mx-auto rounded-full bg-surface-2 border border-border grid place-items-center text-fg-muted text-2xl mb-4">
        ∅
      </div>
      <h3 className="font-semibold text-fg">{title}</h3>
      {description && <p className="text-sm text-fg-muted mt-1 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
