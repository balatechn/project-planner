import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/projects";
import { z } from "zod";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  level: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  probability: z.coerce.number().int().min(1).max(5).optional(),
  impact: z.coerce.number().int().min(1).max(5).optional(),
  status: z.enum(["OPEN", "MITIGATED", "ACCEPTED", "CLOSED"]).optional(),
  mitigation: z.string().max(2000).optional().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; riskId: string }> },
) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { id: projectId, riskId } = await params;
    if (!(await canAccessProject(projectId, user.id, user.role))) {
      return json({ error: "Not found" }, { status: 404 });
    }
    const body = await req.json();
    const data = patchSchema.parse(body);
    const risk = await prisma.risk.update({ where: { id: riskId }, data });
    return json({ risk });
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; riskId: string }> },
) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { id: projectId, riskId } = await params;
    if (!(await canAccessProject(projectId, user.id, user.role))) {
      return json({ error: "Not found" }, { status: 404 });
    }
    await prisma.risk.delete({ where: { id: riskId } });
    return json({ ok: true });
  });
}
