import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Admins and Project Managers can see all projects; other roles see
// projects they own, are a member of, or have a task assigned in.
export function projectAccessWhere(userId: string, role: Role) {
  // deletedAt: null keeps recycle-bin projects out of every consumer,
  // including relation filters (project: where) the extension can't reach
  if (role === "ADMIN" || role === "PROJECT_MANAGER") return { deletedAt: null };
  return {
    deletedAt: null,
    OR: [
      { ownerId: userId },
      { members: { some: { userId } } },
      { tasks: { some: { deletedAt: null, assignees: { some: { userId } } } } },
    ],
  };
}

export async function canAccessProject(
  projectId: string,
  userId: string,
  role: Role,
): Promise<boolean> {
  if (role === "ADMIN" || role === "PROJECT_MANAGER") {
    const exists = await prisma.project.count({ where: { id: projectId } });
    return exists > 0;
  }
  const count = await prisma.project.count({
    where: {
      id: projectId,
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
        { tasks: { some: { assignees: { some: { userId } } } } },
      ],
    },
  });
  return count > 0;
}

/** Compute a project's completion % from its tasks (weighted by progress). */
export function computeProgress(
  tasks: { status: string; progress: number }[],
): number {
  if (tasks.length === 0) return 0;
  const total = tasks.reduce((sum, t) => {
    if (t.status === "COMPLETED") return sum + 100;
    return sum + (t.progress ?? 0);
  }, 0);
  return Math.round(total / tasks.length);
}
