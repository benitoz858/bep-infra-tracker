import { handler, ok } from "@/lib/api";
import { requireCapability } from "@/lib/permissions";
import { markProjectVerified } from "@/lib/services/verification";

/**
 * Quick action from the verification queue. The service owns the update and the
 * revision write, so this handler stays a thin caller.
 */
export const POST = handler(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireCapability("record:edit");
    const { id } = await params;

    return ok(await markProjectVerified(id, user.id));
  },
);
