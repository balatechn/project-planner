import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { AnnouncementType } from "@prisma/client";

// PATCH /api/announcements/[id] — admin updates an announcement
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await getAuthedUser();
    requirePermission(user.role, "admin:users");

    const { id } = await params;
    const body = await req.json();
    const { title, body: text, type, isPinned, isActive, expiresAt } =
      body as {
        title?: string;
        body?: string;
        type?: AnnouncementType;
        isPinned?: boolean;
        isActive?: boolean;
        expiresAt?: string | null;
      };

    const announcement = await prisma.announcement.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(text !== undefined && { body: text.trim() }),
        ...(type !== undefined && { type }),
        ...(isPinned !== undefined && { isPinned }),
        ...(isActive !== undefined && { isActive }),
        ...(expiresAt !== undefined && {
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        }),
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
    });

    return json({ announcement });
  });
}

// DELETE /api/announcements/[id] — admin deletes an announcement
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await getAuthedUser();
    requirePermission(user.role, "admin:users");

    const { id } = await params;
    await prisma.announcement.delete({ where: { id } });
    return json({ ok: true });
  });
}
