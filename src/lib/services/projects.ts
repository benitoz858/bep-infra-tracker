import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/format";
import { PROJECT_DECIMAL_FIELDS, serializeDecimalFields } from "@/lib/serialize";
import { ConflictError, DataQualityError, NotFoundError } from "@/lib/services/errors";
import { findDuplicateProjects, uniqueProjectSlug } from "@/lib/services/duplicates";
import { diffProject, recordRevision } from "@/lib/services/revisions";
import { fullVerificationQueueWhere } from "@/lib/services/verification";
import type { ProjectInput, ProjectQuery } from "@/lib/validations/project";
import { projectWarnings } from "@/lib/validations/project";

/**
 * Project read/write service. All business logic for projects lives here:
 * route handlers and server components call these functions and do no data
 * manipulation of their own.
 */

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Build the Prisma filter from parsed URL query state.
 *
 * Async because the `needsVerification` filter needs the evidence-rule project
 * ids, which require a SQL round trip (see lib/services/verification.ts).
 */
export async function buildProjectWhere(
  query: ProjectQuery,
): Promise<Prisma.ProjectWhereInput> {
  const and: Prisma.ProjectWhereInput[] = [];

  if (query.q) {
    // Postgres full-text search would need a tsvector column and a trigram
    // extension; for the MVP an indexed case-insensitive scan across the
    // meaningful text columns is accurate and fast enough at this row count.
    const term = query.q;
    and.push({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { city: { contains: term, mode: "insensitive" } },
        { stateRegion: { contains: term, mode: "insensitive" } },
        { country: { contains: term, mode: "insensitive" } },
        { gpuModel: { contains: term, mode: "insensitive" } },
        { computePlatform: { contains: term, mode: "insensitive" } },
        { utilityProvider: { contains: term, mode: "insensitive" } },
        { analystNotes: { contains: term, mode: "insensitive" } },
        { ownerCompany: { name: { contains: term, mode: "insensitive" } } },
        { sources: { some: { title: { contains: term, mode: "insensitive" } } } },
      ],
    });
  }

  if (query.status.length) and.push({ status: { in: query.status } });
  if (query.projectType.length) and.push({ projectType: { in: query.projectType } });
  if (query.country.length) and.push({ country: { in: query.country } });
  if (query.ownerId.length) and.push({ ownerCompanyId: { in: query.ownerId } });
  if (query.gpuModel.length) and.push({ gpuModel: { in: query.gpuModel } });
  if (query.tag.length) and.push({ tags: { some: { slug: { in: query.tag } } } });

  if (query.minPowerMw !== undefined) {
    // Applies to the best available figure, matching what the table displays.
    and.push({
      OR: [
        { confirmedPowerMw: { gte: query.minPowerMw } },
        {
          AND: [
            { confirmedPowerMw: null },
            { estimatedPowerMw: { gte: query.minPowerMw } },
          ],
        },
      ],
    });
  }

  if (query.openingYear !== undefined) {
    const start = new Date(Date.UTC(query.openingYear, 0, 1));
    const end = new Date(Date.UTC(query.openingYear + 1, 0, 1));
    and.push({
      OR: [
        { actualOpeningDate: { gte: start, lt: end } },
        {
          AND: [
            { actualOpeningDate: null },
            { expectedOpeningDate: { gte: start, lt: end } },
          ],
        },
      ],
    });
  }

  if (query.needsVerification) and.push(await fullVerificationQueueWhere());
  if (!query.includeDemo) and.push({ isDemoData: false });

  return and.length ? { AND: and } : {};
}

/** Map a sort field to a Prisma orderBy clause. */
function buildOrderBy(
  sort: ProjectQuery["sort"],
): Prisma.ProjectOrderByWithRelationInput[] {
  const dir = sort.direction;
  switch (sort.field) {
    // No SQL expression for COALESCE ordering in Prisma's typed API, so sort by
    // the confirmed figure first and let the estimate break ties. Nulls last so
    // an unknown capacity never tops a "largest first" sort.
    case "powerMw":
      return [
        { confirmedPowerMw: { sort: dir, nulls: "last" } },
        { estimatedPowerMw: { sort: dir, nulls: "last" } },
      ];
    case "gpuCount":
      return [
        { confirmedGpuCount: { sort: dir, nulls: "last" } },
        { estimatedGpuCount: { sort: dir, nulls: "last" } },
      ];
    case "expectedOpeningDate":
      return [{ expectedOpeningDate: { sort: dir, nulls: "last" } }];
    case "lastVerifiedAt":
      return [{ lastVerifiedAt: { sort: dir, nulls: "first" } }];
    case "confidenceScore":
      return [{ confidenceScore: { sort: dir, nulls: "last" } }];
    default:
      return [{ [sort.field]: dir }];
  }
}

export const PROJECT_ROW_SELECT = {
  id: true,
  slug: true,
  name: true,
  status: true,
  projectType: true,
  city: true,
  stateRegion: true,
  country: true,
  latitude: true,
  longitude: true,
  estimatedPowerMw: true,
  confirmedPowerMw: true,
  estimatedGpuCount: true,
  confirmedGpuCount: true,
  gpuModel: true,
  computePlatform: true,
  estimatedCapexUsd: true,
  confirmedCapexUsd: true,
  expectedOpeningDate: true,
  actualOpeningDate: true,
  lastVerifiedAt: true,
  confidenceScore: true,
  isDemoData: true,
  createdAt: true,
  updatedAt: true,
  ownerCompany: { select: { id: true, name: true, slug: true, ticker: true } },
  _count: { select: { sources: true } },
} satisfies Prisma.ProjectSelect;

type ProjectRowRaw = Prisma.ProjectGetPayload<{ select: typeof PROJECT_ROW_SELECT }>;

/** Decimals serialised to strings, so rows are safe to hand to client components. */
export type ProjectRow = Omit<
  ProjectRowRaw,
  (typeof PROJECT_DECIMAL_FIELDS)[number]
> & {
  [K in (typeof PROJECT_DECIMAL_FIELDS)[number]]: string | null;
};

export async function listProjects(query: ProjectQuery): Promise<{
  rows: ProjectRow[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
}> {
  const where = await buildProjectWhere(query);

  const [rawRows, total] = await Promise.all([
    prisma.project.findMany({
      where,
      select: PROJECT_ROW_SELECT,
      orderBy: buildOrderBy(query.sort),
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
    }),
    prisma.project.count({ where }),
  ]);

  return {
    rows: rawRows.map((r) => serializeDecimalFields(r, PROJECT_DECIMAL_FIELDS)),
    total,
    page: query.page,
    perPage: query.perPage,
    pageCount: Math.max(1, Math.ceil(total / query.perPage)),
  };
}

/** Every project with coordinates, for the map. Deliberately not paginated. */
export async function listProjectsForMap(query: ProjectQuery) {
  const rows = await prisma.project.findMany({
    where: {
      AND: [
        await buildProjectWhere(query),
        { latitude: { not: null } },
        { longitude: { not: null } },
      ],
    },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      projectType: true,
      latitude: true,
      longitude: true,
      city: true,
      stateRegion: true,
      country: true,
      estimatedPowerMw: true,
      confirmedPowerMw: true,
      estimatedGpuCount: true,
      confirmedGpuCount: true,
      estimatedCapexUsd: true,
      confirmedCapexUsd: true,
      expectedOpeningDate: true,
      isDemoData: true,
      ownerCompany: { select: { name: true } },
    },
    take: 5000,
  });

  return rows.map((r) => serializeDecimalFields(r, PROJECT_DECIMAL_FIELDS));
}

export type MapProject = Awaited<ReturnType<typeof listProjectsForMap>>[number];

export async function getProjectBySlug(slug: string) {
  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      ownerCompany: true,
      tags: true,
      companies: {
        include: { company: true },
        orderBy: { role: "asc" },
      },
      sources: { orderBy: [{ isPrimarySource: "desc" }, { publicationDate: "desc" }] },
      metrics: {
        include: {
          source: { select: { id: true, title: true, publisher: true, url: true } },
        },
        orderBy: [{ metricType: "asc" }, { effectiveDate: "desc" }],
      },
      revisions: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!project) throw new NotFoundError("Project");
  return project;
}

export type ProjectDetail = Awaited<ReturnType<typeof getProjectBySlug>>;

/**
 * Other projects worth looking at alongside this one: same owner first, then
 * same country. Cheap heuristic, but it is what an analyst actually wants.
 */
export async function getRelatedProjects(project: {
  id: string;
  ownerCompanyId: string | null;
  country: string;
}): Promise<ProjectRow[]> {
  const rows = await prisma.project.findMany({
    where: {
      id: { not: project.id },
      OR: [
        ...(project.ownerCompanyId ? [{ ownerCompanyId: project.ownerCompanyId }] : []),
        { country: project.country },
      ],
    },
    select: PROJECT_ROW_SELECT,
    orderBy: [{ confirmedPowerMw: { sort: "desc", nulls: "last" } }],
    take: 6,
  });

  return rows.map((r) => serializeDecimalFields(r, PROJECT_DECIMAL_FIELDS));
}

/** Distinct values for the filter dropdowns. */
export async function getFilterFacets() {
  const [countries, gpuModels, owners, tags] = await Promise.all([
    prisma.project.findMany({
      distinct: ["country"],
      select: { country: true },
      orderBy: { country: "asc" },
    }),
    prisma.project.findMany({
      where: { gpuModel: { not: null } },
      distinct: ["gpuModel"],
      select: { gpuModel: true },
      orderBy: { gpuModel: "asc" },
    }),
    prisma.company.findMany({
      where: { ownedProjects: { some: {} } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.tag.findMany({
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    countries: countries.map((c) => c.country),
    gpuModels: gpuModels.map((g) => g.gpuModel).filter((g): g is string => Boolean(g)),
    owners,
    tags,
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Scalar columns, shared by create and update. */
function scalarData(input: ProjectInput) {
  return {
    name: input.name,
    description: input.description,
    ownerCompanyId: input.ownerCompanyId || null,
    projectType: input.projectType,
    status: input.status,
    city: input.city,
    stateRegion: input.stateRegion,
    country: input.country,
    latitude: input.latitude,
    longitude: input.longitude,
    announcementDate: input.announcementDate,
    expectedOpeningDate: input.expectedOpeningDate,
    actualOpeningDate: input.actualOpeningDate,
    estimatedPowerMw: input.estimatedPowerMw,
    confirmedPowerMw: input.confirmedPowerMw,
    estimatedGpuCount: input.estimatedGpuCount,
    confirmedGpuCount: input.confirmedGpuCount,
    gpuModel: input.gpuModel,
    computePlatform: input.computePlatform,
    estimatedCapexUsd: input.estimatedCapexUsd,
    confirmedCapexUsd: input.confirmedCapexUsd,
    squareFeet: input.squareFeet,
    coolingTechnology: input.coolingTechnology,
    powerSource: input.powerSource,
    utilityProvider: input.utilityProvider,
    confidenceScore: input.confidenceScore,
    analystNotes: input.analystNotes,
    lastVerifiedAt: input.lastVerifiedAt,
  };
}

/** Upsert tags by name and return connect clauses. */
async function tagConnect(tx: Prisma.TransactionClient, names: string[]) {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const tags = await Promise.all(
    unique.map((name) =>
      tx.tag.upsert({
        where: { name },
        update: {},
        create: { name, slug: slugify(name) },
      }),
    ),
  );
  return tags.map((t) => ({ id: t.id }));
}

/**
 * Metric `sourceId` may be an index into the request's own `sources` array
 * (written by the form as "new:0") rather than a persisted id. Resolve those
 * against the ids created in this transaction.
 */
function resolveMetricSourceId(
  raw: string | null | undefined,
  createdSourceIds: string[],
): string | null {
  if (!raw) return null;
  const newMatch = /^new:(\d+)$/.exec(raw);
  if (newMatch) {
    const index = Number(newMatch[1]);
    return createdSourceIds[index] ?? null;
  }
  return raw;
}

export type CreateProjectResult = {
  project: { id: string; slug: string; name: string };
  warnings: string[];
};

export async function createProject(
  input: ProjectInput,
  userId: string | null,
): Promise<CreateProjectResult> {
  // Duplicate check is advisory but blocking until acknowledged, so a
  // double-submit cannot quietly create a second copy of a campus.
  if (!input.acknowledgeDuplicate) {
    const duplicates = await findDuplicateProjects({
      name: input.name,
      ownerCompanyId: input.ownerCompanyId,
      city: input.city,
      stateRegion: input.stateRegion,
      country: input.country,
    });
    if (duplicates.length > 0) {
      throw new ConflictError(
        "This looks like a project already in the database. Review the matches, then resubmit with acknowledgeDuplicate to save anyway.",
        { duplicates },
      );
    }
  }

  const slug = await uniqueProjectSlug(input.slug || input.name);

  const created = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        ...scalarData(input),
        slug,
        tags: { connect: await tagConnect(tx, input.tagNames) },
        companies: {
          create: input.suppliers.map((s) => ({
            companyId: s.companyId,
            role: s.role,
            notes: s.notes,
          })),
        },
      },
      select: { id: true, slug: true, name: true },
    });

    const createdSourceIds: string[] = [];
    for (const source of input.sources) {
      const row = await tx.source.create({
        data: {
          projectId: project.id,
          title: source.title,
          publisher: source.publisher,
          url: source.url,
          publicationDate: source.publicationDate,
          sourceType: source.sourceType,
          excerpt: source.excerpt,
          archivedUrl: source.archivedUrl,
          reliabilityScore: source.reliabilityScore,
          isPrimarySource: source.isPrimarySource,
          accessedAt: source.accessedAt,
        },
        select: { id: true },
      });
      createdSourceIds.push(row.id);
    }

    for (const metric of input.metrics) {
      const sourceId = resolveMetricSourceId(metric.sourceId, createdSourceIds);
      // Re-check post-persist: the schema check can only see that *some* source
      // was referenced, not that it resolved to a real row.
      if (metric.confidenceLevel === "CONFIRMED" && !sourceId) {
        throw new DataQualityError(
          `A CONFIRMED ${metric.metricType} metric must cite a source that exists.`,
        );
      }
      await tx.projectMetric.create({
        data: {
          projectId: project.id,
          metricType: metric.metricType,
          numericValue: metric.numericValue,
          textValue: metric.textValue,
          unit: metric.unit,
          confidenceLevel: metric.confidenceLevel,
          methodology: metric.methodology,
          effectiveDate: metric.effectiveDate,
          sourceId,
        },
      });
    }

    await recordRevision(tx, {
      projectId: project.id,
      userId,
      diffs: [],
      summary: `Project created with ${input.sources.length} source(s) and ${input.metrics.length} metric(s).`,
    });

    return project;
  });

  return {
    project: created,
    warnings: projectWarnings({ ...input, sources: input.sources }),
  };
}

export async function updateProject(
  projectId: string,
  input: ProjectInput,
  userId: string | null,
): Promise<CreateProjectResult> {
  const before = await prisma.project.findUnique({
    where: { id: projectId },
    include: { tags: true },
  });
  if (!before) throw new NotFoundError("Project");

  const slug = input.slug
    ? await uniqueProjectSlug(input.slug, projectId)
    : before.slug;

  const updated = await prisma.$transaction(async (tx) => {
    const nextScalars = scalarData(input);

    const project = await tx.project.update({
      where: { id: projectId },
      data: {
        ...nextScalars,
        slug,
        // `set` replaces the tag list so a removed tag is actually removed.
        tags: { set: await tagConnect(tx, input.tagNames) },
      },
      select: { id: true, slug: true, name: true },
    });

    // Supplier links are replaced wholesale: the form submits the complete
    // intended list, and diffing them individually adds no audit value.
    await tx.projectCompany.deleteMany({ where: { projectId } });
    if (input.suppliers.length) {
      await tx.projectCompany.createMany({
        data: input.suppliers.map((s) => ({
          projectId,
          companyId: s.companyId,
          role: s.role,
          notes: s.notes,
        })),
        skipDuplicates: true,
      });
    }

    // Sources: update those with an id, create the rest. Never delete silently —
    // an omitted source is left in place, since dropping evidence should be an
    // explicit action, not a side effect of an edit.
    const createdSourceIds: string[] = [];
    for (const source of input.sources) {
      if (source.id) {
        await tx.source.update({
          where: { id: source.id },
          data: {
            title: source.title,
            publisher: source.publisher,
            url: source.url,
            publicationDate: source.publicationDate,
            sourceType: source.sourceType,
            excerpt: source.excerpt,
            archivedUrl: source.archivedUrl,
            reliabilityScore: source.reliabilityScore,
            isPrimarySource: source.isPrimarySource,
            accessedAt: source.accessedAt,
          },
        });
        createdSourceIds.push(source.id);
      } else {
        const row = await tx.source.create({
          data: {
            projectId,
            title: source.title,
            publisher: source.publisher,
            url: source.url,
            publicationDate: source.publicationDate,
            sourceType: source.sourceType,
            excerpt: source.excerpt,
            archivedUrl: source.archivedUrl,
            reliabilityScore: source.reliabilityScore,
            isPrimarySource: source.isPrimarySource,
            accessedAt: source.accessedAt,
          },
          select: { id: true },
        });
        createdSourceIds.push(row.id);
      }
    }

    for (const metric of input.metrics) {
      const sourceId = resolveMetricSourceId(metric.sourceId, createdSourceIds);
      if (metric.confidenceLevel === "CONFIRMED" && !sourceId) {
        throw new DataQualityError(
          `A CONFIRMED ${metric.metricType} metric must cite a source that exists.`,
        );
      }
      const data = {
        metricType: metric.metricType,
        numericValue: metric.numericValue,
        textValue: metric.textValue,
        unit: metric.unit,
        confidenceLevel: metric.confidenceLevel,
        methodology: metric.methodology,
        effectiveDate: metric.effectiveDate,
        sourceId,
      };
      if (metric.id) {
        await tx.projectMetric.update({ where: { id: metric.id }, data });
      } else {
        await tx.projectMetric.create({ data: { ...data, projectId } });
      }
    }

    const diffs = diffProject(
      before as unknown as Record<string, unknown>,
      { ...nextScalars, slug } as unknown as Record<string, unknown>,
    );
    await recordRevision(tx, { projectId, userId, diffs });

    return project;
  });

  return {
    project: updated,
    warnings: projectWarnings({ ...input, sources: input.sources }),
  };
}

export async function deleteProject(projectId: string): Promise<void> {
  // Children cascade at the DB level (see schema onDelete: Cascade).
  const existing = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError("Project");
  await prisma.project.delete({ where: { id: projectId } });
}

/** Bulk status change from the table's row selection. */
export async function bulkUpdateStatus(
  projectIds: string[],
  status: ProjectInput["status"],
  userId: string | null,
): Promise<number> {
  if (projectIds.length === 0) return 0;

  return prisma.$transaction(async (tx) => {
    const before = await tx.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, status: true },
    });

    await tx.project.updateMany({
      where: { id: { in: projectIds } },
      data: { status },
    });

    for (const row of before) {
      if (row.status === status) continue; // not a material change
      await recordRevision(tx, {
        projectId: row.id,
        userId,
        diffs: [{ field: "status", from: row.status, to: status }],
        summary: `Status changed from ${row.status} to ${status} (bulk edit).`,
      });
    }

    return before.filter((r) => r.status !== status).length;
  });
}

/** Bulk tag add from the table's row selection. */
export async function bulkAddTags(
  projectIds: string[],
  tagNames: string[],
  userId: string | null,
): Promise<number> {
  if (projectIds.length === 0 || tagNames.length === 0) return 0;

  return prisma.$transaction(async (tx) => {
    const connect = await tagConnect(tx, tagNames);
    for (const id of projectIds) {
      await tx.project.update({
        where: { id },
        data: { tags: { connect } },
      });
      await recordRevision(tx, {
        projectId: id,
        userId,
        diffs: [],
        summary: `Tagged: ${tagNames.join(", ")} (bulk edit).`,
      });
    }
    return projectIds.length;
  });
}
