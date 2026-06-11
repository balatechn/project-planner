import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { AnnouncementType } from "@prisma/client";

// GET /api/announcements — returns active (non-expired) announcements, pinned first
export async function GET() {
  return handle(async () => {
    await getAuthedUser();
    const now = new Date();
    const announcements = await prisma.announcement.findMany({
      where: {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take: 50,
    });
    return json({ announcements });
  });
}

// POST /api/announcements — admin creates an announcement
export async function POST(req: Request) {
  return handle(async () => {
    const user = await getAuthedUser();
    requirePermission(user.role, "admin:users");

    const body = await req.json();
    const { title, body: text, type, isPinned, expiresAt } = body as {
      title: string;
      body: string;
      type?: AnnouncementType;
      isPinned?: boolean;
      expiresAt?: string;
    };

    if (!title?.trim() || !text?.trim()) {
      return json({ error: "Title and body are required." }, { status: 400 });
    }

    const announcement = await prisma.announcement.create({
      data: {
        title: title.trim(),
        body: text.trim(),
        type: type ?? "INFO",
        isPinned: isPinned ?? false,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        authorId: user.id,
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
    });

    return json({ announcement }, { status: 201 });
  });
}
