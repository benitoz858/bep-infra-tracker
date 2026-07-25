"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Error boundary for the authenticated app. Deliberately does not print the
 * error message: a database or query error can carry table names and
 * connection details, and this is a shared terminal. `digest` is the handle for
 * correlating with the server log.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] render error", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <AlertTriangle className="size-7 text-amber" />
      <h1 className="text-lg font-semibold text-fg">Something went wrong</h1>
      <p className="max-w-md text-[13px] leading-relaxed text-fg-dim">
        This page failed to render. Nothing was saved. Retry, and if it keeps failing,
        check the server log for the reference below.
      </p>
      {error.digest ? (
        <p className="num text-[11px] text-fg-muted">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-2 flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={reset}>
          Retry
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
