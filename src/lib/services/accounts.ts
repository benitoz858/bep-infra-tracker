import { compare, hash } from "bcryptjs";

import { prisma } from "@/lib/db";
import { ConflictError, DataQualityError, NotFoundError } from "@/lib/services/errors";

/**
 * Self-service accounts.
 *
 * Registration grants VIEWER and nothing more: read the tracker, export it, and
 * have your submissions attributed so you can follow what happened to them. It
 * confers no ability to change a published figure — that needs ANALYST, which
 * only an admin can grant, to someone they would vouch for.
 *
 * The reason for that split is the reason the whole project is worth citing.
 * Signing up is not a trust decision, so it must not hand out trust; a
 * submission from a brand-new account and one from a stranger with no account
 * travel exactly the same reviewed path.
 */

/** Matches the cost used by the seeding scripts, so hashes are interchangeable. */
const BCRYPT_ROUNDS = 10;

export async function registerUser(input: {
  email: string;
  name?: string | null;
  password: string;
}): Promise<{ id: string; email: string }> {
  const email = input.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    // Deliberately explicit rather than a vague failure. Email enumeration is a
    // real concern on sites where an account implies something private; here an
    // account implies nothing but the ability to read a public database, and a
    // person who cannot tell whether they already registered will simply leave.
    throw new ConflictError(
      "An account with that email already exists. Sign in instead.",
    );
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: input.name?.trim() || null,
      passwordHash: await hash(input.password, BCRYPT_ROUNDS),
      role: "VIEWER",
    },
    select: { id: true, email: true },
  });

  return user;
}

export async function changePassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, passwordHash: true },
  });
  if (!user) throw new NotFoundError("User");

  // Requiring the current password is what stops a borrowed session from
  // becoming a permanent takeover.
  if (!user.passwordHash || !(await compare(input.currentPassword, user.passwordHash))) {
    throw new DataQualityError("Your current password is not correct.");
  }

  if (input.currentPassword === input.newPassword) {
    throw new DataQualityError("The new password must be different from the old one.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hash(input.newPassword, BCRYPT_ROUNDS) },
  });
}
