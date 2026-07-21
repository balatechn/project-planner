import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { DriveClient } from "./drive-client";

export const metadata: Metadata = { title: "Common Drive" };

export default async function DrivePage() {
  const user = await requireUser();

  const [allUsers, grants] = await Promise.all([
    user.role === "ADMIN"
      ? prisma.user.findMany({
          where: { isActive: true },
          select: { id: true, name: true, email: true, role: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    prisma.driveAccess.findMany({
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: [{ folderPath: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return (
    <DriveClient
      currentUserId={user.id}
      currentUserRole={user.role}
      allUsers={allUsers}
      initialGrants={grants.map((g) => ({
        id: g.id,
        folderPath: g.folderPath,
        userId: g.userId,
        role: g.role,
        canWrite: g.canWrite,
        userName: g.user?.name ?? g.user?.email ?? null,
      }))}
    />
  );
}
