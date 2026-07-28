import { compare } from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetDatabase, testDb } from "../helpers/db";

vi.mock("@/lib/db", async () => {
  const { testDb } = await import("../helpers/db");
  return { prisma: testDb };
});

const { registerUser, changePassword } = await import("@/lib/services/accounts");

const GOOD_PASSWORD = "correct horse battery staple";

beforeEach(async () => {
  await resetDatabase();
});

describe("registerUser", () => {
  it("creates a VIEWER and never anything more privileged", async () => {
    const created = await registerUser({
      email: "New.Person@Example.com",
      name: "New Person",
      password: GOOD_PASSWORD,
    });

    const user = await testDb.user.findUnique({ where: { id: created.id } });
    expect(user?.role).toBe("VIEWER");
    // Lowercased on the way in, so two casings cannot become two accounts.
    expect(user?.email).toBe("new.person@example.com");
  });

  it("stores a hash, never the password", async () => {
    const created = await registerUser({ email: "a@example.com", password: GOOD_PASSWORD });
    const user = await testDb.user.findUnique({ where: { id: created.id } });

    expect(user?.passwordHash).toBeTruthy();
    expect(user?.passwordHash).not.toBe(GOOD_PASSWORD);
    expect(await compare(GOOD_PASSWORD, user!.passwordHash!)).toBe(true);
  });

  it("refuses a duplicate email regardless of casing", async () => {
    await registerUser({ email: "dupe@example.com", password: GOOD_PASSWORD });

    await expect(
      registerUser({ email: "DUPE@example.com", password: GOOD_PASSWORD }),
    ).rejects.toThrow(/already exists/i);

    expect(await testDb.user.count()).toBe(1);
  });

  it("cannot be talked into a higher role by extra fields", async () => {
    const created = await registerUser({
      email: "sneaky@example.com",
      password: GOOD_PASSWORD,
      // A caller trying to escalate. The service ignores it by construction —
      // role is not read from the input at all.
      ...({ role: "ADMIN" } as Record<string, unknown>),
    });

    const user = await testDb.user.findUnique({ where: { id: created.id } });
    expect(user?.role).toBe("VIEWER");
  });
});

describe("changePassword", () => {
  it("changes it when the current password is right", async () => {
    const created = await registerUser({ email: "c@example.com", password: GOOD_PASSWORD });

    await changePassword({
      userId: created.id,
      currentPassword: GOOD_PASSWORD,
      newPassword: "a different long passphrase",
    });

    const user = await testDb.user.findUnique({ where: { id: created.id } });
    expect(await compare("a different long passphrase", user!.passwordHash!)).toBe(true);
  });

  it("refuses without the current password, so a borrowed session cannot lock the owner out", async () => {
    const created = await registerUser({ email: "d@example.com", password: GOOD_PASSWORD });

    await expect(
      changePassword({
        userId: created.id,
        currentPassword: "not the password",
        newPassword: "a different long passphrase",
      }),
    ).rejects.toThrow(/not correct/i);

    const user = await testDb.user.findUnique({ where: { id: created.id } });
    expect(await compare(GOOD_PASSWORD, user!.passwordHash!)).toBe(true);
  });

  it("refuses a no-op change", async () => {
    const created = await registerUser({ email: "e@example.com", password: GOOD_PASSWORD });

    await expect(
      changePassword({
        userId: created.id,
        currentPassword: GOOD_PASSWORD,
        newPassword: GOOD_PASSWORD,
      }),
    ).rejects.toThrow(/different/i);
  });

  it("refuses for a user with no password set", async () => {
    const user = await testDb.user.create({
      data: { email: "oauth-only@example.com", role: "VIEWER" },
    });

    await expect(
      changePassword({
        userId: user.id,
        currentPassword: "anything",
        newPassword: "a different long passphrase",
      }),
    ).rejects.toThrow(/not correct/i);
  });
});
