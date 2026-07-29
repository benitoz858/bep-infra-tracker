import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./src/generated/prisma/client";
async function main() {
  const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const rows = await p.ingestionCandidate.findMany({
    where: { submitterName: { contains: "daily research agent" } },
    select: { title: true, suggestedProject: { select: { name: true } }, submitterNote: true },
    orderBy: { createdAt: "desc" },
  });
  console.log("agent submissions in queue:", rows.length);
  for (const r of rows) console.log(" -", r.title.slice(0, 72), "->", r.suggestedProject?.name ?? "(new/unmatched)");
  await p.$disconnect();
}
void main();
