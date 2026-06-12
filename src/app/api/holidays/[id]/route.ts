import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  return handle(async () => {
    const user = await getAuthedUser();
    requirePermission(user.role, "admin:users");
    const { id } = await params;
    await prisma.holiday.delete({ where: { id } });
    return json({ ok: true });
  });
}
