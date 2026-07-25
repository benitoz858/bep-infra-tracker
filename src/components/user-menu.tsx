"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Role } from "@/generated/prisma/enums";
import { ROLE_LABEL } from "@/lib/domain";

export function UserMenu({
  email,
  name,
  role,
}: {
  email: string;
  name?: string | null;
  role: Role;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="hidden text-right leading-tight sm:block">
        <p className="text-[12px] text-fg">{name ?? email}</p>
        <p className="font-mono text-[9px] uppercase tracking-wider text-fg-muted">
          {email}
        </p>
      </div>
      <Badge tone={role === "ADMIN" ? "planned" : "neutral"}>{ROLE_LABEL[role]}</Badge>
      <Button
        variant="ghost"
        size="icon"
        title="Sign out"
        aria-label="Sign out"
        onClick={() => void signOut({ redirectTo: "/login" })}
      >
        <LogOut />
      </Button>
    </div>
  );
}
