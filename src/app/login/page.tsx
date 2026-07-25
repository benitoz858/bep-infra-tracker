import type { Metadata } from "next";
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
          <p className="mb-5 text-xs leading-relaxed text-fg-dim">
            Private research terminal. Access is restricted to authorised BEP Research
            analysts.
          </p>
          <LoginForm callbackUrl={callbackUrl} />
        </div>
        <p className="mt-4 text-center text-[11px] text-fg-muted">
          Global AI compute, power and supply-chain intelligence
        </p>
      </div>
    </main>
  );
}
