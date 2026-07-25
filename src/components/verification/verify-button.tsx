"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

/** Quick action: stamp lastVerifiedAt and refresh the queue. */
export function VerifyButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/verify`, {
        method: "POST",
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: { message: string } };
        throw new Error(body.error?.message ?? "Could not mark as verified.");
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void verify()}>
        <Check /> {busy ? "Saving…" : "Mark verified"}
      </Button>
      {error ? (
        <span role="alert" className="text-[11px] text-red">
          {error}
        </span>
      ) : null}
    </span>
  );
}
