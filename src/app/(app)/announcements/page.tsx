import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { AnnouncementsClient } from "./announcements-client";

export const metadata: Metadata = { title: "Announcements" };

export default async function AnnouncementsPage() {
  const user = await requireUser();
  const isAdmin = can(user.role, "admin:users");

  const now = new Date();
  const announcements = await prisma.announcement.findMany({
    where: isAdmin
      ? {}
      : {
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
    include: {
      author: { select: { id: true, name: true, image: true } },
    },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
  });

  return (
    <AnnouncementsClient
      initialAnnouncements={announcements.map((a) => ({
        ...a,
        expiresAt: a.expiresAt?.toISOString() ?? null,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      }))}
      isAdmin={isAdmin}
    />
  );
}
