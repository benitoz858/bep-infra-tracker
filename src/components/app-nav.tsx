"use client";

import {
  BookOpen,
  Building2,
  Database,
  Globe2,
  Inbox,
  LayoutDashboard,
  PieChart,
  Send,
  ShieldCheck,
  Upload,
  Users,
  Bot,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

import type { Capability } from "@/lib/capabilities";
import { cn } from "@/lib/utils";

const NAV = [
  // Primary: the investor workflows. Deliberately short — everything a reader
  // needs to answer "what is real, who benefits, what is blocked".
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: Database },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/map", label: "Map", icon: Globe2 },
  { href: "/analytics", label: "Analytics", icon: PieChart },
  { href: "/siting", label: "Siting risk", icon: ShieldAlert },
  { href: "/methodology", label: "Methodology", icon: BookOpen },
  // Research process: how the data is made. Public on purpose — the evidence
  // trail is the product — but secondary to the analysis above, and separated
  // so the site does not read like an internal CMS.
  { href: "/sources", label: "Evidence library", icon: Inbox, group: "process" },
  { href: "/verification", label: "Verification", icon: ShieldCheck, group: "process" },
  { href: "/submit", label: "Submit a source", icon: Send, group: "process" },
  { href: "/ingest", label: "Agent inbox", icon: Bot, requires: "record:create", group: "process" },
  { href: "/import", label: "Import", icon: Upload, requires: "data:import", group: "process" },
  { href: "/admin/users", label: "Users", icon: Users, requires: "user:manage", group: "process" },
] as const satisfies readonly {
  href: string;
  label: string;
  icon: typeof Users;
  requires?: Capability;
  group?: "process";
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
      {visible.map((item, i) => {
        const { href, label, icon: Icon } = item;
        // Section-level match so /projects/foo keeps "Projects" active.
        const active = pathname === href || pathname.startsWith(`${href}/`);
        // First research-process item gets a rule before it, so the analysis
        // pages and the how-it-is-made pages read as two groups.
        const startsProcess =
          "group" in item &&
          item.group === "process" &&
          !("group" in visible[i - 1] && (visible[i - 1] as { group?: string }).group === "process");
        return (
          <Fragment key={href}>
            {startsProcess ? (
              <span
                aria-hidden="true"
                className="mx-1.5 h-4 w-px shrink-0 self-center bg-line-2"
              />
            ) : null}
            <Link
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
          </Fragment>
        );
      })}
    </nav>
  );
}
