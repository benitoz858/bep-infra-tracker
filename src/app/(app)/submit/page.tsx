import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { SubmitForm } from "@/components/submit-form";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Submit a source",
  description:
    "Propose a source and the figures it supports. No account needed — every submission is reviewed by a human before it reaches the published data.",
};

export default async function SubmitPage() {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, country: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader
        title="Submit a source"
        subtitle="No account needed. Your submission goes into the same review queue the automated watchers feed, and a person decides what — if anything — it changes."
      />

      <div className="mb-5 rounded-lg border border-line bg-panel-2/40 p-4">
        <h2 className="mb-2 text-[13px] font-semibold text-fg">
          What happens to this
        </h2>
        <ol className="ml-4 list-decimal space-y-1 text-[12px] leading-relaxed text-fg-dim">
          <li>It lands in the review queue as a proposal. Nothing is published yet.</li>
          <li>
            A maintainer opens your source and checks it against what the tracker
            already holds.
          </li>
          <li>
            If it stands up, the figure is recorded with a confidence level and your
            source is cited on the project page. If it does not, the submission is
            rejected with a reason.
          </li>
        </ol>
        <p className="mt-3 text-[12px] leading-relaxed text-fg-muted">
          <strong className="text-fg-dim">A correction is worth more than an addition.</strong>{" "}
          Most figures here are announced rather than confirmed, so some of them are
          wrong. If you can show that one is, that is the most valuable thing you can
          send. Prefer git?{" "}
          <a
            href="https://github.com/benitoz858/bep-infra-tracker/issues/new?labels=data"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan hover:underline"
          >
            Open an issue instead
          </a>
          , or read the{" "}
          <Link href="/projects" className="text-cyan hover:underline">
            existing data
          </Link>{" "}
          first.
        </p>
      </div>

      <SubmitForm projects={projects} />
    </>
  );
}
