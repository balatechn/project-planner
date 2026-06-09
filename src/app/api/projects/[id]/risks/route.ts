import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/projects";
import { z } from "zod";

const createRiskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  level: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  probability: z.coerce.number().int().min(1).max(5).default(3),
  impact: z.coerce.number().int().min(1).max(5).default(3),
  mitigation: z.string().max(2000).optional().nullable(),
  dueDate: z.string().datetime().optional().nullable().transform((v) => (v ? new Date(v) : null)),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { id: projectId } = await params;
    if (!(await canAccessProject(projectId, user.id, user.role))) {
      return json({ error: "Not found" }, { status: 404 });
    }
    const risks = await prisma.risk.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    return json({ risks });
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
    const data = createRiskSchema.parse(body);
    const risk = await prisma.risk.create({
      data: { projectId, ...data },
    });
    return json({ risk }, { status: 201 });
  });
}
