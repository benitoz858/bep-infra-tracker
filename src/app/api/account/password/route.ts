import { handler, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/permissions";
import { changePassword } from "@/lib/services/accounts";
import { changePasswordSchema } from "@/lib/validations/user";

/**
 * Changes the *caller's own* password. The user id comes from the session and
 * is never accepted from the request body — otherwise any signed-in account
 * could reset any other, which is the whole reason this is separate from the
 * admin route at /api/users/[id].
 */
export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  const input = await parseJson(request, changePasswordSchema);

  await changePassword({
    userId: user.id,
    currentPassword: input.currentPassword,
    newPassword: input.newPassword,
  });

  return ok({ changed: true });
});
