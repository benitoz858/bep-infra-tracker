import { hash } from "bcryptjs";

import type { CompanyType, Role } from "@/generated/prisma/enums";
import { slugify } from "@/lib/format";
import type { ProjectInput } from "@/lib/validations/project";
import { testDb } from "./db";

/** Minimal valid project input; override only what a test cares about. */
export function projectInput(overrides: Partial<ProjectInput> = {}): ProjectInput {
  return {
    name: "Test Campus",
    slug: null,
    description: null,
    ownerCompanyId: null,
    projectType: "DATA_CENTER",
    status: "ANNOUNCED",
    city: null,
    stateRegion: null,
    country: "United States",
    latitude: null,
    longitude: null,
    announcementDate: null,
    expectedOpeningDate: null,
    actualOpeningDate: null,
    estimatedPowerMw: null,
    confirmedPowerMw: null,
    estimatedGpuCount: null,
    confirmedGpuCount: null,
    gpuModel: null,
    computePlatform: null,
    estimatedCapexUsd: null,
    confirmedCapexUsd: null,
    squareFeet: null,
    coolingTechnology: null,
    powerSource: null,
    utilityProvider: null,
    confidenceScore: null,
    analystNotes: null,
    lastVerifiedAt: null,
    tagNames: [],
    suppliers: [],
    sources: [],
    metrics: [],
    // Tests assert duplicate behaviour explicitly; default to not tripping it.
    acknowledgeDuplicate: true,
    allowDuplicateSourceUrl: false,
    ...overrides,
  } as ProjectInput;
}

export async function makeUser(role: Role = "ANALYST", email?: string) {
  const address = email ?? `${role.toLowerCase()}-${Date.now()}@test.local`;
  return testDb.user.create({
    data: {
      email: address,
      name: `Test ${role}`,
      role,
      passwordHash: await hash("test-password", 4),
    },
  });
}

export async function makeCompany(
  name = "Test Hyperscaler",
  companyType: CompanyType = "HYPERSCALER",
) {
  return testDb.company.create({
    data: { name, slug: slugify(name), companyType },
  });
}

/** A project written directly, bypassing the service — for read-path tests. */
export async function makeProject(data: {
  name: string;
  country?: string;
  status?: ProjectInput["status"];
  confirmedPowerMw?: number;
  estimatedPowerMw?: number;
  confirmedGpuCount?: number;
  estimatedGpuCount?: number;
  lastVerifiedAt?: Date | null;
  expectedOpeningDate?: Date | null;
  ownerCompanyId?: string | null;
  isDemoData?: boolean;
  sourceCount?: number;
  sourceReliability?: number;
}) {
  const project = await testDb.project.create({
    data: {
      name: data.name,
      slug: slugify(data.name),
      country: data.country ?? "United States",
      projectType: "DATA_CENTER",
      status: data.status ?? "ANNOUNCED",
      confirmedPowerMw: data.confirmedPowerMw ?? null,
      estimatedPowerMw: data.estimatedPowerMw ?? null,
      confirmedGpuCount: data.confirmedGpuCount ?? null,
      estimatedGpuCount: data.estimatedGpuCount ?? null,
      // `?? new Date()` would turn an explicit null into "verified now" and make
      // the never-verified tests silently pass against the wrong state. Presence
      // of the key is what distinguishes "unset" from "deliberately null".
      lastVerifiedAt: "lastVerifiedAt" in data ? data.lastVerifiedAt : new Date(),
      expectedOpeningDate: data.expectedOpeningDate ?? null,
      ownerCompanyId: data.ownerCompanyId ?? null,
      isDemoData: data.isDemoData ?? false,
    },
  });

  for (let i = 0; i < (data.sourceCount ?? 2); i += 1) {
    await testDb.source.create({
      data: {
        projectId: project.id,
        title: `${data.name} source ${i + 1}`,
        url: `https://example.com/${project.slug}/${i + 1}`,
        sourceType: "NEWS_ARTICLE",
        reliabilityScore: data.sourceReliability ?? 90,
      },
    });
  }

  return project;
}
