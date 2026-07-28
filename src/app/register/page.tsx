import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BrandLockup } from "@/components/brand";
import { RegisterForm } from "@/components/register-form";
import { getSessionUser } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Create an account",
  description:
    "Optional. An account attributes your submissions so you can follow what happened to them — contributing does not require one.",
};

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect("/account");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex justify-center">
          <BrandLockup />
        </div>

        <div className="rounded-lg border border-line bg-panel p-6">
          <h1 className="mb-1 text-base font-semibold text-fg">Create an account</h1>
          <p className="mb-5 text-xs leading-relaxed text-fg-dim">
            Entirely optional. An account attributes your submissions so you can see
            what a reviewer decided — you can{" "}
            <Link href="/submit" className="text-cyan hover:underline">
              submit a source without one
            </Link>
            .
          </p>

          <RegisterForm />
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-fg-muted">
          An account grants read and export access only. Editing published figures
          requires a maintainer role, which is granted by hand.
          <br />
          Already have one?{" "}
          <Link href="/login" className="text-cyan hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
