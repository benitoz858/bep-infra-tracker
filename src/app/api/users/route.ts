import { handler, ok, parseJson } from "@/lib/api";
import { requireCapability } from "@/lib/permissions";
import { createUser, listUsers } from "@/lib/services/users";
import { userCreateSchema } from "@/lib/validations/user";

export const GET = handler(async () => {
  await requireCapability("user:manage");
  return ok(await listUsers());
});

export const POST = handler(async (request: Request) => {
  await requireCapability("user:manage");

  const input = await parseJson(request, userCreateSchema);
  return ok(await createUser(input), { status: 201 });
});
