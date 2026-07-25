import { hash } from "bcryptjs";

import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { ConflictError, NotFoundError, ServiceError } from "@/lib/services/errors";
import type { UserCreateInput, UserUpdateInput } from "@/lib/validations/user";

/**
 * User administration.
 *
 * Two invariants protect the instance from being locked out, and both are
 * enforced here rather than in the UI so an API caller cannot bypass them:
 *
 *   1. An admin cannot demote or delete their own account. Otherwise a single
 *      admin can strip their own rights and nobody can restore them.
 *   2. The last remaining admin cannot be demoted or deleted. Otherwise the
 *      instance ends up with no one who can manage users.
 */

/** bcrypt work factor. 12 is ~250ms on current hardware — costly to crack, fine to log in with. */
const BCRYPT_ROUNDS = 12;

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  // Lets the UI show "no password set" for a future OAuth-only account without
  // ever sending the hash to the client.
  passwordHash: false,
  _count: { select: { revisions: true } },
} as const;

export async function listUsers() {
  return prisma.user.findMany({
    select: USER_SELECT,
    orderBy: [{ role: "asc" }, { email: "asc" }],
  });
}

export type UserRow = Awaited<ReturnType<typeof listUsers>>[number];

async function countAdmins(): Promise<number> {
  return prisma.user.count({ where: { role: "ADMIN" } });
}

/**
 * Email is normalised here as well as in the Zod schema, deliberately.
 *
 * The DB unique index is on the raw string, so `Ben@x.com` and `ben@x.com` are
 * two different rows as far as Postgres is concerned. Relying on the validation
 * layer alone would let any non-HTTP caller — a seed script, the CSV importer, a
 * future CLI — create a duplicate account that then breaks sign-in, because
 * `authorize()` looks the address up lowercased.
 */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function createUser(input: UserCreateInput) {
  const email = normalizeEmail(input.email);

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError(`A user with the email ${email} already exists.`);
  }

  return prisma.user.create({
    data: {
      email,
      name: input.name,
      role: input.role,
      passwordHash: await hash(input.password, BCRYPT_ROUNDS),
    },
    select: USER_SELECT,
  });
}

export async function updateUser(input: UserUpdateInput, actingUserId: string) {
  const target = await prisma.user.findUnique({
    where: { id: input.id },
    select: { id: true, role: true },
  });
  if (!target) throw new NotFoundError("User");

  const isSelf = target.id === actingUserId;
  const isDemotion = input.role !== undefined && input.role !== "ADMIN" && target.role === "ADMIN";

  if (isDemotion) {
    if (isSelf) {
      throw new ServiceError(
        "self_demotion",
        "You cannot change your own role. Ask another admin to do it.",
        409,
      );
    }
    if ((await countAdmins()) <= 1) {
      throw new ConflictError(
        "This is the last admin. Promote another user to admin before changing this one.",
      );
    }
  }

  return prisma.user.update({
    where: { id: input.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.password !== undefined
        ? { passwordHash: await hash(input.password, BCRYPT_ROUNDS) }
        : {}),
    },
    select: USER_SELECT,
  });
}

export async function deleteUser(id: string, actingUserId: string) {
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, email: true },
  });
  if (!target) throw new NotFoundError("User");

  if (target.id === actingUserId) {
    throw new ServiceError(
      "self_deletion",
      "You cannot delete your own account.",
      409,
    );
  }

  if (target.role === "ADMIN" && (await countAdmins()) <= 1) {
    throw new ConflictError(
      "This is the last admin. Promote another user to admin before deleting this one.",
    );
  }

  // ProjectRevision.userId is onDelete: SetNull, so the audit trail survives as
  // "System" rather than disappearing with the account.
  await prisma.user.delete({ where: { id } });
}

/** Role counts for the admin page header. */
export async function getRoleCounts(): Promise<Record<Role, number>> {
  const rows = await prisma.user.groupBy({ by: ["role"], _count: { _all: true } });
  const counts = { ADMIN: 0, ANALYST: 0, VIEWER: 0 } as Record<Role, number>;
  for (const row of rows) counts[row.role] = row._count._all;
  return counts;
}
