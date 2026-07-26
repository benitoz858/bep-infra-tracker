import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { BrandLockup } from "@/components/brand";
import { CommandPalette } from "@/components/command-palette";
import { UserMenu } from "@/components/user-menu";
import { capabilitiesFor } from "@/lib/capabilities";
import { getSessionUser } from "@/lib/permissions";

/**
 * Shell for every page. The tracker is public: reading needs no account, so
 * `user` may be null and children must handle that. Writes are gated in two
 * independent places — the page redirects, and the API route re-checks the
 * capability — so a missing session simply means no capabilities at all.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Public by design: anyone can read the tracker. Writes are gated per page and
  // per API route, so an anonymous visitor simply holds no capabilities.
  const user = await getSessionUser();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Keyboard users land here first; the nav is long and sits above every
          page, so skipping it matters more than usual in this app. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:border focus:border-cyan focus:bg-panel focus:px-3 focus:py-2 focus:text-[13px] focus:text-cyan"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-2.5">
          <Link href="/dashboard" className="shrink-0">
            <BrandLockup />
          </Link>
          <div className="order-3 w-full lg:order-2 lg:w-auto lg:flex-1">
            <AppNav capabilities={capabilitiesFor(user?.role)} />
          </div>
          <div className="order-2 ml-auto flex items-center gap-3 lg:order-3">
            <CommandPalette />
            {user ? (
              <UserMenu email={user.email} name={user.name} role={user.role} />
            ) : (
              <Link
                href="/login"
                className="rounded-md border border-line-2 px-2.5 py-1.5 text-[12px] text-fg-dim hover:border-cyan hover:text-cyan"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6">
        {children}
      </main>

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
