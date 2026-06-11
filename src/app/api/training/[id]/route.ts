import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

// PATCH /api/training/[id] — admin updates a training video
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await getAuthedUser();
    requirePermission(user.role, "admin:users");

    const { id } = await params;
    const body = await req.json();
    const { title, description, videoUrl, thumbnail, category, duration, isPublished, orderIndex } =
      body as {
        title?: string;
        description?: string;
        videoUrl?: string;
        thumbnail?: string | null;
        category?: string | null;
        duration?: string | null;
        isPublished?: boolean;
        orderIndex?: number;
      };

    if (videoUrl !== undefined) {
      try {
        new URL(videoUrl);
      } catch {
        return json({ error: "Invalid video URL." }, { status: 400 });
      }
    }

    const video = await prisma.trainingVideo.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() ?? null }),
        ...(videoUrl !== undefined && { videoUrl: videoUrl.trim() }),
        ...(thumbnail !== undefined && { thumbnail }),
        ...(category !== undefined && { category }),
        ...(duration !== undefined && { duration }),
        ...(isPublished !== undefined && { isPublished }),
        ...(orderIndex !== undefined && { orderIndex }),
      },
      include: {
        uploadedBy: { select: { id: true, name: true, image: true } },
      },
    });

    return json({ video });
  });
}

// DELETE /api/training/[id] — admin deletes a training video
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await getAuthedUser();
    requirePermission(user.role, "admin:users");

    const { id } = await params;
    await prisma.trainingVideo.delete({ where: { id } });
    return json({ ok: true });
  });
}
