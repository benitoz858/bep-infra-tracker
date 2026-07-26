import { z } from "zod";

import { handler, ok, parseJson } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/permissions";
import { DataQualityError, NotFoundError } from "@/lib/services/errors";
import { candidateClaimSchema } from "@/lib/validations/source";

const createSchema = candidateClaimSchema.and(
  z.object({
    projectId: z.string().min(1),
    sourceId: z.string().nullish(),
  }),
);

export const GET = handler(async (request: Request) => {

  const projectId = new URL(request.url).searchParams.get("projectId");
  return ok(
    await prisma.projectMetric.findMany({
      where: projectId ? { projectId } : {},
      include: { source: { select: { id: true, title: true, url: true } } },
      orderBy: [{ projectId: "asc" }, { metricType: "asc" }],
      take: 500,
    }),
  );
});

export const POST = handler(async (request: Request) => {
  await requireCapability("record:create");
  const input = await parseJson(request, createSchema);

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { id: true },
  });
  if (!project) throw new NotFoundError("Project");

  // Data-quality rule: a confirmed metric must cite a source that exists.
  if (input.confidenceLevel === "CONFIRMED") {
    if (!input.sourceId) {
      throw new DataQualityError("A confirmed metric must cite a source.");
    }
    const source = await prisma.source.findFirst({
      where: { id: input.sourceId, projectId: input.projectId },
      select: { id: true },
    });
    if (!source) {
      throw new DataQualityError("The cited source does not exist on this project.");
    }
  }

  const metric = await prisma.projectMetric.create({
    data: {
      projectId: input.projectId,
      metricType: input.metricType,
      numericValue: input.numericValue,
      textValue: input.textValue,
      unit: input.unit,
      confidenceLevel: input.confidenceLevel,
      methodology: input.methodology,
      effectiveDate: input.effectiveDate,
      sourceId: input.sourceId ?? null,
    },
  });

  return ok(metric, { status: 201 });
});
