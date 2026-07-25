import { handler, ok } from "@/lib/api";
import { requireCapability } from "@/lib/permissions";
import { deleteSource } from "@/lib/services/sources";

export const DELETE = handler(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    await requireCapability("record:delete");
    const { id } = await params;

    await deleteSource(id);
    return ok({ deleted: true });
  },
);
