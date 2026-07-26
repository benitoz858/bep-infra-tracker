import { z } from "zod";

import { handler, ok, parseJson } from "@/lib/api";
import { requireCapability } from "@/lib/permissions";
import { acceptCandidate, rejectCandidate } from "@/lib/services/ingestion";

const reviewSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("accept"),
    projectId: z.string().min(1, "Choose the project this evidence belongs to."),
    keepClaimIndices: z.array(z.number().int().min(0)).default([]),
    reliabilityScore: z.number().int().min(0).max(100).nullish(),
    reviewNote: z.string().max(2000).nullish(),
  }),
  z.object({
    action: z.literal("reject"),
    reviewNote: z.string().max(2000).nullish(),
  }),
]);

/** Accepting creates records, so it needs create rights, not just read. */
export const POST = handler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireCapability("record:create");
    const { id } = await params;

    const input = await parseJson(request, reviewSchema);

    if (input.action === "reject") {
      return ok(
        await rejectCandidate({
          candidateId: id,
          reviewerId: user.id,
          reviewNote: input.reviewNote,
        }),
      );
    }

    const result = await acceptCandidate({
      candidateId: id,
      projectId: input.projectId,
      reviewerId: user.id,
      reviewNote: input.reviewNote,
      keepClaimIndices: input.keepClaimIndices,
      reliabilityScore: input.reliabilityScore ?? null,
    });

    return ok({ sourceId: result.source.id, projectSlug: result.project.slug });
  },
);
