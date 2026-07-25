import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { SourceInboxForm } from "@/components/sources/source-inbox-form";
import { prisma } from "@/lib/db";
import { can, requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Add source" };

export default async function NewSourcePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const user = await requireUser();
  if (!can(user.role, "record:create")) redirect("/sources");

  const { projectId } = await searchParams;

  const projects = await prisma.project.findMany({
    select: { id: true, name: true, country: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader
        title="Add source"
        subtitle="Three steps: describe the source, attach it to a project, then record the claims it supports as cited metrics."
      />
      <SourceInboxForm projects={projects} defaultProjectId={projectId} />
    </>
  );
}
