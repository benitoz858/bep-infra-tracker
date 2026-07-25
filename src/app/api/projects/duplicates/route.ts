import { z } from "zod";

import { handler, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/permissions";
import { findDuplicateProjects } from "@/lib/services/duplicates";

/** Live duplicate check for the project form, called as the analyst types. */
const schema = z.object({
  name: z.string().trim().min(1),
  country: z.string().trim().min(1),
  city: z.string().trim().nullish(),
  stateRegion: z.string().trim().nullish(),
  ownerCompanyId: z.string().nullish(),
  excludeProjectId: z.string().nullish(),
});

export const POST = handler(async (request: Request) => {
  await requireUser();
  const input = await parseJson(request, schema);

  return ok({ duplicates: await findDuplicateProjects(input) });
});
