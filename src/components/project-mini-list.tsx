import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import type { ProjectStatus } from "@/generated/prisma/enums";
import { formatLocation, formatPowerScaled, formatRelative } from "@/lib/format";
import type { NumericLike } from "@/lib/format";

export type MiniProject = {
  id: string;
  slug: string;
  name: string;
  status: ProjectStatus;
  country: string;
  city?: string | null;
  stateRegion?: string | null;
  estimatedPowerMw: NumericLike;
  confirmedPowerMw: NumericLike;
  isDemoData: boolean;
  ownerCompany: { name: string; slug: string } | null;
  createdAt?: Date;
  updatedAt?: Date;
  lastVerifiedAt?: Date | null;
};

/** Compact project rows for dashboard panels. */
export function ProjectMiniList({
  projects,
  timestampOf,
  emptyText = "No projects yet.",
}: {
  projects: MiniProject[];
  timestampOf?: (p: MiniProject) => Date | null | undefined;
  emptyText?: string;
}) {
  if (projects.length === 0) {
    return <p className="px-1 py-6 text-center text-xs text-fg-muted">{emptyText}</p>;
  }

  return (
    <ul className="divide-y divide-[#1b1b1b]">
      {projects.map((p) => (
        <li key={p.id} className="flex items-center justify-between gap-3 py-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href={`/projects/${p.slug}`}
                className="truncate text-[13px] font-medium text-fg hover:text-cyan"
              >
                {p.name}
              </Link>
              {p.isDemoData ? <Badge tone="risk">Demo</Badge> : null}
            </div>
            <p className="truncate text-[11px] text-fg-muted">
              {p.ownerCompany?.name ?? "Unattributed"} ·{" "}
              {formatLocation({
                city: p.city,
                stateRegion: p.stateRegion,
                country: p.country,
              })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <span className="num text-[12px] text-fg-dim">
              {formatPowerScaled(p.confirmedPowerMw ?? p.estimatedPowerMw)}
            </span>
            <StatusBadge status={p.status} />
            {timestampOf ? (
              <span className="hidden w-20 text-right text-[10px] text-fg-muted sm:block">
                {formatRelative(timestampOf(p))}
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
