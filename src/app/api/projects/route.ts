import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { projectAccessWhere } from "@/lib/projects";
import { createProjectSchema } from "@/lib/validation";
import { projectKeyFromName } from "@/lib/utils";
import { logActivity } from "@/lib/activity";

// GET /api/projects — list accessible projects.
export async function GET(req: Request) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get("archived") === "true";

    const projects = await prisma.project.findMany({
      where: {
        ...projectAccessWhere(user.id, user.role),
        ...(includeArchived ? {} : { isArchived: false }),
      },
      include: {
        owner: { select: { id: true, name: true, image: true } },
        members: {
          select: { user: { select: { id: true, name: true, image: true } } },
        },
        tasks: { select: { status: true, progress: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return json({ projects });
  });
}

// POST /api/projects — create a project.
export async function POST(req: Request) {
  return handle(async () => {
    const user = await getAuthedUser();
    requirePermission(user.role, "project:create");

    const body = await req.json();
    const data = createProjectSchema.parse(body);

    // Generate a unique project key.
    let key = projectKeyFromName(data.name);
    let suffix = 1;
    while (await prisma.project.findUnique({ where: { key } })) {
      key = `${projectKeyFromName(data.name)}${suffix++}`;
    }

    const project = await prisma.project.create({
      data: {
        name: data.name,
        key,
        description: data.description ?? null,
        department: data.department ?? null,
        priority: data.priority,
        status: data.status,
        startDate: data.startDate,
        endDate: data.endDate,
        budget: data.budget ?? null,
        currency: data.currency,
        color: data.color,
        ownerId: data.ownerId ?? user.id,
        members: {
          create: Array.from(new Set(data.memberIds ?? []))
            .filter((id) => id !== (data.ownerId ?? user.id))
            .map((userId) => ({ userId })),
        },
      },
    });

    await logActivity({
      userId: user.id,
      action: "project.created",
      projectId: project.id,
      entityType: "project",
      entityId: project.id,
      metadata: { name: project.name },
    });

    return json({ project }, { status: 201 });
  });
}
