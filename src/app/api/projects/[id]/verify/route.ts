import { handler, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/permissions";
import { NotFoundError } from "@/lib/services/errors";
import { recordRevision } from "@/lib/services/revisions";

/**
 * Quick action from the verification queue: stamp the project as verified now.
 * Writes a revision so "who confirmed this, and when" stays answerable.
 */
export const POST = handler(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireCapability("record:edit");
    const { id } = await params;

    const existing = await prisma.project.findUnique({
      where: { id },
      select: { id: true, lastVerifiedAt: true },
    });
    if (!existing) throw new NotFoundError("Project");

    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const project = await tx.project.update({
        where: { id },
        data: { lastVerifiedAt: now },
        select: { id: true, slug: true, lastVerifiedAt: true },
      });

      await recordRevision(tx, {
        projectId: id,
        userId: user.id,
        diffs: [
          {
            field: "lastVerifiedAt",
            from: existing.lastVerifiedAt?.toISOString() ?? null,
            to: now.toISOString(),
          },
        ],
        summary: "Marked as verified from the verification queue.",
      });

      return project;
    });

    return ok(updated);
  },
);
