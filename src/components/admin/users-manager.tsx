"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { FieldError, Label } from "@/components/ui/misc";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import type { Role } from "@/generated/prisma/enums";
import { ROLE_LABEL } from "@/lib/domain";
import { formatDate } from "@/lib/format";

export type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: Date;
  _count: { revisions: number };
};

const ROLES: Role[] = ["ADMIN", "ANALYST", "VIEWER"];

const ROLE_SUMMARY: Record<Role, string> = {
  ADMIN: "Everything, including managing users and deleting records.",
  ANALYST: "Create, edit, import and export. Cannot delete or manage users.",
  VIEWER: "Read and export only.",
};

export function UsersManager({
  users,
  currentUserId,
}: {
  users: AdminUserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("ANALYST");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [busyRow, setBusyRow] = useState<string | null>(null);

  const adminCount = users.filter((u) => u.role === "ADMIN").length;

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, role, password }),
      });
      const body = (await response.json()) as {
        error?: { message: string; details?: { issues?: { message: string }[] } };
      };
      if (!response.ok) {
        throw new Error(
          body.error?.details?.issues?.[0]?.message ??
            body.error?.message ??
            "Could not create the user.",
        );
      }
      setEmail("");
      setName("");
      setPassword("");
      setRole("ANALYST");
      startTransition(() => router.refresh());
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed.");
    } finally {
      setCreating(false);
    }
  }

  async function patchUser(id: string, patch: { role?: Role }) {
    setBusyRow(id);
    setRowError((prev) => ({ ...prev, [id]: "" }));
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = (await response.json()) as { error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Update failed.");
      startTransition(() => router.refresh());
    } catch (error) {
      setRowError((prev) => ({
        ...prev,
        [id]: error instanceof Error ? error.message : "Failed.",
      }));
    } finally {
      setBusyRow(null);
    }
  }

  async function removeUser(id: string, label: string) {
    if (
      !window.confirm(
        `Delete ${label}? Their edit history is preserved but will show as "System". This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusyRow(id);
    setRowError((prev) => ({ ...prev, [id]: "" }));
    try {
      const response = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const body = (await response.json()) as { error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Delete failed.");
      startTransition(() => router.refresh());
    } catch (error) {
      setRowError((prev) => ({
        ...prev,
        [id]: error instanceof Error ? error.message : "Failed.",
      }));
    } finally {
      setBusyRow(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel className="lg:col-span-2">
        <PanelHeader>
          <PanelTitle>Users</PanelTitle>
          <span className="num text-[11px] text-fg-muted">{users.length}</span>
        </PanelHeader>
        <PanelBody className="p-0">
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>User</Th>
                  <Th>Role</Th>
                  <Th className="text-right">Edits</Th>
                  <Th>Created</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isSelf = user.id === currentUserId;
                  const isLastAdmin = user.role === "ADMIN" && adminCount <= 1;
                  // Mirrors the service guards so the UI explains the block
                  // rather than surfacing a 409 after the fact.
                  const locked = isSelf || isLastAdmin;

                  return (
                    <Tr key={user.id}>
                      <Td>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-fg">
                            {user.name ?? user.email}
                          </span>
                          {isSelf ? <Badge tone="planned">You</Badge> : null}
                        </div>
                        <p className="num text-[11px] text-fg-muted">{user.email}</p>
                        {rowError[user.id] ? (
                          <p role="alert" className="mt-1 text-[11px] text-red">
                            {rowError[user.id]}
                          </p>
                        ) : null}
                      </Td>
                      <Td>
                        <Select
                          aria-label={`Role for ${user.email}`}
                          value={user.role}
                          disabled={locked || busyRow === user.id}
                          onChange={(e) =>
                            void patchUser(user.id, { role: e.target.value as Role })
                          }
                          className="w-auto min-w-[120px]"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </option>
                          ))}
                        </Select>
                        {locked ? (
                          <p className="mt-1 text-[10px] text-fg-muted">
                            {isSelf ? "Cannot change your own role" : "Last admin"}
                          </p>
                        ) : null}
                      </Td>
                      <Td className="num text-right text-fg-dim">
                        {user._count.revisions}
                      </Td>
                      <Td className="num whitespace-nowrap text-fg-dim">
                        {formatDate(user.createdAt)}
                      </Td>
                      <Td>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={locked || busyRow === user.id}
                          onClick={() =>
                            void removeUser(user.id, user.name ?? user.email)
                          }
                          aria-label={`Delete ${user.email}`}
                        >
                          <Trash2 />
                        </Button>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Add a user</PanelTitle>
        </PanelHeader>
        <PanelBody>
          <form onSubmit={createUser} className="space-y-3">
            <div>
              <Label htmlFor="new-email" required>
                Email
              </Label>
              <Input
                id="new-email"
                type="email"
                required
                className="mt-1.5"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="new-name">Name</Label>
              <Input
                id="new-name"
                className="mt-1.5"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="new-role" required>
                Role
              </Label>
              <Select
                id="new-role"
                className="mt-1.5"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">
                {ROLE_SUMMARY[role]}
              </p>
            </div>
            <div>
              <Label htmlFor="new-password" required hint="At least 12 characters.">
                Initial password
              </Label>
              <Input
                id="new-password"
                type="password"
                required
                minLength={12}
                className="mt-1.5"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <FieldError message={createError ?? undefined} />

            <Button type="submit" variant="primary" disabled={creating} className="w-full">
              <Plus /> {creating ? "Creating…" : "Create user"}
            </Button>

            <p className="text-[11px] leading-relaxed text-fg-muted">
              There is no invite email in this MVP — set a password here and pass
              it to the person over a channel you trust. They can change it once
              a self-service password change exists.
            </p>
          </form>
        </PanelBody>
      </Panel>
    </div>
  );
}
