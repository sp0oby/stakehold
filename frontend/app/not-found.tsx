import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[50vh] grid place-items-center">
      <div className="card max-w-md text-center">
        <div className="text-6xl mb-2">404</div>
        <h2 className="font-semibold">Not found</h2>
        <p className="text-sm text-fg-muted mt-2">
          That page doesn't exist.
        </p>
        <Link href="/" className="btn-primary mt-4 inline-flex">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
