import { ApiError, getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { projectAccessWhere } from "@/lib/projects";
import { cached } from "@/lib/cache";
import { rateLimit, clientKeyFromRequest } from "@/lib/rate-limit-redis";

// GET /api/search?q=... — instant search for the command palette.
// Returns top project and task matches scoped to the caller's access.
// Redis-cached per user+query (10s) and rate-limited (Redis sliding window).
export async function GET(req: Request) {
  return handle(async () => {
    const user = await getAuthedUser();

    // 60 searches / 10s per client — generous for type-ahead, stops abuse
    const rl = await rateLimit(`search:${clientKeyFromRequest(req)}`, 60, 10_000);
    if (!rl.allowed) {
      throw new ApiError(429, "Too many searches — slow down a moment.");
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    if (q.length < 2) return json({ projects: [], tasks: [] });

    const where = projectAccessWhere(user.id, user.role);

    // Cache identical queries briefly, scoped per user so access stays correct
    const result = await cached(
      `search:${user.id}:${q.toLowerCase()}`,
      10,
      async () => {
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

        return { projects, tasks };
      },
    );

    return json(result);
  });
}
