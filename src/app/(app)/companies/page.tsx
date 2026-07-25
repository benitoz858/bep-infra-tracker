import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { COMPANY_TYPE_LABEL } from "@/lib/domain";
import { formatCount } from "@/lib/format";
import { requireUser } from "@/lib/permissions";
import { listCompanies } from "@/lib/services/companies";
import { companyQuerySchema } from "@/lib/validations/company";
import { CompaniesFilters } from "@/components/companies/companies-filters";

export const metadata: Metadata = { title: "Companies" };

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const raw = await searchParams;

  const query = companyQuerySchema.parse(
    Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v.join(",") : v]),
    ),
  );

  const { rows, total, page, pageCount } = await listCompanies(query);

  return (
    <>
      <PageHeader
        title="Companies"
        subtitle="Owners, operators, neoclouds and the vendor supply chain. Ticker-carrying names link project exposure to public equities."
        actions={
          <Button asChild variant="outline" size="sm">
            {/* A file download, not a route change — next/link would client-navigate
                and never trigger the browser's download handling. */}
            <a href="/api/companies/export?format=csv" download>
              Export CSV
            </a>
          </Button>
        }
      />

      <div className="mb-4 rounded-lg border border-line bg-panel p-3">
        <CompaniesFilters />
      </div>

      <Panel>
        {rows.length === 0 ? (
          <EmptyState
            title="No companies match these filters"
            description="Clear the search term or pick a different company type."
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Company</Th>
                  <Th>Type</Th>
                  <Th>Ticker</Th>
                  <Th>HQ</Th>
                  <Th className="text-right">Owned projects</Th>
                  <Th className="text-right">Other links</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <Tr key={c.id}>
                    <Td>
                      <Link
                        href={`/companies/${c.slug}`}
                        className="font-medium text-fg hover:text-cyan"
                      >
                        {c.name}
                      </Link>
                    </Td>
                    <Td>
                      <Badge tone="neutral">{COMPANY_TYPE_LABEL[c.companyType]}</Badge>
                    </Td>
                    <Td className="num text-cyan">{c.ticker ?? "—"}</Td>
                    <Td className="text-fg-dim">{c.headquartersCountry ?? "—"}</Td>
                    <Td className="num text-right text-fg-dim">
                      {formatCount(c._count.ownedProjects)}
                    </Td>
                    <Td className="num text-right text-fg-dim">
                      {formatCount(c._count.projectLinks)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Panel>

      <p className="mt-3 num text-[12px] text-fg-dim">
        {formatCount(total)} compan{total === 1 ? "y" : "ies"}
        {pageCount > 1 ? ` · page ${page} of ${pageCount}` : ""}
      </p>
    </>
  );
}
