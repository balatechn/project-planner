import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

// PATCH /api/templates/[id]
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await getAuthedUser();
    requirePermission(user.role, "template:manage");

    const { id } = await params;
    const body = await req.json();
    const { name, description, department, blueprint } = body as {
      name?: string;
      description?: string | null;
      department?: string | null;
      blueprint?: object;
    };

    const template = await prisma.projectTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() ?? null }),
        ...(department !== undefined && { department: department?.trim() ?? null }),
        ...(blueprint !== undefined && { blueprint }),
      },
    });

    return json({ template });
  });
}

// DELETE /api/templates/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await getAuthedUser();
    requirePermission(user.role, "template:manage");

    const { id } = await params;
    await prisma.projectTemplate.delete({ where: { id } });
    return json({ ok: true });
  });
}
