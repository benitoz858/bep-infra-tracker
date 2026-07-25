import { handler, ok, parseJson } from "@/lib/api";
import { requireCapability, requireUser } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/services/errors";
import { deleteProject, updateProject } from "@/lib/services/projects";
import { projectInputSchema } from "@/lib/validations/project";

type Params = { params: Promise<{ id: string }> };

export const GET = handler(async (_request: Request, { params }: Params) => {
  await requireUser();
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      ownerCompany: true,
      tags: true,
      companies: { include: { company: true } },
      sources: true,
      metrics: { include: { source: true } },
    },
  });
  if (!project) throw new NotFoundError("Project");

  return ok(project);
});

export const PATCH = handler(async (request: Request, { params }: Params) => {
  const user = await requireCapability("record:edit");
  const { id } = await params;

  const input = await parseJson(request, projectInputSchema);
  return ok(await updateProject(id, input, user.id));
});

export const DELETE = handler(async (_request: Request, { params }: Params) => {
  await requireCapability("record:delete");
  const { id } = await params;

  await deleteProject(id);
  return ok({ deleted: true });
});
