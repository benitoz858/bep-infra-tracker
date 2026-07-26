import { handler, ok, parseJson } from "@/lib/api";
import { requireCapability } from "@/lib/permissions";
import { createCompany, listCompanies } from "@/lib/services/companies";
import { companyInputSchema, companyQuerySchema } from "@/lib/validations/company";

export const GET = handler(async (request: Request) => {

  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  return ok(await listCompanies(companyQuerySchema.parse(params)));
});

export const POST = handler(async (request: Request) => {
  await requireCapability("record:create");

  const input = await parseJson(request, companyInputSchema);
  return ok(await createCompany(input), { status: 201 });
});
