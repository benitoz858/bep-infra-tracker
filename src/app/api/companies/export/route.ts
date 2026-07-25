import { handler } from "@/lib/api";
import { requireCapability } from "@/lib/permissions";
import { exportCompaniesCsv } from "@/lib/services/export";

export const GET = handler(async () => {
  await requireCapability("data:export");

  const csv = await exportCompaniesCsv();
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bep-companies-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
