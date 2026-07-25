import { compare } from "bcryptjs";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetDatabase, testDb } from "../helpers/db";

// The service imports lib/db's singleton; point it at the test database.
vi.mock("@/lib/db", async () => {
  const { testDb } = await import("../helpers/db");
  return { prisma: testDb };
});

const {
  createUser,
  deleteUser,
  getRoleCounts,
  listUsers,
  updateUser,
} = await import("@/lib/services/users");

async function makeUser(email: string, role: "ADMIN" | "ANALYST" | "VIEWER") {
  return createUser({
    email,
    name: email.split("@")[0] ?? null,
    role,
    password: "a-sufficiently-long-password",
  });
}

describe("users service", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it("hashes the password and never returns the hash", async () => {
    const created = await createUser({
      email: "Analyst@BEPResearch.com",
      name: "Analyst",
      role: "ANALYST",
      password: "correct-horse-battery",
    });

    // Email is normalised to lowercase so duplicates cannot differ by case.
    expect(created.email).toBe("analyst@bepresearch.com");
    expect(created).not.toHaveProperty("passwordHash");

    const row = await testDb.user.findUniqueOrThrow({
      where: { email: "analyst@bepresearch.com" },
      select: { passwordHash: true },
    });
    expect(row.passwordHash).not.toBe("correct-horse-battery");
    await expect(compare("correct-horse-battery", row.passwordHash!)).resolves.toBe(
      true,
    );
  });

  it("rejects a duplicate email regardless of case", async () => {
    await makeUser("dup@bepresearch.com", "VIEWER");
    await expect(
      createUser({
        email: "DUP@bepresearch.com",
        name: null,
        role: "VIEWER",
        password: "another-long-password",
      }),
    ).rejects.toThrow(/already exists/i);
  });

  it("refuses to let an admin change their own role", async () => {
    const admin = await makeUser("solo-admin@bepresearch.com", "ADMIN");
    await makeUser("second-admin@bepresearch.com", "ADMIN");

    // Two admins exist, so the "last admin" rule is not what blocks this.
    await expect(
      updateUser({ id: admin.id, role: "VIEWER" }, admin.id),
    ).rejects.toThrow(/your own role/i);
  });

  it("refuses to demote the last remaining admin", async () => {
    const admin = await makeUser("only-admin@bepresearch.com", "ADMIN");
    const other = await makeUser("analyst@bepresearch.com", "ANALYST");

    await expect(
      updateUser({ id: admin.id, role: "ANALYST" }, other.id),
    ).rejects.toThrow(/last admin/i);
  });

  it("allows demoting an admin once a second admin exists", async () => {
    const first = await makeUser("admin-one@bepresearch.com", "ADMIN");
    const second = await makeUser("admin-two@bepresearch.com", "ADMIN");

    const updated = await updateUser({ id: first.id, role: "ANALYST" }, second.id);
    expect(updated.role).toBe("ANALYST");
    await expect(getRoleCounts()).resolves.toMatchObject({ ADMIN: 1, ANALYST: 1 });
  });

  it("refuses self-deletion and last-admin deletion", async () => {
    const admin = await makeUser("admin@bepresearch.com", "ADMIN");
    const viewer = await makeUser("viewer@bepresearch.com", "VIEWER");

    await expect(deleteUser(admin.id, admin.id)).rejects.toThrow(/your own account/i);
    await expect(deleteUser(admin.id, viewer.id)).rejects.toThrow(/last admin/i);

    // A non-admin is deletable.
    await deleteUser(viewer.id, admin.id);
    await expect(listUsers()).resolves.toHaveLength(1);
  });

  it("preserves the audit trail when a user is deleted", async () => {
    const admin = await makeUser("admin@bepresearch.com", "ADMIN");
    const analyst = await makeUser("analyst@bepresearch.com", "ANALYST");

    const project = await testDb.project.create({
      data: {
        slug: "audit-trail-project",
        name: "Audit Trail Project",
        country: "United States",
        projectType: "DATA_CENTER",
        status: "ANNOUNCED",
      },
    });
    await testDb.projectRevision.create({
      data: {
        projectId: project.id,
        userId: analyst.id,
        changeSummary: "Created by the analyst who is about to be deleted.",
      },
    });

    await deleteUser(analyst.id, admin.id);

    // The revision survives with a null author rather than cascading away —
    // losing history because someone left the team would be worse than
    // attributing it to "System".
    const revisions = await testDb.projectRevision.findMany({
      where: { projectId: project.id },
    });
    expect(revisions).toHaveLength(1);
    expect(revisions[0]?.userId).toBeNull();
    expect(revisions[0]?.changeSummary).toMatch(/about to be deleted/);
  });

  it("updates a password to a new working hash", async () => {
    const admin = await makeUser("admin@bepresearch.com", "ADMIN");
    const user = await makeUser("rotate@bepresearch.com", "ANALYST");

    await updateUser({ id: user.id, password: "a-brand-new-long-password" }, admin.id);

    const row = await testDb.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    await expect(compare("a-brand-new-long-password", row.passwordHash!)).resolves.toBe(
      true,
    );
    await expect(compare("a-sufficiently-long-password", row.passwordHash!)).resolves.toBe(
      false,
    );
  });
});
