import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Dashboard KPI tile. `hint` is where the estimate/confirmed caveat goes — a
 * headline number in this product is almost never a single clean fact, and the
 * tile should say so rather than implying precision it does not have.
 */
export function StatTile({
  label,
  value,
  hint,
  accent = "cyan",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: "cyan" | "green" | "amber" | "red" | "purple" | "plain";
  className?: string;
}) {
  const accentClass = {
    cyan: "text-cyan",
    green: "text-green",
    amber: "text-amber",
    red: "text-red",
    purple: "text-purple",
    plain: "text-fg",
  }[accent];

  return (
    <div
      className={cn("rounded-lg border border-line bg-panel px-4 py-3.5", className)}
    >
      <p className="eyebrow">{label}</p>
      <p className={cn("num mt-1.5 text-2xl font-bold leading-none", accentClass)}>
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-[11px] text-fg-muted">{hint}</p> : null}
    </div>
  );
}
