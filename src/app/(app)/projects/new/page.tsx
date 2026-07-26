import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { EMPTY_PROJECT, ProjectForm } from "@/components/projects/project-form";
import { can, getSessionUser } from "@/lib/permissions";
import { getCompanyOptions } from "@/lib/services/companies";

export const metadata: Metadata = { title: "Add project" };

export default async function NewProjectPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!can(user.role, "record:create")) redirect("/projects");

  const companies = await getCompanyOptions();

  return (
    <>
      <PageHeader
        title="Add project"
        subtitle="Record what a source actually says. Leave a field blank when the value is unknown — a blank means 'not disclosed', and entering 0 would assert something different."
      />
      <ProjectForm mode="create" defaultValues={EMPTY_PROJECT} companies={companies} />
    </>
  );
}
