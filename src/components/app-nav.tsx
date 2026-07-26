"use client";

import {
  Building2,
  Database,
  Globe2,
  Inbox,
  LayoutDashboard,
  PieChart,
  ShieldCheck,
  Upload,
  Users,
  Bot,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Capability } from "@/lib/capabilities";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: Database },
  { href: "/map", label: "Map", icon: Globe2 },
  { href: "/analytics", label: "Analytics", icon: PieChart },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/sources", label: "Source inbox", icon: Inbox },
  { href: "/verification", label: "Verification", icon: ShieldCheck },
  { href: "/ingest", label: "Agent inbox", icon: Bot, requires: "record:create" },
  { href: "/import", label: "Import", icon: Upload, requires: "data:import" },
  { href: "/admin/users", label: "Users", icon: Users, requires: "user:manage" },
] as const satisfies readonly {
  href: string;
  label: string;
  icon: typeof Users;
  requires?: Capability;
}[];

export function AppNav({ capabilities }: { capabilities: Capability[] }) {
  const pathname = usePathname();

  // Hiding a link is presentation only — every page and API route re-checks the
  // capability server-side, so a hidden link is not the access control.
  const visible = NAV.filter(
    (item) => !("requires" in item) || capabilities.includes(item.requires),
  );

  return (
    <nav aria-label="Main" className="flex items-center gap-0.5 overflow-x-auto">
      {visible.map(({ href, label, icon: Icon }) => {
        // Section-level match so /projects/foo keeps "Projects" active.
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
              active
                ? "bg-cyan/10 text-cyan"
                : "text-fg-dim hover:bg-panel-2 hover:text-fg",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
