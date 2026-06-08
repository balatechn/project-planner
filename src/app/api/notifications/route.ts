import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";

// GET /api/notifications — current user's latest notifications.
export async function GET() {
  return handle(async () => {
    const user = await getAuthedUser();
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return json({ notifications });
  });
}

// PATCH /api/notifications — mark all as read.
export async function PATCH() {
  return handle(async () => {
    const user = await getAuthedUser();
    await prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true },
    });
    return json({ ok: true });
  });
}
