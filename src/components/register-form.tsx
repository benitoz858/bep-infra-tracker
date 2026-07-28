"use client";

import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, Label } from "@/components/ui/misc";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        name: String(form.get("name") ?? "") || undefined,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(
        body?.error?.details?.issues?.[0]?.message ??
          body?.error?.message ??
          "Could not create the account.",
      );
      setPending(false);
      return;
    }

    // Sign in straight away. Making someone type the password they just chose
    // into a second form is friction with no security benefit.
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      setError("Account created, but sign-in failed. Try signing in.");
      setPending(false);
      return;
    }

    router.refresh();
    router.push("/submit");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Name or handle</Label>
        <Input id="name" name="name" autoComplete="name" maxLength={120} />
      </div>
      <div>
        <Label htmlFor="email" required>
          Email
        </Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div>
        <Label htmlFor="password" required>
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
        />
        <p className="mt-1 text-[11px] text-fg-muted">
          At least 12 characters. Length beats punctuation — a passphrase is fine.
        </p>
      </div>

      <FieldError message={error ?? undefined} />

      <Button type="submit" variant="primary" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Create account"}
      </Button>
    </form>
  );
}
