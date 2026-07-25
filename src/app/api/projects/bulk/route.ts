import { z } from "zod";

import { handler, ok, parseJson } from "@/lib/api";
import { ProjectStatus } from "@/generated/prisma/enums";
import { requireCapability } from "@/lib/permissions";
import { bulkAddTags, bulkUpdateStatus } from "@/lib/services/projects";

/**
 * One endpoint, two mutually exclusive bulk actions. The union means a caller
 * cannot send a half-specified request (ids with neither a status nor tags).
 */
const bulkSchema = z.union([
  z.object({
    projectIds: z.array(z.string().min(1)).min(1, "Select at least one project."),
    status: z.enum(ProjectStatus),
  }),
  z.object({
    projectIds: z.array(z.string().min(1)).min(1, "Select at least one project."),
    tagNames: z.array(z.string().trim().min(1)).min(1, "Enter at least one tag."),
  }),
]);

export const POST = handler(async (request: Request) => {
  const user = await requireCapability("record:edit");
  const input = await parseJson(request, bulkSchema);

  if ("status" in input) {
    const updated = await bulkUpdateStatus(input.projectIds, input.status, user.id);
    return ok({ updated, action: "status" });
  }

  const updated = await bulkAddTags(input.projectIds, input.tagNames, user.id);
  return ok({ updated, action: "tags" });
});
