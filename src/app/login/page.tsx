import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BrandLockup } from "@/components/brand";
import { LoginForm } from "@/components/login-form";
import { getSessionUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  const { callbackUrl } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex justify-center">
          <BrandLockup />
        </div>
        <div className="rounded-lg border border-line bg-panel p-6">
          <h1 className="mb-1 text-base font-semibold text-fg">Sign in</h1>
          {/* Reading the tracker needs no account, so anyone who lands here has
              taken a wrong turn unless they maintain it. Say which it is rather
              than calling a public site a private terminal. */}
          <p className="mb-5 text-xs leading-relaxed text-fg-dim">
            For maintainers. Reading, downloading and citing the tracker needs no
            account — to correct a figure,{" "}
            <a
              href="https://github.com/benitoz858/bep-infra-tracker/issues/new?labels=data"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan hover:underline"
            >
              open an issue
            </a>
            .
          </p>
          <LoginForm callbackUrl={callbackUrl} />
        </div>
        <p className="mt-4 text-center text-[11px] leading-relaxed text-fg-muted">
          No account?{" "}
          <Link href="/register" className="text-cyan hover:underline">
            Create one
          </Link>{" "}
          to track your submissions — or{" "}
          <Link href="/submit" className="text-cyan hover:underline">
            submit without one
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
