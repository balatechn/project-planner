import { ApiError, getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { canAccessProject } from "@/lib/projects";
import { createCommentSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity";
import { notifyMany } from "@/lib/notifications";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  return handle(async () => {
    const user = await getAuthedUser();
    requirePermission(user.role, "comment:create");
    const { id: taskId } = await params;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        projectId: true,
        title: true,
        assignees: { select: { userId: true } },
        project: { select: { published: true } },
      },
    });
    if (!task) throw new ApiError(404, "Task not found");
    if (!(await canAccessProject(task.projectId, user.id, user.role)))
      throw new ApiError(404, "Task not found");

    const data = createCommentSchema.parse(await req.json());

    const comment = await prisma.comment.create({
      data: {
        taskId,
        authorId: user.id,
        body: data.body,
        mentions: data.mentions?.join(",") ?? null,
      },
      include: { author: { select: { id: true, name: true, image: true } } },
    });

    await logActivity({
      userId: user.id,
      action: "comment.added",
      projectId: task.projectId,
      entityType: "task",
      entityId: taskId,
    });

    // Notify assignees + explicit mentions (excluding the author).
    const recipients = [
      ...task.assignees.map((a) => a.userId),
      ...(data.mentions ?? []),
    ].filter((uid) => uid !== user.id);

    if (task.project.published) {
      await notifyMany(recipients, {
        type: "TASK_COMMENT",
        title: `New comment on ${task.title}`,
        body: data.body.slice(0, 140),
        link: `/projects/${task.projectId}?task=${taskId}`,
        email: false,
      });
    }

    return json({ comment }, { status: 201 });
  });
}
