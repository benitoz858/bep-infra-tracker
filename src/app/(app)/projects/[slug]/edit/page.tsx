import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import {
  type ProjectFormValues,
  ProjectForm,
} from "@/components/projects/project-form";
import { can, requireUser } from "@/lib/permissions";
import { getCompanyOptions } from "@/lib/services/companies";
import { NotFoundError } from "@/lib/services/errors";
import { getProjectBySlug } from "@/lib/services/projects";
import { decimalToString } from "@/lib/serialize";

export const metadata: Metadata = { title: "Edit project" };

/** `<input type="date">` needs a bare YYYY-MM-DD, in UTC to avoid a day shift. */
function dateInput(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

function str(value: string | number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;

  if (!can(user.role, "record:edit")) redirect(`/projects/${slug}`);

  let project: Awaited<ReturnType<typeof getProjectBySlug>>;
  try {
    project = await getProjectBySlug(slug);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const companies = await getCompanyOptions();

  const defaultValues: ProjectFormValues = {
    name: project.name,
    slug: project.slug,
    description: str(project.description),
    ownerCompanyId: str(project.ownerCompanyId),
    projectType: project.projectType,
    status: project.status,
    city: str(project.city),
    stateRegion: str(project.stateRegion),
    country: project.country,
    latitude: str(project.latitude),
    longitude: str(project.longitude),
    announcementDate: dateInput(project.announcementDate),
    expectedOpeningDate: dateInput(project.expectedOpeningDate),
    actualOpeningDate: dateInput(project.actualOpeningDate),
    estimatedPowerMw: str(decimalToString(project.estimatedPowerMw)),
    confirmedPowerMw: str(decimalToString(project.confirmedPowerMw)),
    estimatedGpuCount: str(project.estimatedGpuCount),
    confirmedGpuCount: str(project.confirmedGpuCount),
    gpuModel: str(project.gpuModel),
    computePlatform: str(project.computePlatform),
    estimatedCapexUsd: str(decimalToString(project.estimatedCapexUsd)),
    confirmedCapexUsd: str(decimalToString(project.confirmedCapexUsd)),
    squareFeet: str(project.squareFeet),
    coolingTechnology: str(project.coolingTechnology),
    powerSource: str(project.powerSource),
    utilityProvider: str(project.utilityProvider),
    confidenceScore: str(project.confidenceScore),
    analystNotes: str(project.analystNotes),
    lastVerifiedAt: dateInput(project.lastVerifiedAt),
    tagNames: project.tags.map((t) => t.name).join(", "),
    suppliers: project.companies.map((c) => ({
      companyId: c.companyId,
      role: c.role,
      notes: str(c.notes),
    })),
    sources: project.sources.map((s) => ({
      id: s.id,
      title: s.title,
      publisher: str(s.publisher),
      url: s.url,
      publicationDate: dateInput(s.publicationDate),
      sourceType: s.sourceType,
      excerpt: str(s.excerpt),
      archivedUrl: str(s.archivedUrl),
      reliabilityScore: str(s.reliabilityScore),
      isPrimarySource: s.isPrimarySource,
    })),
    metrics: project.metrics.map((m) => ({
      id: m.id,
      metricType: m.metricType,
      numericValue: str(decimalToString(m.numericValue)),
      textValue: str(m.textValue),
      unit: str(m.unit),
      confidenceLevel: m.confidenceLevel,
      methodology: str(m.methodology),
      effectiveDate: dateInput(m.effectiveDate),
      sourceId: str(m.sourceId),
    })),
  };

  return (
    <>
      <PageHeader
        title={`Edit: ${project.name}`}
        subtitle="Material changes are recorded in the revision history with a before/after diff."
      />
      <ProjectForm
        mode="edit"
        projectId={project.id}
        projectSlug={project.slug}
        defaultValues={defaultValues}
        companies={companies}
      />
    </>
  );
}
