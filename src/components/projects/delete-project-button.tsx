"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * ADMIN-only project deletion.
 *
 * Deleting a project cascades to its sources, metrics and revisions, so the
 * confirmation names what is being destroyed and requires the project name to
 * be typed. An accidental click must not be able to erase an evidence trail.
 */
export function DeleteProjectButton({
  projectId,
  projectName,
  counts,
}: {
  projectId: string;
  projectName: string;
  counts: { sources: number; metrics: number; revisions: number };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json()) as { error?: { message: string } };
        throw new Error(body.error?.message ?? "Could not delete the project.");
      }
      router.push("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        <Trash2 /> Delete
      </Button>
    );
  }

  return (
    <div className="rounded-md border border-[#5a1a1a] bg-[#2b0e0e] p-3">
      <p className="mb-2 text-[12px] leading-relaxed text-red">
        Deleting <strong>{projectName}</strong> also destroys{" "}
        {counts.sources} source{counts.sources === 1 ? "" : "s"},{" "}
        {counts.metrics} metric{counts.metrics === 1 ? "" : "s"} and{" "}
        {counts.revisions} revision{counts.revisions === 1 ? "" : "s"}. This
        cannot be undone. Type the project name to confirm.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={projectName}
          aria-label="Type the project name to confirm deletion"
          className="h-8 min-w-[220px] flex-1 rounded border border-line-2 bg-panel-2 px-2 text-[12px] text-fg placeholder:text-fg-muted focus:border-red focus:outline-none"
        />
        <Button
          variant="danger"
          size="sm"
          disabled={typed !== projectName || busy}
          onClick={() => void remove()}
        >
          {busy ? "Deleting…" : "Delete permanently"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false);
            setTyped("");
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-[11px] text-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}
