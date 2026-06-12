import { z } from "zod";
import { ApiError, getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";

const actionSchema = z.object({
  type: z.enum(["project", "task"]),
  id: z.string().min(1),
  action: z.enum(["restore", "purge"]),
});

// POST /api/admin/recycle-bin — restore or permanently delete a binned item.
export async function POST(req: Request) {
  return handle(async () => {
    const user = await getAuthedUser();
    requirePermission(user.role, "admin:users");
    const { type, id, action } = actionSchema.parse(await req.json());

    if (type === "project") {
      const project = await prisma.project.findFirst({
        where: { id, deletedAt: { not: null } },
        select: { id: true, name: true },
      });
      if (!project) throw new ApiError(404, "Project not found in recycle bin");

      if (action === "restore") {
        await prisma.project.update({
          where: { id },
          data: { deletedAt: null },
        });
      } else {
        await prisma.project.delete({ where: { id } });
      }
      await logActivity({
        userId: user.id,
        action: action === "restore" ? "project.restored" : "project.purged",
        entityType: "project",
        entityId: id,
        metadata: { name: project.name },
      });
    } else {
      const task = await prisma.task.findFirst({
        where: { id, deletedAt: { not: null } },
        select: { id: true, title: true, projectId: true },
      });
      if (!task) throw new ApiError(404, "Task not found in recycle bin");

      if (action === "restore") {
        // Restore the task and any subtasks binned with it
        await prisma.task.updateMany({
          where: { OR: [{ id }, { parentId: id }] },
          data: { deletedAt: null },
        });
      } else {
        await prisma.task.delete({ where: { id } });
      }
      await logActivity({
        userId: user.id,
        action: action === "restore" ? "task.restored" : "task.purged",
        projectId: task.projectId,
        entityType: "task",
        entityId: id,
        metadata: { title: task.title },
      });
    }

    return json({ ok: true });
  });
}
