import { handler, ok } from "@/lib/api";
import { requireUser } from "@/lib/permissions";
import { globalSearch } from "@/lib/services/search";

export const GET = handler(async (request: Request) => {
  await requireUser();

  const q = new URL(request.url).searchParams.get("q") ?? "";
  return ok({ results: await globalSearch(q) });
});
