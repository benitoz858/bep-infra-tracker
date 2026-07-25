import { describe, expect, it } from "vitest";

import type { Role } from "@/generated/prisma/enums";
import { type Capability, can } from "@/lib/capabilities";

/**
 * The capability matrix, asserted exhaustively. A permissions regression is
 * silent in the UI (a button simply appears) so it needs a table test, not spot
 * checks.
 */
const EXPECTED: Record<Role, Record<Capability, boolean>> = {
  ADMIN: {
    "record:create": true,
    "record:edit": true,
    "record:delete": true,
    "data:export": true,
    "data:import": true,
    "user:manage": true,
  },
  ANALYST: {
    "record:create": true,
    "record:edit": true,
    // Analysts may not delete: destroying evidence should require an admin.
    "record:delete": false,
    "data:export": true,
    "data:import": true,
    "user:manage": false,
  },
  VIEWER: {
    "record:create": false,
    "record:edit": false,
    "record:delete": false,
    // Viewers can still export — reading the data is their entire purpose.
    "data:export": true,
    "data:import": false,
    "user:manage": false,
  },
};

describe("can", () => {
  for (const [role, capabilities] of Object.entries(EXPECTED) as [
    Role,
    Record<Capability, boolean>,
  ][]) {
    describe(role, () => {
      for (const [capability, allowed] of Object.entries(capabilities) as [
        Capability,
        boolean,
      ][]) {
        it(`${allowed ? "allows" : "denies"} ${capability}`, () => {
          expect(can(role, capability)).toBe(allowed);
        });
      }
    });
  }

  it("denies everything for an absent role", () => {
    expect(can(undefined, "data:export")).toBe(false);
    expect(can(null, "record:create")).toBe(false);
  });
});
