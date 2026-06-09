import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const patchSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  isCompleted: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  return handle(async () => {
    await getAuthedUser();
    const { itemId } = await params;
    const body = patchSchema.parse(await req.json());
    const item = await prisma.checklistItem.update({
      where: { id: itemId },
      data: body,
    });
    return json({ item });
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  return handle(async () => {
    await getAuthedUser();
    const { itemId } = await params;
    await prisma.checklistItem.delete({ where: { id: itemId } });
    return json({ ok: true });
  });
}
