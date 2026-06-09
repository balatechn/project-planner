import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/projects";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  goal: z.string().max(500).optional().nullable(),
  status: z.enum(["PLANNING", "ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
  startDate: z.string().datetime().optional().nullable().transform((v) => (v ? new Date(v) : undefined)),
  endDate: z.string().datetime().optional().nullable().transform((v) => (v ? new Date(v) : undefined)),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; sprintId: string }> },
) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { id: projectId, sprintId } = await params;
    if (!(await canAccessProject(projectId, user.id, user.role))) {
      return json({ error: "Not found" }, { status: 404 });
    }
    const body = await req.json();
    const data = patchSchema.parse(body);
    const sprint = await prisma.sprint.update({
      where: { id: sprintId },
      data,
    });
    return json({ sprint });
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; sprintId: string }> },
) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { id: projectId, sprintId } = await params;
    if (!(await canAccessProject(projectId, user.id, user.role))) {
      return json({ error: "Not found" }, { status: 404 });
    }
    await prisma.sprint.delete({ where: { id: sprintId } });
    return json({ ok: true });
  });
}
