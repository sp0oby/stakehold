"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[50vh] grid place-items-center">
      <div className="card max-w-md text-center">
        <h2 className="font-semibold text-danger">Something went wrong</h2>
        <p className="text-sm text-fg-muted mt-2 break-words">{error.message}</p>
        <button className="btn-secondary mt-4" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
