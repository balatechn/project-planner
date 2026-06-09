import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  hours: z.coerce.number().positive().max(24),
  description: z.string().max(500).optional().nullable(),
  logDate: z.string().datetime().optional().transform((v) => (v ? new Date(v) : new Date())),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { id: taskId } = await params;
    const body = createSchema.parse(await req.json());

    const log = await prisma.timeLog.create({
      data: {
        taskId,
        userId: user.id,
        hours: body.hours,
        description: body.description ?? null,
        logDate: body.logDate ?? new Date(),
      },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    });

    return json({ log }, { status: 201 });
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    await getAuthedUser();
    const { id: taskId } = await params;
    const logs = await prisma.timeLog.findMany({
      where: { taskId },
      include: { user: { select: { id: true, name: true, image: true } } },
      orderBy: { logDate: "desc" },
    });
    return json({ logs });
  });
}
