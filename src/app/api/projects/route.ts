import { handler, ok, parseJson } from "@/lib/api";
import { requireCapability } from "@/lib/permissions";
import { createProject, listProjects } from "@/lib/services/projects";
import { projectInputSchema, projectQuerySchema } from "@/lib/validations/project";

export const GET = handler(async (request: Request) => {

  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const query = projectQuerySchema.parse(params);

  return ok(await listProjects(query));
});

export const POST = handler(async (request: Request) => {
  const user = await requireCapability("record:create");

  const input = await parseJson(request, projectInputSchema);
  const result = await createProject(input, user.id);

  return ok(result, { status: 201 });
});
