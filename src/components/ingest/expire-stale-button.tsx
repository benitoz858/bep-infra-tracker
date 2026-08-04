"use client";

import { Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

/**
 * One-click relief valve for a backlogged queue: expires every watcher item
 * older than the expiry window, now, instead of waiting for the scheduled run.
 * The count is shown on the button so the click is informed, and the operation
 * only ever touches WATCHER-origin items — a person's submission cannot be
 * cleared in bulk.
 */
export function ExpireStaleButton({ eligible, days }: { eligible: number; days: number }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (eligible === 0) return null;

  async function expire() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/ingest/expire", { method: "POST" });
      const body = (await response.json()) as { error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Failed.");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => void expire()}>
        <Timer /> Expire {eligible} watcher item{eligible === 1 ? "" : "s"} older than {days}{" "}
        days
      </Button>
      {error ? (
        <p role="alert" className="text-[12px] text-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}
