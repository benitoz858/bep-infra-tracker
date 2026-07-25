import { handler, ok, parseJson } from "@/lib/api";
import { requireCapability } from "@/lib/permissions";
import { deleteUser, updateUser } from "@/lib/services/users";
import { userUpdateSchema } from "@/lib/validations/user";

type Params = { params: Promise<{ id: string }> };

export const PATCH = handler(async (request: Request, { params }: Params) => {
  const actor = await requireCapability("user:manage");
  const { id } = await params;

  // The id in the path wins over anything in the body, so a caller cannot edit
  // one user while addressing another.
  const input = await parseJson(request, userUpdateSchema.omit({ id: true }));
  return ok(await updateUser({ ...input, id }, actor.id));
});

export const DELETE = handler(async (_request: Request, { params }: Params) => {
  const actor = await requireCapability("user:manage");
  const { id } = await params;

  await deleteUser(id, actor.id);
  return ok({ deleted: true });
});
