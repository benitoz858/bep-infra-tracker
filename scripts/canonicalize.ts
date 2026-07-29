/**
 * One-off normalisation pass over companies and sources.
 *
 *   DATABASE_URL=… npx tsx scripts/canonicalize.ts [--apply]
 *
 * Without --apply it prints the plan and changes nothing, because a merge is
 * destructive in a way a seeder is not: it repoints foreign keys and deletes
 * rows. Read the plan first.
 *
 * Two problems, both artefacts of ingestion rather than of the model:
 *
 * 1. COMPANIES. The research seeder created one company per distinct `owner`
 *    string, so a source that named the signing vehicle ("Inversiones y
 *    Servicios Dataluna") or a product line ("Volcano Engine") produced a
 *    second public-company identity carrying the same ticker. That inflates
 *    company counts, splits exposure and breaks ticker attribution. Duplicates
 *    are merged into the canonical entity; a genuine legal vehicle is kept but
 *    flagged and parented so it stays in the graph without polluting the index.
 *
 * 2. SOURCES. The seeder wrote one Source row per research entry, so the same
 *    URL cited twice for two different quotes on one project became two rows.
 *    Claims are repointed to the survivor and the duplicate row is removed. The
 *    survivor is the row with the most claims, then the longest excerpt — the
 *    one carrying the most evidence.
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import type { CompanyType } from "../src/generated/prisma/enums";

const APPLY = process.argv.includes("--apply");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/**
 * Explicit mapping, not a fuzzy matcher.
 *
 * Entity resolution by string similarity is how "SK Group" and "SK Telecom"
 * get wrongly merged — they are genuinely different listed entities. Every
 * decision here is a judgement recorded by hand.
 *
 * `canonical` is the name the index should show. `vehicle` true means the
 * source name is a real legal entity worth keeping as a child record rather
 * than discarding.
 */
const COMPANY_RULES: {
  from: string;
  canonical: string;
  canonicalType?: CompanyType;
  vehicle?: boolean;
}[] = [
  // Product line, not a separate company.
  { from: "ByteDance (Volcano Engine)", canonical: "ByteDance" },
  // Local operating vehicle for the Chilean site — kept as a child of Google.
  {
    from: "Google (Inversiones y Servicios Dataluna)",
    canonical: "Google",
    vehicle: true,
  },
  // Same listed entity, 0728.HK; the parenthetical describes the silicon.
  { from: "China Telecom (chips/cluster by Alibaba T-Head)", canonical: "China Telecom" },
  // Partner list, not a company name.
  { from: "TELUS (with NVIDIA and HPE)", canonical: "TELUS", canonicalType: "OTHER" },
  { from: "Fir Hills Inc (Stock Farm Road) with Jeollanam-do provincial government", canonical: "Fir Hills" },
  { from: "Ubilink (JV of Foxlink, Ubitus, Shinfox Energy)", canonical: "Ubilink" },
  { from: "Yiwu County (Hami, Xinjiang) government-backed developers", canonical: "Yiwu County (Hami)", canonicalType: "GOVERNMENT" },
  { from: "Z.ai (formerly Zhipu AI)", canonical: "Z.ai" },
  // Group and the listed telco are reported interchangeably for these sites.
  { from: "SoftBank Group", canonical: "SoftBank" },
];

/**
 * Reclassification for companies dumped into OTHER.
 *
 * "Other" is close to useless in an investor product: it collapses a listed
 * telco, a bitcoin miner mid-pivot and a sovereign fund into one bucket. The
 * schema's CompanyType enum has no bitcoin-conversion or telecom member, so the
 * nearest honest existing value is used and the specific role is written into
 * `description`, which the company page renders.
 */
const RECLASSIFY: { name: string; type: CompanyType; description: string }[] = [
  { name: "Applied Digital", type: "COLOCATION_PROVIDER", description: "Bitcoin-hosting developer converted to AI datacenter landlord; leases capacity to CoreWeave." },
  { name: "IREN", type: "COLOCATION_PROVIDER", description: "Bitcoin miner pivoted to AI datacenters and GPU cloud; Microsoft is an anchor customer." },
  { name: "Cipher Mining", type: "COLOCATION_PROVIDER", description: "Bitcoin miner converting sites to AI datacenter capacity; AWS and Fluidstack are tenants." },
  { name: "Core Scientific", type: "COLOCATION_PROVIDER", description: "Bitcoin-hosting operator providing HPC capacity to CoreWeave." },
  { name: "TeraWulf", type: "COLOCATION_PROVIDER", description: "Bitcoin miner converted to AI datacenter landlord; Anthropic and Fluidstack are tenants." },
  { name: "Hut 8", type: "COLOCATION_PROVIDER", description: "Bitcoin miner converted to AI datacenter landlord; Fluidstack tenant with a Google backstop." },
  { name: "Galaxy Digital", type: "COLOCATION_PROVIDER", description: "Digital-asset firm converting its Helios bitcoin campus to leased AI datacenter capacity." },
  { name: "Bell Canada", type: "UTILITY", description: "Telecom operator building a sovereign AI inference network with Groq." },
  { name: "TELUS", type: "UTILITY", description: "Telecom operator running sovereign AI factories with NVIDIA and HPE." },
  { name: "Deutsche Telekom", type: "UTILITY", description: "Telecom operator; runs the NVIDIA-partnered Industrial AI Cloud in Munich." },
  { name: "KDDI", type: "UTILITY", description: "Japanese telecom operator; operates the Osaka Sakai AI datacenter." },
  { name: "China Telecom", type: "UTILITY", description: "State-owned Chinese telecom operator and the country's largest AI datacenter operator." },
  { name: "Ooredoo", type: "UTILITY", description: "Qatari telecom operator running a sovereign AI cloud with NVIDIA." },
  { name: "SK Telecom", type: "UTILITY", description: "Korean telecom operator; AWS is the anchor tenant at its Ulsan AI datacenter." },
  { name: "Foxconn", type: "SERVER_VENDOR", description: "Contract manufacturer; builds AI server systems and Taiwan's national AI factory with NVIDIA." },
  { name: "Poolside", type: "NEOCLOUD", description: "AI lab self-building datacenter capacity." },
  { name: "Z.ai", type: "NEOCLOUD", description: "Chinese AI lab (formerly Zhipu) operating compute on domestic accelerators." },
  { name: "Tesla", type: "NEOCLOUD", description: "Builds in-house AI training capacity (Cortex) for FSD and Optimus." },
  { name: "G42", type: "NEOCLOUD", description: "Abu Dhabi AI group; parent of Khazna and partner to Microsoft and OpenAI." },
  { name: "MGX", type: "REAL_ESTATE", description: "Abu Dhabi AI-infrastructure investment vehicle." },
  { name: "Reliance Industries", type: "REAL_ESTATE", description: "Indian conglomerate developing gigawatt-scale AI capacity at Jamnagar." },
  { name: "Tata Group", type: "COLOCATION_PROVIDER", description: "Indian conglomerate; TCS HyperVault supplies AI datacenter capacity to OpenAI." },
  { name: "Samsung Group", type: "SERVER_VENDOR", description: "Korean conglomerate; memory supplier and Stargate Korea partner." },
  { name: "SK Group", type: "SERVER_VENDOR", description: "Korean conglomerate; SK hynix supplies HBM and it partners on Stargate Korea." },
  { name: "SoftBank", type: "REAL_ESTATE", description: "Investment group building AI datacenter capacity in Japan and France; OpenAI partner." },
  { name: "EcoCloud", type: "COLOCATION_PROVIDER", description: "Kenyan developer of the geothermal-powered Olkaria campus with G42." },
  { name: "Sur Energy", type: "POWER_VENDOR", description: "Argentine energy developer; OpenAI's counterparty on the Patagonia letter of intent." },
  { name: "Fir Hills", type: "REAL_ESTATE", description: "Investment vehicle proposing a multi-gigawatt Korean AI campus." },
  { name: "Ubilink", type: "NEOCLOUD", description: "Taiwanese AI supercomputing joint venture and NVIDIA cloud partner." },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function mergeCompanies() {
  console.log("\n=== COMPANIES ===");
  let merged = 0;

  for (const rule of COMPANY_RULES) {
    const dupe = await prisma.company.findFirst({
      where: { name: rule.from },
      include: { _count: { select: { ownedProjects: true, projectLinks: true } } },
    });
    if (!dupe) continue;

    let canonical = await prisma.company.findFirst({ where: { name: rule.canonical } });

    if (!canonical) {
      // No canonical row exists: rename in place rather than create-and-merge,
      // which preserves the id every project already points at.
      console.log(`  rename   "${rule.from}" -> "${rule.canonical}"`);
      if (APPLY) {
        canonical = await prisma.company.update({
          where: { id: dupe.id },
          data: {
            name: rule.canonical,
            slug: slugify(rule.canonical),
            aliases: { set: [rule.from] },
            ...(rule.canonicalType ? { companyType: rule.canonicalType } : {}),
          },
        });
      }
      merged += 1;
      continue;
    }

    console.log(
      `  merge    "${rule.from}" (${dupe._count.ownedProjects} owned, ${dupe._count.projectLinks} links) -> "${rule.canonical}"${rule.vehicle ? " [keep as legal vehicle]" : ""}`,
    );

    if (APPLY) {
      if (rule.vehicle) {
        // Keep the vehicle as a child record: the project page should still be
        // able to say which entity actually signed, while the index shows the
        // parent. Ownership stays with the vehicle; exposure rolls up.
        await prisma.company.update({
          where: { id: dupe.id },
          data: {
            parentCompanyId: canonical.id,
            isLegalVehicle: true,
            ticker: null, // the ticker belongs to the parent, not the vehicle
          },
        });
      } else {
        await prisma.project.updateMany({
          where: { ownerCompanyId: dupe.id },
          data: { ownerCompanyId: canonical.id },
        });
        // Role links are unique on (projectId, companyId, role), so a link that
        // would collide with an existing one on the canonical company is dropped
        // rather than repointed.
        const links = await prisma.projectCompany.findMany({ where: { companyId: dupe.id } });
        for (const link of links) {
          const clash = await prisma.projectCompany.findFirst({
            where: { projectId: link.projectId, companyId: canonical.id, role: link.role },
          });
          if (clash) await prisma.projectCompany.delete({ where: { id: link.id } });
          else
            await prisma.projectCompany.update({
              where: { id: link.id },
              data: { companyId: canonical.id },
            });
        }
        await prisma.company.update({
          where: { id: canonical.id },
          data: {
            aliases: { push: rule.from },
            ...(rule.canonicalType ? { companyType: rule.canonicalType } : {}),
          },
        });
        await prisma.company.delete({ where: { id: dupe.id } });
      }
      merged += 1;
    } else {
      merged += 1;
    }
  }

  console.log(`  ${merged} company rule(s) ${APPLY ? "applied" : "would apply"}`);
}

async function reclassify() {
  console.log("\n=== RECLASSIFY 'OTHER' ===");
  let n = 0;
  for (const r of RECLASSIFY) {
    const c = await prisma.company.findFirst({
      where: { name: r.name },
      select: { id: true, companyType: true, description: true },
    });
    if (!c) continue;
    if (c.companyType === r.type && c.description) continue;
    console.log(`  ${r.name}: ${c.companyType} -> ${r.type}`);
    if (APPLY) {
      await prisma.company.update({
        where: { id: c.id },
        // Do not clobber an existing description written by an analyst.
        data: { companyType: r.type, description: c.description ?? r.description },
      });
    }
    n += 1;
  }
  console.log(`  ${n} reclassification(s) ${APPLY ? "applied" : "would apply"}`);
}

async function dedupeSources() {
  console.log("\n=== SOURCES ===");
  const sources = await prisma.source.findMany({
    select: {
      id: true,
      projectId: true,
      url: true,
      title: true,
      excerpt: true,
      isPrimarySource: true,
      _count: { select: { metrics: true } },
    },
  });

  const groups = new Map<string, typeof sources>();
  for (const s of sources) {
    // Same project + same URL modulo trailing slash and case. Deliberately not
    // fuzzy on title: two genuinely different pages can share a headline.
    const key = `${s.projectId}|${s.url.trim().toLowerCase().replace(/\/+$/, "")}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }

  let removed = 0;
  let repointed = 0;

  for (const group of groups.values()) {
    if (group.length < 2) continue;

    // Survivor carries the most evidence: most claims, then longest excerpt,
    // then primary status as the tiebreak.
    const sorted = [...group].sort(
      (a, b) =>
        b._count.metrics - a._count.metrics ||
        (b.excerpt?.length ?? 0) - (a.excerpt?.length ?? 0) ||
        Number(b.isPrimarySource) - Number(a.isPrimarySource),
    );
    const [keep, ...drop] = sorted;

    console.log(
      `  keep ${keep._count.metrics} claim(s), drop ${drop.length}: ${keep.title.slice(0, 62)}`,
    );

    if (APPLY) {
      for (const d of drop) {
        const moved = await prisma.projectMetric.updateMany({
          where: { sourceId: d.id },
          data: { sourceId: keep.id },
        });
        repointed += moved.count;
        // Merge a distinct excerpt into the survivor rather than losing the
        // quote — it is the evidence the duplicate row existed to carry.
        if (d.excerpt && keep.excerpt && !keep.excerpt.includes(d.excerpt)) {
          await prisma.source.update({
            where: { id: keep.id },
            data: { excerpt: `${keep.excerpt}\n\n${d.excerpt}` },
          });
        }
        await prisma.source.delete({ where: { id: d.id } });
        removed += 1;
      }
    } else {
      removed += drop.length;
    }
  }

  console.log(
    `  ${removed} duplicate source(s) ${APPLY ? `removed, ${repointed} claim(s) repointed` : "would be removed"}`,
  );
}

async function main() {
  console.log(APPLY ? "APPLYING changes" : "DRY RUN — pass --apply to write");
  await mergeCompanies();
  await reclassify();
  await dedupeSources();

  const [companies, vehicles, others, sources] = await Promise.all([
    prisma.company.count({ where: { isLegalVehicle: false } }),
    prisma.company.count({ where: { isLegalVehicle: true } }),
    prisma.company.count({ where: { companyType: "OTHER", isLegalVehicle: false } }),
    prisma.source.count(),
  ]);
  console.log(
    `\nAfter: ${companies} companies (+${vehicles} legal vehicles), ${others} still OTHER, ${sources} sources`,
  );
  await prisma.$disconnect();
}

void main();
