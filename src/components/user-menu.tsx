"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
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
      <Link
        href="/account"
        className="hidden text-right leading-tight hover:text-cyan sm:block"
        title="Your account and submissions"
      >
        <p className="text-[12px] text-fg">{name ?? email}</p>
        <p className="font-mono text-[9px] uppercase tracking-wider text-fg-muted">
          {email}
        </p>
      </Link>
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
