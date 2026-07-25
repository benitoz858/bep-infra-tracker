import type { Role } from "@/generated/prisma/enums";

/**
 * The capability matrix — pure data and one pure function, with no Auth.js or
 * Next.js imports.
 *
 * Kept separate from lib/permissions.ts (which reads the session and therefore
 * pulls in next-auth) so `can()` can be imported by unit tests and by client
 * components without dragging the auth runtime along.
 *
 * Routes and services ask "can this role do X", never "is this role ADMIN", so
 * adding a role later is a change to this table rather than a hunt through call
 * sites.
 */
export type Capability =
  | "record:create"
  | "record:edit"
  | "record:delete"
  | "data:export"
  | "data:import"
  | "user:manage";

const CAPABILITIES: Record<Role, Capability[]> = {
  ADMIN: [
    "record:create",
    "record:edit",
    "record:delete",
    "data:export",
    "data:import",
    "user:manage",
  ],
  // Analysts deliberately cannot delete: destroying a record and its evidence
  // trail should require an admin.
  ANALYST: ["record:create", "record:edit", "data:export", "data:import"],
  // Viewers can still export — reading the data is the point of the role.
  VIEWER: ["data:export"],
};

export function can(role: Role | undefined | null, capability: Capability): boolean {
  if (!role) return false;
  return CAPABILITIES[role].includes(capability);
}
