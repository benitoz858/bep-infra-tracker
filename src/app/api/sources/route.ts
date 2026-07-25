import { handler, ok, parseJson } from "@/lib/api";
import { requireCapability, requireUser } from "@/lib/permissions";
import { listRecentSources, createSourceWithClaims } from "@/lib/services/sources";
import { sourceInboxSchema } from "@/lib/validations/source";

export const GET = handler(async () => {
  await requireUser();
  return ok(await listRecentSources(100));
});

export const POST = handler(async (request: Request) => {
  await requireCapability("record:create");

  const input = await parseJson(request, sourceInboxSchema);
  const result = await createSourceWithClaims(input);

  return ok(result, { status: 201 });
});
