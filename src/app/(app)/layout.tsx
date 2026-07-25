import Link from "next/link";
import { redirect } from "next/navigation";

import { AppNav } from "@/components/app-nav";
import { BrandLockup } from "@/components/brand";
import { CommandPalette } from "@/components/command-palette";
import { UserMenu } from "@/components/user-menu";
import { getSessionUser } from "@/lib/permissions";

/**
 * Shell for every authenticated page. Middleware already blocks anonymous
 * requests; this second check is what makes `user` non-null for the children
 * and covers the case where middleware is bypassed (e.g. a direct RSC call).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-2.5">
          <Link href="/dashboard" className="shrink-0">
            <BrandLockup />
          </Link>
          <div className="order-3 w-full lg:order-2 lg:w-auto lg:flex-1">
            <AppNav />
          </div>
          <div className="order-2 ml-auto flex items-center gap-3 lg:order-3">
            <CommandPalette />
            <UserMenu email={user.email} name={user.name} role={user.role} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6">{children}</main>

      <footer className="border-t border-line px-4 py-4">
        <p className="mx-auto max-w-[1600px] text-[11px] leading-relaxed text-fg-muted">
          BEP AI Infrastructure Tracker — internal research tool. Figures combine
          confirmed disclosures with analyst estimates; check the confidence level and
          sources on a project before citing any number.
        </p>
      </footer>
    </div>
  );
}
