import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { UsersManager } from "@/components/admin/users-manager";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { ROLE_LABEL } from "@/lib/domain";
import { formatCount } from "@/lib/format";
import { can, getSessionUser } from "@/lib/permissions";
import { getRoleCounts, listUsers } from "@/lib/services/users";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // Route-level gate. The API re-checks independently, so a non-admin who
  // guesses the endpoint is still refused.
  if (!can(user.role, "user:manage")) redirect("/dashboard");

  const [users, counts] = await Promise.all([listUsers(), getRoleCounts()]);

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Who can see and change the tracker. Roles are capability-based: an analyst can create and edit but not delete, and only an admin can manage users."
      />

      <section className="mb-5 grid grid-cols-3 gap-3">
        {(["ADMIN", "ANALYST", "VIEWER"] as const).map((role) => (
          <StatTile
            key={role}
            label={`${ROLE_LABEL[role]}s`}
            value={formatCount(counts[role])}
            accent={role === "ADMIN" ? "cyan" : "plain"}
          />
        ))}
      </section>

      <UsersManager users={users} currentUserId={user.id} />
    </>
  );
}
