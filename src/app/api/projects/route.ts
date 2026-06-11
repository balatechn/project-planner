import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { projectAccessWhere } from "@/lib/projects";
import { createProjectSchema } from "@/lib/validation";
import { projectKeyFromName } from "@/lib/utils";
import { logActivity } from "@/lib/activity";
import { sendEmail, renderEmail } from "@/lib/email";

const ADMIN_EMAIL = "bala@nationalgroupindia.com";

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

    const ownerId = data.ownerId ?? user.id;
    const project = await prisma.project.create({
      data: {
        name: data.name,
        key,
        description: data.description ?? null,
        entity: data.entity ?? null,
        department: data.department ?? null,
        priority: data.priority,
        status: data.status,
        startDate: data.startDate,
        endDate: data.endDate,
        budget: data.budget ?? null,
        currency: data.currency,
        color: data.color,
        ownerId,
        projectManagerId: data.projectManagerId ?? null,
        members: {
          create: Array.from(new Set(data.memberIds ?? []))
            .filter((id) => id !== ownerId)
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

    // Notify admin about the new project (fire-and-forget)
    sendEmail({
      to: ADMIN_EMAIL,
      subject: `New project created: ${project.name}`,
      html: renderEmail({
        heading: `New Project: ${project.name}`,
        body: `
          <p><strong>${user.name ?? user.email ?? "A user"}</strong> just created a new project.</p>
          <table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:14px">
            <tr><td style="padding:6px 0;color:#64748b;width:120px">Project</td><td><strong>${project.name}</strong> (${project.key})</td></tr>
            ${project.department ? `<tr><td style="padding:6px 0;color:#64748b">Department</td><td>${project.department}</td></tr>` : ""}
            ${project.status ? `<tr><td style="padding:6px 0;color:#64748b">Status</td><td>${project.status}</td></tr>` : ""}
            ${project.startDate ? `<tr><td style="padding:6px 0;color:#64748b">Start Date</td><td>${new Date(project.startDate).toDateString()}</td></tr>` : ""}
            ${project.endDate ? `<tr><td style="padding:6px 0;color:#64748b">End Date</td><td>${new Date(project.endDate).toDateString()}</td></tr>` : ""}
          </table>
        `,
        ctaLabel: "View Project",
        ctaUrl: `${process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? ""}/projects/${project.id}`,
      }),
    }).catch((err) => console.error("Admin project-created email failed:", err));

    return json({ project }, { status: 201 });
  });
}
