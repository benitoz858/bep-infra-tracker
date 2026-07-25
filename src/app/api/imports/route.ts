import { z } from "zod";

import { handler, ok, parseJson } from "@/lib/api";
import { requireCapability } from "@/lib/permissions";
import { commitImport, previewImport, type ImportEntity } from "@/lib/services/import";

const ENTITIES = ["projects", "companies", "sources"] as const;

const previewSchema = z.object({
  entity: z.enum(ENTITIES),
  csv: z.string().min(1, "Paste or upload some CSV first.").max(5_000_000),
});

const commitSchema = previewSchema.extend({
  acceptedRowNumbers: z.array(z.number().int().positive()),
});

/** Dry run: parse, map, validate, duplicate-check. Writes nothing. */
export const POST = handler(async (request: Request) => {
  await requireCapability("data:import");

  const url = new URL(request.url);
  const commit = url.searchParams.get("commit") === "1";

  if (!commit) {
    const input = await parseJson(request, previewSchema);
    return ok(await previewImport(input.entity as ImportEntity, input.csv));
  }

  const user = await requireCapability("record:create");
  const input = await parseJson(request, commitSchema);

  return ok(
    await commitImport(
      input.entity as ImportEntity,
      input.csv,
      input.acceptedRowNumbers,
      user.id,
    ),
  );
});
