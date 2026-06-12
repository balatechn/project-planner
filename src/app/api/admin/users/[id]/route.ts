import { z } from "zod";
import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/activity";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  role: z.enum(["ADMIN", "PROJECT_MANAGER", "TEAM_MEMBER", "VIEWER"]).optional(),
  isActive: z.boolean().optional(),
  department: z.string().max(80).nullable().optional(),
  jobTitle: z.string().max(120).nullable().optional(),
  entity: z.string().max(80).nullable().optional(),
  location: z.string().max(80).nullable().optional(),
  weeklyCapacity: z.coerce.number().int().min(0).max(168).optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const user = await getAuthedUser();
    requirePermission(user.role, "admin:users");
    const { id } = await params;
    const data = schema.parse(await req.json());

    const updated = await prisma.user.update({ where: { id }, data });

    await writeAudit({
      userId: user.id,
      action: "user.updated",
      entityType: "user",
      entityId: id,
      metadata: data,
    });

    return json({ user: { id: updated.id, role: updated.role } });
  });
}
