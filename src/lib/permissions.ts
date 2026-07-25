import type { Role } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { type Capability, can } from "@/lib/capabilities";

// Re-exported so callers have one import site for permission checks.
export { can, type Capability };

export type SessionUser = {
  id: string;
  email: string;
  role: Role;
  name?: string | null;
};

/** Thrown by the require* helpers; mapped to 401/403 by the API error handler. */
export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("Authentication required", 401);
  return user;
}

export async function requireCapability(capability: Capability): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, capability)) {
    throw new AuthError(`Your role (${user.role}) cannot ${capability}`, 403);
  }
  return user;
}
