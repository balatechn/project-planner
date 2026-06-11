import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

// GET /api/training — returns published videos (all users) or all videos (admin)
export async function GET() {
  return handle(async () => {
    const user = await getAuthedUser();
    const isAdmin = user.role === "ADMIN";

    const videos = await prisma.trainingVideo.findMany({
      where: isAdmin ? {} : { isPublished: true },
      include: {
        uploadedBy: { select: { id: true, name: true, image: true } },
      },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "desc" }],
    });

    return json({ videos });
  });
}

// POST /api/training — admin creates a training video
export async function POST(req: Request) {
  return handle(async () => {
    const user = await getAuthedUser();
    requirePermission(user.role, "admin:users");

    const body = await req.json();
    const { title, description, videoUrl, thumbnail, category, duration, isPublished, orderIndex } =
      body as {
        title: string;
        description?: string;
        videoUrl: string;
        thumbnail?: string;
        category?: string;
        duration?: string;
        isPublished?: boolean;
        orderIndex?: number;
      };

    if (!title?.trim() || !videoUrl?.trim()) {
      return json({ error: "Title and video URL are required." }, { status: 400 });
    }

    // Basic URL validation
    try {
      new URL(videoUrl);
    } catch {
      return json({ error: "Invalid video URL." }, { status: 400 });
    }

    const video = await prisma.trainingVideo.create({
      data: {
        title: title.trim(),
        description: description?.trim() ?? null,
        videoUrl: videoUrl.trim(),
        thumbnail: thumbnail?.trim() ?? null,
        category: category?.trim() ?? null,
        duration: duration?.trim() ?? null,
        isPublished: isPublished ?? false,
        orderIndex: orderIndex ?? 0,
        uploadedById: user.id,
      },
      include: {
        uploadedBy: { select: { id: true, name: true, image: true } },
      },
    });

    return json({ video }, { status: 201 });
  });
}
