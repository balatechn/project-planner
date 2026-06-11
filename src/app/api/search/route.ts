import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { projectAccessWhere } from "@/lib/projects";

// GET /api/search?q=... — instant search for the command palette.
// Returns top project and task matches scoped to the caller's access.
export async function GET(req: Request) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    if (q.length < 2) return json({ projects: [], tasks: [] });

    const where = projectAccessWhere(user.id, user.role);

    const [projects, tasks] = await Promise.all([
      prisma.project.findMany({
        where: {
          ...where,
          isArchived: false,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { key: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, key: true, color: true, status: true },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
      prisma.task.findMany({
        where: {
          project: where,
          title: { contains: q, mode: "insensitive" },
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          project: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 7,
      }),
    ]);

    return json({ projects, tasks });
  });
}
