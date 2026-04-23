import { Spinner } from "@/components/Spinner";

export default function Loading() {
  return (
    <div className="min-h-[50vh] grid place-items-center">
      <div className="flex items-center gap-3 text-fg-muted">
        <Spinner className="w-5 h-5" />
        Loading…
      </div>
    </div>
  );
}
