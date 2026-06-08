import { ApiError, getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { canAccessProject } from "@/lib/projects";
import { logActivity } from "@/lib/activity";

type Params = { params: Promise<{ id: string }> };

// POST /api/projects/:id/archive — toggle archive state.
export async function POST(req: Request, { params }: Params) {
  return handle(async () => {
    const user = await getAuthedUser();
    requirePermission(user.role, "project:archive");
    const { id } = await params;
    if (!(await canAccessProject(id, user.id, user.role)))
      throw new ApiError(404, "Project not found");

    const body = (await req.json().catch(() => ({}))) as {
      archived?: boolean;
    };
    const archived = body.archived ?? true;

    const project = await prisma.project.update({
      where: { id },
      data: {
        isArchived: archived,
        archivedAt: archived ? new Date() : null,
        status: archived ? "ARCHIVED" : "ACTIVE",
      },
    });

    await logActivity({
      userId: user.id,
      action: archived ? "project.archived" : "project.unarchived",
      projectId: id,
      entityType: "project",
      entityId: id,
    });
    return json({ project });
  });
}
