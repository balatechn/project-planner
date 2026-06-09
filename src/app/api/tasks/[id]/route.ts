import { ApiError, getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { canAccessProject } from "@/lib/projects";
import { updateTaskSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity";
import { notifyMany } from "@/lib/notifications";

type Params = { params: Promise<{ id: string }> };

async function loadTaskForUser(id: string, userId: string, role: Parameters<typeof canAccessProject>[2]) {
  const task = await prisma.task.findUnique({
    where: { id },
    select: { id: true, projectId: true, status: true, title: true },
  });
  if (!task) throw new ApiError(404, "Task not found");
  if (!(await canAccessProject(task.projectId, userId, role)))
    throw new ApiError(404, "Task not found");
  return task;
}

export async function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { id } = await params;
    await loadTaskForUser(id, user.id, user.role);

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignees: {
          select: { user: { select: { id: true, name: true, image: true } } },
        },
        subtasks: {
          include: {
            assignees: {
              select: { user: { select: { id: true, name: true, image: true } } },
            },
          },
          orderBy: { orderIndex: "asc" },
        },
        comments: {
          include: {
            author: { select: { id: true, name: true, image: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        attachments: true,
        dependsOn: {
          include: {
            prerequisite: { select: { id: true, title: true, status: true } },
          },
        },
        checklistItems: { orderBy: { orderIndex: "asc" } },
        timeLogs: {
          include: { user: { select: { id: true, name: true, image: true } } },
          orderBy: { logDate: "desc" },
          take: 20,
        },
        createdBy: { select: { id: true, name: true, image: true } },
        project: { select: { id: true, name: true, color: true } },
      },
    });
    return json({ task });
  });
}

export async function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { id } = await params;
    const existing = await loadTaskForUser(id, user.id, user.role);

    const data = updateTaskSchema.parse(await req.json());

    // Status-only updates are allowed for team members.
    const onlyStatusOrOrder =
      Object.keys(data).every((k) =>
        ["status", "progress", "orderIndex"].includes(k),
      );
    requirePermission(
      user.role,
      onlyStatusOrOrder ? "task:updateStatus" : "task:edit",
    );

    const { assigneeIds, dependsOnIds, labelIds, ...rest } = data;
    const completing =
      rest.status === "COMPLETED" && existing.status !== "COMPLETED";

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...rest,
        estimatedHours: rest.estimatedHours ?? undefined,
        actualHours: rest.actualHours ?? undefined,
        completedAt: completing
          ? new Date()
          : rest.status && rest.status !== "COMPLETED"
            ? null
            : undefined,
        progress: completing ? 100 : rest.progress,
        ...(assigneeIds
          ? {
              assignees: {
                deleteMany: {},
                create: Array.from(new Set(assigneeIds)).map((userId) => ({
                  userId,
                })),
              },
            }
          : {}),
        ...(dependsOnIds
          ? {
              dependsOn: {
                deleteMany: {},
                create: Array.from(new Set(dependsOnIds)).map(
                  (prerequisiteId) => ({ prerequisiteId }),
                ),
              },
            }
          : {}),
      },
      include: { assignees: { select: { userId: true } } },
    });

    await logActivity({
      userId: user.id,
      action: rest.status ? "task.status_changed" : "task.updated",
      projectId: existing.projectId,
      entityType: "task",
      entityId: id,
      metadata: rest.status ? { status: rest.status } : undefined,
    });

    if (assigneeIds && assigneeIds.length > 0) {
      await notifyMany(
        assigneeIds.filter((uid) => uid !== user.id),
        {
          type: "TASK_ASSIGNED",
          title: `You were assigned: ${existing.title}`,
          link: `/projects/${existing.projectId}?task=${id}`,
          email: true,
        },
      );
    }

    return json({ task });
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return handle(async () => {
    const user = await getAuthedUser();
    requirePermission(user.role, "task:delete");
    const { id } = await params;
    const existing = await loadTaskForUser(id, user.id, user.role);

    await prisma.task.delete({ where: { id } });
    await logActivity({
      userId: user.id,
      action: "task.deleted",
      projectId: existing.projectId,
      entityType: "task",
      entityId: id,
    });
    return json({ ok: true });
  });
}
