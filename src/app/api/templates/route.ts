import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

// GET /api/templates — all templates
export async function GET() {
  return handle(async () => {
    await getAuthedUser();
    const templates = await prisma.projectTemplate.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        department: true,
        isSystem: true,
        blueprint: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });

    const enriched = templates.map((t) => {
      let taskCount = 0;
      try {
        const bp = t.blueprint as { tasks?: unknown[] };
        taskCount = Array.isArray(bp?.tasks) ? bp.tasks.length : 0;
      } catch { /* noop */ }
      return { ...t, taskCount };
    });

    return json({ templates: enriched });
  });
}

// POST /api/templates — admin creates a template
export async function POST(req: Request) {
  return handle(async () => {
    const user = await getAuthedUser();
    requirePermission(user.role, "template:manage");

    const body = await req.json();
    const { name, description, department, blueprint, isSystem } = body as {
      name: string;
      description?: string;
      department?: string;
      blueprint?: object;
      isSystem?: boolean;
    };

    if (!name?.trim()) {
      return json({ error: "Name is required." }, { status: 400 });
    }

    const template = await prisma.projectTemplate.create({
      data: {
        name: name.trim(),
        description: description?.trim() ?? null,
        department: department?.trim() ?? null,
        blueprint: blueprint ?? { tasks: [] },
        isSystem: isSystem ?? false,
      },
    });

    return json({ template }, { status: 201 });
  });
}
