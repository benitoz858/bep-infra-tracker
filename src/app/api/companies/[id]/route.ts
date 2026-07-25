import { handler, ok, parseJson } from "@/lib/api";
import { requireCapability } from "@/lib/permissions";
import { deleteCompany, updateCompany } from "@/lib/services/companies";
import { companyInputSchema } from "@/lib/validations/company";

type Params = { params: Promise<{ id: string }> };

export const PATCH = handler(async (request: Request, { params }: Params) => {
  await requireCapability("record:edit");
  const { id } = await params;

  const input = await parseJson(request, companyInputSchema.partial());
  return ok(await updateCompany(id, input));
});

export const DELETE = handler(async (_request: Request, { params }: Params) => {
  await requireCapability("record:delete");
  const { id } = await params;

  await deleteCompany(id);
  return ok({ deleted: true });
});
