import { handler, ok } from "@/lib/api";
import { globalSearch } from "@/lib/services/search";

export const GET = handler(async (request: Request) => {

  const q = new URL(request.url).searchParams.get("q") ?? "";
  return ok({ results: await globalSearch(q) });
});
