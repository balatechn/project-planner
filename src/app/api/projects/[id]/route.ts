import { ApiError, getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { canAccessProject } from "@/lib/projects";
import { updateProjectSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { id } = await params;
    if (!(await canAccessProject(id, user.id, user.role)))
      throw new ApiError(404, "Project not found");

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, image: true, email: true } },
        members: {
          select: {
            role: true,
            user: {
              select: { id: true, name: true, image: true, email: true },
            },
          },
        },
      },
    });
    return json({ project });
  });
}

export async function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const user = await getAuthedUser();
    requirePermission(user.role, "project:edit");
    const { id } = await params;
    if (!(await canAccessProject(id, user.id, user.role)))
      throw new ApiError(404, "Project not found");

    const data = updateProjectSchema.parse(await req.json());
    const { memberIds, ...rest } = data;

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...rest,
        budget: rest.budget ?? undefined,
        ...(memberIds
          ? {
              members: {
                deleteMany: {},
                create: Array.from(new Set(memberIds)).map((userId) => ({
                  userId,
                })),
              },
            }
          : {}),
      },
    });

    await logActivity({
      userId: user.id,
      action: "project.updated",
      projectId: id,
      entityType: "project",
      entityId: id,
    });
    return json({ project });
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return handle(async () => {
    const user = await getAuthedUser();
    requirePermission(user.role, "project:delete");
    const { id } = await params;

    await prisma.project.delete({ where: { id } });
    await logActivity({
      userId: user.id,
      action: "project.deleted",
      entityType: "project",
      entityId: id,
    });
    return json({ ok: true });
  });
}
