import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ImportWizard } from "@/components/import/import-wizard";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { can, requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Import" };

export default async function ImportPage() {
  const user = await requireUser();
  if (!can(user.role, "data:import")) redirect("/projects");

  return (
    <>
      <PageHeader
        title="Import"
        subtitle="Bulk-load projects, companies or sources from CSV. Every file is previewed, validated and duplicate-checked before anything is written."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <a href="/api/projects/export?format=csv" download>
                Export projects
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="/api/companies/export?format=csv" download>
                Export companies
              </a>
            </Button>
          </>
        }
      />
      <ImportWizard />
    </>
  );
}
