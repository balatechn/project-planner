import { ApiError, getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { canAccessProject } from "@/lib/projects";
import { storeFile } from "@/lib/storage";
import { logActivity } from "@/lib/activity";

type Params = { params: Promise<{ id: string }> };

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

// POST /api/tasks/:id/attachments — multipart upload.
export async function POST(req: Request, { params }: Params) {
  return handle(async () => {
    const user = await getAuthedUser();
    requirePermission(user.role, "attachment:upload");
    const { id: taskId } = await params;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });
    if (!task) throw new ApiError(404, "Task not found");
    if (!(await canAccessProject(task.projectId, user.id, user.role)))
      throw new ApiError(404, "Task not found");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "No file provided");
    if (file.size > MAX_BYTES) throw new ApiError(413, "File exceeds 10MB limit");

    const bytes = Buffer.from(await file.arrayBuffer());
    const stored = await storeFile(file.name, bytes);

    const attachment = await prisma.attachment.create({
      data: {
        taskId,
        uploadedById: user.id,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        storageDriver: stored.driver,
        url: stored.url,
        driveItemId: stored.driveItemId,
      },
    });

    await logActivity({
      userId: user.id,
      action: "attachment.uploaded",
      projectId: task.projectId,
      entityType: "task",
      entityId: taskId,
      metadata: { fileName: file.name },
    });

    return json({ attachment }, { status: 201 });
  });
}
