import { handler, ok, parseJson } from "@/lib/api";
import { registerUser } from "@/lib/services/accounts";
import { registerSchema } from "@/lib/validations/user";

/**
 * Open registration. Unguarded on purpose — an account here is not a privilege,
 * it is a way to be told what happened to your submissions. The role is fixed
 * at VIEWER inside the service, so this endpoint cannot be used to obtain write
 * access however it is called.
 */
export const POST = handler(async (request: Request) => {
  const input = await parseJson(request, registerSchema);
  const user = await registerUser(input);
  return ok(user, { status: 201 });
});
