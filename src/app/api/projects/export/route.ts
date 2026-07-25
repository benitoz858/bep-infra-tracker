import { handler } from "@/lib/api";
import { requireCapability } from "@/lib/permissions";
import { exportProjectsCsv, exportProjectsJson } from "@/lib/services/export";
import { projectQuerySchema } from "@/lib/validations/project";

/**
 * Exports the rows matching the current table query, so the file always matches
 * what the analyst is looking at. All three roles may export (see permissions).
 */
export const GET = handler(async (request: Request) => {
  await requireCapability("data:export");

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "json" ? "json" : "csv";

  const params = Object.fromEntries(url.searchParams.entries());
  // Exports ignore pagination: the file is the whole filtered result set.
  const query = projectQuerySchema.parse({ ...params, page: "1", perPage: "200" });
  const unpaginated = { ...query, page: 1, perPage: 20_000 };

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "json") {
    const payload = await exportProjectsJson(unpaginated);
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="bep-projects-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const csv = await exportProjectsCsv(unpaginated);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bep-projects-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
