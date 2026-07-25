import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { slugify, toNumber } from "@/lib/format";
import { SUPPLIER_ROLES } from "@/lib/domain";
import { PROJECT_DECIMAL_FIELDS, serializeDecimalFields } from "@/lib/serialize";
import { ConflictError, NotFoundError } from "@/lib/services/errors";
import type { CompanyInput, CompanyQuery } from "@/lib/validations/company";

export async function listCompanies(query: CompanyQuery) {
  const and: Prisma.CompanyWhereInput[] = [];

  if (query.q) {
    and.push({
      OR: [
        { name: { contains: query.q, mode: "insensitive" } },
        { ticker: { contains: query.q, mode: "insensitive" } },
        { description: { contains: query.q, mode: "insensitive" } },
        { headquartersCountry: { contains: query.q, mode: "insensitive" } },
      ],
    });
  }
  if (query.companyType.length) and.push({ companyType: { in: query.companyType } });
  if (query.hasTicker) and.push({ ticker: { not: null } });

  const where: Prisma.CompanyWhereInput = and.length ? { AND: and } : {};

  // projectCount sorts on a relation aggregate, which needs orderBy._count.
  const orderBy: Prisma.CompanyOrderByWithRelationInput =
    query.sort.field === "projectCount"
      ? { ownedProjects: { _count: query.sort.direction } }
      : query.sort.field === "ticker"
        ? { ticker: { sort: query.sort.direction, nulls: "last" } }
        : { [query.sort.field]: query.sort.direction };

  const [rows, total] = await Promise.all([
    prisma.company.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
      include: {
        _count: { select: { ownedProjects: true, projectLinks: true } },
      },
    }),
    prisma.company.count({ where }),
  ]);

  return {
    rows,
    total,
    page: query.page,
    perPage: query.perPage,
    pageCount: Math.max(1, Math.ceil(total / query.perPage)),
  };
}

const EXPOSURE_SELECT = {
  id: true,
  slug: true,
  name: true,
  status: true,
  projectType: true,
  country: true,
  city: true,
  stateRegion: true,
  estimatedPowerMw: true,
  confirmedPowerMw: true,
  estimatedGpuCount: true,
  confirmedGpuCount: true,
  expectedOpeningDate: true,
  isDemoData: true,
  ownerCompany: { select: { name: true, slug: true } },
} satisfies Prisma.ProjectSelect;

type ExposureProject = Prisma.ProjectGetPayload<{ select: typeof EXPOSURE_SELECT }>;

/**
 * Company detail with exposure rollups.
 *
 * "Associated MW" deliberately counts each project once per relationship
 * category (owned / operated / supplied) rather than summing across them — a
 * company that both owns and supplies a site would otherwise double-count its
 * own exposure.
 */
export async function getCompanyBySlug(slug: string) {
  const company = await prisma.company.findUnique({
    where: { slug },
    include: {
      ownedProjects: { select: EXPOSURE_SELECT, orderBy: { name: "asc" } },
      projectLinks: {
        include: { project: { select: EXPOSURE_SELECT } },
        orderBy: { role: "asc" },
      },
    },
  });

  if (!company) throw new NotFoundError("Company");

  const operated = company.projectLinks.filter(
    (l) => l.role === "OPERATOR" || l.role === "DEVELOPER",
  );
  const supplied = company.projectLinks.filter((l) => SUPPLIER_ROLES.includes(l.role));
  const tenanted = company.projectLinks.filter((l) => l.role === "TENANT");
  const invested = company.projectLinks.filter((l) => l.role === "INVESTOR");

  /** Best-available MW/GPU across a distinct set of projects. */
  const rollup = (
    projects: {
      id: string;
      estimatedPowerMw: unknown;
      confirmedPowerMw: unknown;
      estimatedGpuCount: number | null;
      confirmedGpuCount: number | null;
      status: string;
    }[],
  ) => {
    const seen = new Set<string>();
    let powerMw = 0;
    let gpuCount = 0;
    let count = 0;
    for (const p of projects) {
      if (seen.has(p.id) || p.status === "CANCELLED") continue;
      seen.add(p.id);
      count += 1;
      powerMw +=
        toNumber(p.confirmedPowerMw as never) ??
        toNumber(p.estimatedPowerMw as never) ??
        0;
      gpuCount += p.confirmedGpuCount ?? p.estimatedGpuCount ?? 0;
    }
    return { count, powerMw, gpuCount };
  };

  const allAssociated = [
    ...company.ownedProjects,
    ...company.projectLinks.map((l) => l.project),
  ];

  // Geographic exposure across every relationship, deduped by project.
  const byCountry = new Map<string, { count: number; powerMw: number }>();
  const seenForGeo = new Set<string>();
  for (const p of allAssociated) {
    if (seenForGeo.has(p.id) || p.status === "CANCELLED") continue;
    seenForGeo.add(p.id);
    const entry = byCountry.get(p.country) ?? { count: 0, powerMw: 0 };
    entry.count += 1;
    entry.powerMw +=
      toNumber(p.confirmedPowerMw as never) ??
      toNumber(p.estimatedPowerMw as never) ??
      0;
    byCountry.set(p.country, entry);
  }

  // Upcoming timeline: dated, not yet open, soonest first.
  const upcoming = [...allAssociated]
    .filter(
      (p, i, arr) =>
        arr.findIndex((x) => x.id === p.id) === i &&
        p.expectedOpeningDate !== null &&
        p.status !== "OPERATIONAL" &&
        p.status !== "CANCELLED",
    )
    .sort(
      (a, b) =>
        (a.expectedOpeningDate?.getTime() ?? 0) -
        (b.expectedOpeningDate?.getTime() ?? 0),
    )
    .slice(0, 12);

  // Serialise Decimals here so the page can hand these rows straight to client
  // components without each call site remembering to convert.
  const plain = (p: ExposureProject) =>
    serializeDecimalFields(p, PROJECT_DECIMAL_FIELDS);

  return {
    company,
    owned: company.ownedProjects.map(plain),
    operated: operated.map((l) => plain(l.project)),
    supplied: supplied.map((l) => ({ project: plain(l.project), role: l.role })),
    tenanted: tenanted.map((l) => plain(l.project)),
    invested: invested.map((l) => plain(l.project)),
    totals: {
      owned: rollup(company.ownedProjects),
      operated: rollup(operated.map((l) => l.project)),
      supplied: rollup(supplied.map((l) => l.project)),
      all: rollup(allAssociated),
    },
    geography: [...byCountry.entries()]
      .map(([country, v]) => ({ country, ...v }))
      .sort((a, b) => b.powerMw - a.powerMw),
    upcoming: upcoming.map(plain),
  };
}

export async function createCompany(input: CompanyInput) {
  const slug = input.slug ? slugify(input.slug) : slugify(input.name);

  const existing = await prisma.company.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (existing) {
    throw new ConflictError(`A company with the slug "${slug}" already exists.`, {
      existing,
    });
  }

  return prisma.company.create({
    data: {
      name: input.name,
      slug,
      companyType: input.companyType,
      ticker: input.ticker,
      website: input.website,
      headquartersCountry: input.headquartersCountry,
      description: input.description,
    },
  });
}

export async function updateCompany(id: string, input: Partial<CompanyInput>) {
  const existing = await prisma.company.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError("Company");

  return prisma.company.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.companyType !== undefined ? { companyType: input.companyType } : {}),
      ...(input.ticker !== undefined ? { ticker: input.ticker } : {}),
      ...(input.website !== undefined ? { website: input.website } : {}),
      ...(input.headquartersCountry !== undefined
        ? { headquartersCountry: input.headquartersCountry }
        : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.slug ? { slug: slugify(input.slug) } : {}),
    },
  });
}

export async function deleteCompany(id: string) {
  const existing = await prisma.company.findUnique({
    where: { id },
    select: { _count: { select: { ownedProjects: true } } },
  });
  if (!existing) throw new NotFoundError("Company");

  // Refuse rather than orphan: SetNull would silently strip the owner from live
  // projects, which reads as "unattributed" and loses information.
  if (existing._count.ownedProjects > 0) {
    throw new ConflictError(
      `This company owns ${existing._count.ownedProjects} project(s). Reassign them before deleting.`,
    );
  }

  await prisma.company.delete({ where: { id } });
}

/** Lightweight list for form selects. */
export async function getCompanyOptions() {
  return prisma.company.findMany({
    select: { id: true, name: true, companyType: true, ticker: true },
    orderBy: { name: "asc" },
  });
}

/** Public-company exposure table for the analytics page. */
export async function getPublicCompanyExposure() {
  const companies = await prisma.company.findMany({
    where: { ticker: { not: null } },
    select: {
      id: true,
      name: true,
      slug: true,
      ticker: true,
      companyType: true,
      ownedProjects: {
        where: { status: { not: "CANCELLED" } },
        select: { id: true, estimatedPowerMw: true, confirmedPowerMw: true },
      },
      projectLinks: {
        where: { project: { status: { not: "CANCELLED" } } },
        select: {
          role: true,
          project: {
            select: { id: true, estimatedPowerMw: true, confirmedPowerMw: true },
          },
        },
      },
    },
  });

  return companies
    .map((c) => {
      const seen = new Set<string>();
      let ownedMw = 0;
      let linkedMw = 0;

      for (const p of c.ownedProjects) {
        seen.add(p.id);
        ownedMw += toNumber(p.confirmedPowerMw) ?? toNumber(p.estimatedPowerMw) ?? 0;
      }
      for (const l of c.projectLinks) {
        if (seen.has(l.project.id)) continue;
        seen.add(l.project.id);
        linkedMw +=
          toNumber(l.project.confirmedPowerMw) ??
          toNumber(l.project.estimatedPowerMw) ??
          0;
      }

      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        ticker: c.ticker,
        companyType: c.companyType,
        projectCount: seen.size,
        ownedMw,
        linkedMw,
        totalMw: ownedMw + linkedMw,
      };
    })
    .filter((c) => c.projectCount > 0)
    .sort((a, b) => b.totalMw - a.totalMw);
}

/** Supplier exposure: which vendors appear on the most capacity. */
export async function getSupplierExposure() {
  const links = await prisma.projectCompany.findMany({
    where: {
      role: { in: SUPPLIER_ROLES },
      project: { status: { not: "CANCELLED" } },
    },
    select: {
      role: true,
      company: { select: { id: true, name: true, slug: true, ticker: true } },
      project: { select: { id: true, estimatedPowerMw: true, confirmedPowerMw: true } },
    },
  });

  const byCompany = new Map<
    string,
    {
      name: string;
      slug: string;
      ticker: string | null;
      projects: Set<string>;
      powerMw: number;
      roles: Set<string>;
    }
  >();

  for (const link of links) {
    const entry = byCompany.get(link.company.id) ?? {
      name: link.company.name,
      slug: link.company.slug,
      ticker: link.company.ticker,
      projects: new Set<string>(),
      powerMw: 0,
      roles: new Set<string>(),
    };
    entry.roles.add(link.role);
    if (!entry.projects.has(link.project.id)) {
      entry.projects.add(link.project.id);
      entry.powerMw +=
        toNumber(link.project.confirmedPowerMw) ??
        toNumber(link.project.estimatedPowerMw) ??
        0;
    }
    byCompany.set(link.company.id, entry);
  }

  return [...byCompany.entries()]
    .map(([id, v]) => ({
      id,
      name: v.name,
      slug: v.slug,
      ticker: v.ticker,
      projectCount: v.projects.size,
      powerMw: v.powerMw,
      roles: [...v.roles],
    }))
    .sort((a, b) => b.powerMw - a.powerMw);
}
