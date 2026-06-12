import { z } from "zod";
import { ApiError, getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/activity";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  isActive: z.boolean().optional(),
  orderIndex: z.number().int().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const user = await getAuthedUser();
    requirePermission(user.role, "admin:users");
    const { id } = await params;
    const data = patchSchema.parse(await req.json());

    const option = await prisma.masterOption.update({ where: { id }, data });
    await writeAudit({
      userId: user.id,
      action: "master.updated",
      entityType: "masterOption",
      entityId: id,
      metadata: data,
    });
    return json({ option });
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return handle(async () => {
    const user = await getAuthedUser();
    requirePermission(user.role, "admin:users");
    const { id } = await params;

    const option = await prisma.masterOption.findUnique({ where: { id } });
    if (!option) throw new ApiError(404, "Master value not found");

    await prisma.masterOption.delete({ where: { id } });
    await writeAudit({
      userId: user.id,
      action: "master.deleted",
      entityType: "masterOption",
      entityId: id,
      metadata: { type: option.type, name: option.name },
    });
    return json({ ok: true });
  });
}
