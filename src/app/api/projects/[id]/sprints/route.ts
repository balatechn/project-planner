import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/projects";
import { z } from "zod";

const optionalDate = z.string().datetime().nullish().transform((v) => (v ? new Date(v) : null));

const createSprintSchema = z.object({
  name: z.string().min(1).max(100),
  goal: z.string().max(500).optional().nullable(),
  startDate: optionalDate,
  endDate: optionalDate,
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { id: projectId } = await params;
    if (!(await canAccessProject(projectId, user.id, user.role))) {
      return json({ error: "Not found" }, { status: 404 });
    }
    const sprints = await prisma.sprint.findMany({
      where: { projectId },
      orderBy: { orderIndex: "asc" },
    });
    return json({ sprints });
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { id: projectId } = await params;
    if (!(await canAccessProject(projectId, user.id, user.role))) {
      return json({ error: "Not found" }, { status: 404 });
    }
    const body = await req.json();
    const data = createSprintSchema.parse(body);
    const count = await prisma.sprint.count({ where: { projectId } });
    const sprint = await prisma.sprint.create({
      data: {
        projectId,
        name: data.name,
        goal: data.goal ?? null,
        startDate: data.startDate,
        endDate: data.endDate,
        orderIndex: count,
      },
    });
    return json({ sprint }, { status: 201 });
  });
}
