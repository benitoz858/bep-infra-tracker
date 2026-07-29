import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import {
  BUILDING_STATUSES,
  CONFIDENCE_WEIGHTS,
  ENERGIZED_STATUSES,
  NON_PIPELINE_STATUSES,
} from "@/lib/capacity";
import { CREDIBILITY_META, POWER_READINESS_META, STALE_AFTER_DAYS } from "@/lib/credibility";
import { PROJECT_STATUS_META } from "@/lib/domain";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How the tracker defines announced, credible, under-construction and confirmed capacity; how credibility is assessed; and what the figures do not tell you.",
};

/**
 * The methodology page reads its constants from the same modules the
 * calculations use. If a weight changes in lib/capacity, this page changes with
 * it — documentation that can go stale is worse than none, because it is
 * quoted with the same confidence as the code.
 */
export default function MethodologyPage() {
  return (
    <>
      <PageHeader
        title="Methodology"
        subtitle="Every published figure is defined here. Where the tracker models rather than measures, it says so and shows the assumption."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="lg:col-span-2">
          <PanelHeader>
            <PanelTitle>The central distinction</PanelTitle>
          </PanelHeader>
          <PanelBody className="space-y-3 text-[13px] leading-relaxed text-fg-dim">
            <p>
              A two-gigawatt press release and two gigawatts under construction are not the
              same fact, and almost every published figure on AI infrastructure adds them
              together. This tracker keeps them apart in the schema, in the calculations and
              on every page.
            </p>
            <p>
              Two fields carry capacity on each project:{" "}
              <code className="font-mono text-[12px] text-fg">estimatedPowerMw</code> for an
              announced or reported target, and{" "}
              <code className="font-mono text-[12px] text-fg">confirmedPowerMw</code> for
              capacity a source states is energized. They are never averaged and never merged.
              Where both exist, the confirmed figure is used and the estimate remains visible
              on the project page.
            </p>
            <p>
              A blank is not a zero. A project with no disclosed capacity is counted as
              unknown and excluded from the denominator, and every capacity headline reports
              how many projects it actually rests on.
            </p>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Capacity definitions</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <TableWrap>
              <Table>
                <thead>
                  <Tr>
                    <Th>View</Th>
                    <Th>Counts</Th>
                  </Tr>
                </thead>
                <tbody>
                  <Tr>
                    <Td className="text-fg">Announced</Td>
                    <Td>
                      Best figure per project, all statuses except cancelled. The
                      industry-standard number, published for comparability.
                    </Td>
                  </Tr>
                  <Tr>
                    <Td className="text-fg">Credible pipeline</Td>
                    <Td>
                      Announced, less{" "}
                      {NON_PIPELINE_STATUSES.map((s) => PROJECT_STATUS_META[s].label.toLowerCase()).join(
                        ", ",
                      )}
                      . Capacity nobody has committed to building.
                    </Td>
                  </Tr>
                  <Tr>
                    <Td className="text-fg">Under construction or beyond</Td>
                    <Td>
                      {BUILDING_STATUSES.map((s) => PROJECT_STATUS_META[s].label).join(", ")}.
                      Capacity backed by physical work.
                    </Td>
                  </Tr>
                  <Tr>
                    <Td className="text-fg">Confirmed operating</Td>
                    <Td>
                      Only <code className="font-mono text-[11px]">confirmedPowerMw</code>{" "}
                      values — a source states the capacity is energized. Statuses{" "}
                      {ENERGIZED_STATUSES.map((s) => PROJECT_STATUS_META[s].label.toLowerCase()).join(
                        " or ",
                      )}
                      .
                    </Td>
                  </Tr>
                </tbody>
              </Table>
            </TableWrap>
            <p className="mt-3 text-[11px] leading-relaxed text-fg-muted">
              Capacity figures may describe IT load, total site power or on-site generation.
              Where a source distinguishes them, the basis is recorded in the claim&apos;s
              methodology field and shown on the project page. Where it does not, the project
              is marked <em>basis unclear</em> rather than assumed.
            </p>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Confidence-weighted capacity</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <p className="mb-3 text-[12px] leading-relaxed text-fg-dim">
              A single modelled figure, published alongside the raw ones. Each project&apos;s
              best power figure is multiplied by the weight of the confidence level attached
              to its own power claim, then summed across the credible pipeline. These weights
              are judgement, not measurement.
            </p>
            <TableWrap>
              <Table>
                <thead>
                  <Tr>
                    <Th>Claim confidence</Th>
                    <Th className="text-right">Weight</Th>
                  </Tr>
                </thead>
                <tbody>
                  {Object.entries(CONFIDENCE_WEIGHTS).map(([level, weight]) => (
                    <Tr key={level}>
                      <Td className="text-fg">{level}</Td>
                      <Td className="num text-right">{Math.round(weight * 100)}%</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
            <p className="mt-3 text-[11px] leading-relaxed text-fg-muted">
              A project whose power claim carries no confidence assessment is weighted at the
              floor rather than assumed sound. Rumoured, paused and cancelled capacity is
              excluded entirely. Treat the result as a modelled estimate and cite the raw
              figures instead where precision matters.
            </p>
          </PanelBody>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader>
            <PanelTitle>Credibility assessment</PanelTitle>
          </PanelHeader>
          <PanelBody className="space-y-3">
            <p className="text-[12px] leading-relaxed text-fg-dim">
              Each project carries a categorical assessment rather than a score, because a
              number would invent precision the evidence cannot support and hide the reason.
              The components below are evaluated from evidence already on the project page and
              shown in full beside the verdict.
            </p>
            <ul className="ml-4 list-disc space-y-1 text-[12px] leading-relaxed text-fg-dim">
              <li>
                <span className="text-fg">Independent sources</span> — one source is not
                corroboration.
              </li>
              <li>
                <span className="text-fg">Primary source</span> — an owner statement, filing
                or permit, as against trade press.
              </li>
              <li>
                <span className="text-fg">Physical progress</span> — whether the status
                evidences construction or operation.
              </li>
              <li>
                <span className="text-fg">Operating capacity</span> — whether any figure is
                stated as energized.
              </li>
              <li>
                <span className="text-fg">Claim confidence</span> — the mix of confidence
                levels across the project&apos;s individual claims.
              </li>
              <li>
                <span className="text-fg">Verification freshness</span> — records unverified
                for more than {STALE_AFTER_DAYS} days are marked stale.
              </li>
              <li>
                <span className="text-fg">Contradictory evidence</span> — only where an
                analyst has explicitly flagged conflicting reporting.
              </li>
            </ul>

            <TableWrap>
              <Table>
                <thead>
                  <Tr>
                    <Th>State</Th>
                    <Th>Means</Th>
                  </Tr>
                </thead>
                <tbody>
                  {Object.entries(CREDIBILITY_META).map(([key, meta]) => (
                    <Tr key={key}>
                      <Td className="whitespace-nowrap text-fg">{meta.label}</Td>
                      <Td>{meta.description}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>

            <p className="text-[11px] leading-relaxed text-fg-muted">
              Confirmed operating capacity outranks staleness: an energized facility does not
              become less energized because nobody re-checked it this quarter. A paused
              project is not marked stale either — &quot;not moving&quot; is the accurate
              description, not a gap in the record.
            </p>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Power readiness</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <p className="mb-3 text-[12px] leading-relaxed text-fg-dim">
              A separate axis from credibility. A project can be entirely real and have no
              identified electricity, so megawatts announced are never treated as megawatts
              secured.
            </p>
            <TableWrap>
              <Table>
                <thead>
                  <Tr>
                    <Th>State</Th>
                    <Th>Means</Th>
                  </Tr>
                </thead>
                <tbody>
                  {Object.entries(POWER_READINESS_META).map(([key, meta]) => (
                    <Tr key={key}>
                      <Td className="whitespace-nowrap text-fg">{meta.label}</Td>
                      <Td>{meta.description}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Siting risk</PanelTitle>
          </PanelHeader>
          <PanelBody className="space-y-3 text-[12px] leading-relaxed text-fg-dim">
            <p>
              Restrictions are graded 0–5 on how hard they bind, from an advisory study to an
              indefinite prohibition. Only restrictions that genuinely block, and that are in
              force now, count toward capacity at risk.
            </p>
            <p>
              A project is counted once, at its largest affected capacity, so overlapping
              county and state restrictions cannot inflate the same megawatts twice. Links
              between a restriction and a project are asserted by an analyst from reporting —
              never inferred from matching location names.
            </p>
            <p className="text-fg-muted">
              The result is deliberately smaller than an ordinance count.{" "}
              <Link href="/siting" className="text-cyan hover:underline">
                See the siting page
              </Link>{" "}
              for how many live restrictions block nothing at all.
            </p>
          </PanelBody>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader>
            <PanelTitle>Limitations</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <ul className="ml-4 list-disc space-y-1.5 text-[12px] leading-relaxed text-fg-dim">
              <li>
                <span className="text-fg">Coverage is uneven.</span> The dataset reflects
                which sources are watched. Regions and operators that publish less are
                under-represented, and that is a property of the collection, not of the world.
              </li>
              <li>
                <span className="text-fg">Most figures are announced, not confirmed.</span>{" "}
                That gap is the finding, but it also means most rows carry a target rather
                than a measurement.
              </li>
              <li>
                <span className="text-fg">Capacity basis is often unstated.</span> Many
                sources do not distinguish IT load from total site power. Comparing two
                projects on megawatts alone can therefore compare unlike quantities.
              </li>
              <li>
                <span className="text-fg">Company association is not economic attribution.</span>{" "}
                A supplier named on a one-gigawatt project does not own one gigawatt. Roles are
                recorded separately and capacity is never summed across them.
              </li>
              <li>
                <span className="text-fg">Timelines slip and are rarely restated.</span>{" "}
                Expected opening dates come from announcements that are seldom formally
                revised, so an unchanged date is not evidence a schedule is intact.
              </li>
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-fg-muted">
              Figures combine reported disclosures with clearly labelled analyst estimates.
              Review the underlying sources and confidence levels before citing or relying on
              any figure. Not investment advice.
            </p>
          </PanelBody>
        </Panel>
      </div>
    </>
  );
}
