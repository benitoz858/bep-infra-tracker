import { handler } from "@/lib/api";
import { requireCapability } from "@/lib/permissions";
import { exportMetricsCsv, exportSourcesCsv } from "@/lib/services/export";

/**
 * Evidence export. `?kind=metrics` returns one row per claim with its citation;
 * the default returns one row per source. These are the two shapes needed to
 * audit the database's provenance outside the app.
 */
export const GET = handler(async (request: Request) => {
  await requireCapability("data:export");

  const kind = new URL(request.url).searchParams.get("kind") === "metrics" ? "metrics" : "sources";
  const csv = kind === "metrics" ? await exportMetricsCsv() : await exportSourcesCsv();
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bep-${kind}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
