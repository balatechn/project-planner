import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";

// GET /api/users — directory of active users for assignee/member pickers.
export async function GET() {
  return handle(async () => {
    await getAuthedUser();
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        department: true,
        jobTitle: true,
      },
      orderBy: { name: "asc" },
    });
    return json({ users });
  });
}
