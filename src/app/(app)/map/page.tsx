import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { ProjectMap } from "@/components/map/project-map";
import { ProjectsFilters } from "@/components/projects/projects-filters";
import { Skeleton } from "@/components/ui/misc";
import { requireUser } from "@/lib/permissions";
import { getFilterFacets, listProjectsForMap } from "@/lib/services/projects";
import { projectQuerySchema } from "@/lib/validations/project";

export const metadata: Metadata = { title: "Global map" };

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const raw = await searchParams;

  // Same query schema as the table, so a filter set carries between the two views.
  const query = projectQuerySchema.parse(
    Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v.join(",") : v]),
    ),
  );

  const [projects, facets] = await Promise.all([
    listProjectsForMap(query),
    getFilterFacets(),
  ]);

  return (
    <>
      <PageHeader
        title="Global map"
        subtitle="Every project with coordinates. Colour is status, size is the metric you choose. Filters are shared with the projects table via the URL."
      />

      <div className="mb-4 rounded-lg border border-line bg-panel p-3">
        <Suspense fallback={<Skeleton className="h-28 w-full" />}>
          <ProjectsFilters facets={facets} />
        </Suspense>
      </div>

      <ProjectMap
        projects={projects}
        mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN || undefined}
      />
    </>
  );
}
