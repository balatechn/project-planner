import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { id: taskId } = await params;

    const body = z.object({ title: z.string().min(1).max(500) }).parse(await req.json());

    const count = await prisma.checklistItem.count({ where: { taskId } });
    const item = await prisma.checklistItem.create({
      data: { taskId, title: body.title, orderIndex: count },
    });

    return json({ item }, { status: 201 });
  });
}
