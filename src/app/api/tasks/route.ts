import { ApiError, getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { canAccessProject } from "@/lib/projects";
import { createTaskSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity";
import { notifyMany } from "@/lib/notifications";

// GET /api/tasks?projectId=... — list tasks for a project.
export async function GET(req: Request) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) throw new ApiError(400, "projectId is required");
    if (!(await canAccessProject(projectId, user.id, user.role)))
      throw new ApiError(404, "Project not found");

    // Optional parentId filter — if provided, return subtasks of that task only
    const parentIdParam = searchParams.get("parentId");

    const tasks = await prisma.task.findMany({
      where: {
        projectId,
        ...(parentIdParam !== null ? { parentId: parentIdParam } : {}),
      },
      include: {
        assignees: {
          select: {
            user: { select: { id: true, name: true, image: true } },
          },
        },
        _count: { select: { subtasks: true, comments: true, attachments: true, checklistItems: true } },
        dependsOn: { select: { prerequisiteId: true } },
        createdBy: { select: { id: true } },
      },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
    });
    return json({ tasks: tasks.map((t) => ({
      ...t,
      createdById: t.createdBy.id,
      startDate: t.startDate?.toISOString() ?? null,
      dueDate: t.dueDate?.toISOString() ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
      baselineStart: (t as Record<string, unknown>).baselineStart instanceof Date
        ? ((t as Record<string, unknown>).baselineStart as Date).toISOString()
        : null,
      baselineEnd: (t as Record<string, unknown>).baselineEnd instanceof Date
        ? ((t as Record<string, unknown>).baselineEnd as Date).toISOString()
        : null,
    })) });
  });
}

// POST /api/tasks — create a task or subtask.
export async function POST(req: Request) {
  return handle(async () => {
    const user = await getAuthedUser();
    requirePermission(user.role, "task:create");
    const data = createTaskSchema.parse(await req.json());

    if (!(await canAccessProject(data.projectId, user.id, user.role)))
      throw new ApiError(404, "Project not found");

    const lastTask = await prisma.task.findFirst({
      where: { projectId: data.projectId, status: data.status },
      orderBy: { orderIndex: "desc" },
      select: { orderIndex: true },
    });

    const task = await prisma.task.create({
      data: {
        projectId: data.projectId,
        parentId: data.parentId ?? null,
        sprintId: data.sprintId ?? null,
        title: data.title,
        description: data.description ?? null,
        status: data.status,
        priority: data.priority,
        startDate: data.startDate,
        dueDate: data.dueDate,
        estimatedHours: data.estimatedHours ?? null,
        progress: data.progress,
        isMilestone: data.isMilestone ?? false,
        wbsNumber: data.wbsNumber ?? null,
        baselineStart: data.baselineStart ?? null,
        baselineEnd: data.baselineEnd ?? null,
        orderIndex: (lastTask?.orderIndex ?? 0) + 1,
        createdById: user.id,
        assignees: {
          create: Array.from(new Set(data.assigneeIds ?? [])).map((userId) => ({
            userId,
          })),
        },
        dependsOn: {
          create: Array.from(new Set(data.dependsOnIds ?? [])).map(
            (prerequisiteId) => ({ prerequisiteId }),
          ),
        },
        labels: data.labelIds?.length
          ? {
              create: Array.from(new Set(data.labelIds)).map((labelId) => ({ labelId })),
            }
          : undefined,
      },
      include: {
        assignees: { select: { userId: true } },
        project: { select: { name: true } },
      },
    });

    await logActivity({
      userId: user.id,
      action: "task.created",
      projectId: data.projectId,
      entityType: "task",
      entityId: task.id,
      metadata: { title: task.title },
    });

    // Notify assignees (excluding the creator).
    const assigneeIds = task.assignees
      .map((a) => a.userId)
      .filter((uid) => uid !== user.id);
    if (assigneeIds.length > 0) {
      await notifyMany(assigneeIds, {
        type: "TASK_ASSIGNED",
        title: `New task assigned: ${task.title}`,
        body: `${user.name ?? "Someone"} assigned you a task in ${task.project.name}.`,
        link: `/projects/${data.projectId}?task=${task.id}`,
        email: true,
      });
    }

    return json({ task }, { status: 201 });
  });
}
