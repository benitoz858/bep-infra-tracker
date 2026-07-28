import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/components/change-password-form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { formatDate } from "@/lib/format";
import { getSessionUser } from "@/lib/permissions";
import { listMySubmissions } from "@/lib/services/submissions";

export const metadata: Metadata = { title: "Your account" };

const STATUS_TONE = {
  PENDING: "construction",
  ACCEPTED: "operational",
  REJECTED: "risk",
  DUPLICATE: "inert",
} as const;

export default async function AccountPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?callbackUrl=/account");

  const submissions = await listMySubmissions(user.id);

  return (
    <>
      <PageHeader
        title="Your account"
        subtitle="What you have submitted, and what a reviewer decided."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Panel>
          <PanelHeader>
            <PanelTitle>Your submissions</PanelTitle>
          </PanelHeader>
          <PanelBody>
            {submissions.length === 0 ? (
              <EmptyState
                title="Nothing submitted yet"
                description="Found a figure here that is wrong, or a source the tracker is missing? That is the most useful thing you can send."
                action={
                  <Link
                    href="/submit"
                    className="text-[12px] text-cyan hover:underline"
                  >
                    Submit a source
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {submissions.map((s) => (
                  <li key={s.id} className="flex flex-wrap gap-x-3 gap-y-1 py-2.5">
                    <div className="min-w-0 flex-1">
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] text-fg hover:text-cyan"
                      >
                        {s.title}
                      </a>
                      <p className="mt-0.5 text-[11px] text-fg-muted">
                        Submitted {formatDate(s.createdAt)}
                        {s.suggestedProject ? (
                          <>
                            {" · "}
                            <Link
                              href={`/projects/${s.suggestedProject.slug}`}
                              className="text-cyan hover:underline"
                            >
                              {s.suggestedProject.name}
                            </Link>
                          </>
                        ) : null}
                      </p>
                      {/* The reviewer's reasoning matters most when the answer
                          was no — that is the case where silence reads as being
                          ignored. */}
                      {s.reviewNote ? (
                        <p className="mt-1 text-[11px] leading-relaxed text-fg-dim">
                          {s.reviewNote}
                        </p>
                      ) : null}
                    </div>
                    <Badge tone={STATUS_TONE[s.status]}>{s.status.toLowerCase()}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </PanelBody>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader>
              <PanelTitle>Signed in as</PanelTitle>
            </PanelHeader>
            <PanelBody className="space-y-1 text-[12px]">
              <p className="text-fg">{user.name ?? user.email}</p>
              {user.name ? <p className="text-fg-muted">{user.email}</p> : null}
              <p className="pt-1">
                <Badge tone="neutral">{user.role.toLowerCase()}</Badge>
              </p>
              {user.role === "VIEWER" ? (
                <p className="pt-2 text-[11px] leading-relaxed text-fg-muted">
                  Read and export access. Submissions go to the review queue like
                  everyone else&apos;s — editing published figures is granted by hand
                  to maintainers.
                </p>
              ) : null}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Change password</PanelTitle>
            </PanelHeader>
            <PanelBody>
              <ChangePasswordForm />
              <p className="mt-4 text-[11px] leading-relaxed text-fg-muted">
                There is no emailed password reset yet — the project sends no email at
                all. If you are locked out, open an issue on GitHub and an admin can
                reset it.
              </p>
            </PanelBody>
          </Panel>
        </div>
      </div>
    </>
  );
}
