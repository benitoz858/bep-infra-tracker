import { handler, fail } from "@/lib/api";
import { CSV_TEMPLATES } from "@/lib/services/export";

/** Downloadable blank CSV templates, one per importable entity. */
export const GET = handler(async (request: Request) => {

  const entity = new URL(request.url).searchParams.get("entity") ?? "projects";
  if (!(entity in CSV_TEMPLATES)) {
    return fail("not_found", `No template for "${entity}".`, 404);
  }

  const csv = CSV_TEMPLATES[entity as keyof typeof CSV_TEMPLATES];

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bep-${entity}-template.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
