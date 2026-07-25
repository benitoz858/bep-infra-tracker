import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { ProjectsFilters } from "@/components/projects/projects-filters";
import { ProjectsTable } from "@/components/projects/projects-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/permissions";
import { getFilterFacets, listProjects } from "@/lib/services/projects";
import { projectQuerySchema } from "@/lib/validations/project";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const raw = await searchParams;

  // The URL is the source of truth for table state; parse it through the same
  // schema the export endpoint uses so both agree on what the view contains.
  const query = projectQuerySchema.parse(
    Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v.join(",") : v]),
    ),
  );

  const [{ rows, total, page, perPage, pageCount }, facets] = await Promise.all([
    listProjects(query),
    getFilterFacets(),
  ]);

  return (
    <>
      <PageHeader
        title="Projects database"
        subtitle="Every tracked AI infrastructure project. Green figures are confirmed; grey are analyst estimates. Filters and sort are stored in the URL, so any view can be shared or exported as-is."
        actions={
          can(user.role, "record:create") ? (
            <Button asChild variant="primary" size="sm">
              <Link href="/projects/new">Add project</Link>
            </Button>
          ) : null
        }
      />

      <div className="mb-4 rounded-lg border border-line bg-panel p-3">
        <Suspense fallback={<Skeleton className="h-28 w-full" />}>
          <ProjectsFilters facets={facets} />
        </Suspense>
      </div>

      <ProjectsTable
        rows={rows}
        total={total}
        page={page}
        perPage={perPage}
        pageCount={pageCount}
        canEdit={can(user.role, "record:edit")}
      />
    </>
  );
}
