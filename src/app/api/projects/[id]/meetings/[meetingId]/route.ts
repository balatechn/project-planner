import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma, Prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/projects";
import { z } from "zod";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  agenda: z.string().max(5000).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
  actionItems: z.array(z.object({
    text: z.string(),
    assigneeId: z.string().optional().nullable(),
    dueDate: z.string().optional().nullable(),
    done: z.boolean().default(false),
  })).optional().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; meetingId: string }> },
) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { id: projectId, meetingId } = await params;
    if (!(await canAccessProject(projectId, user.id, user.role))) {
      return json({ error: "Not found" }, { status: 404 });
    }
    const body = await req.json();
    const data = patchSchema.parse(body);
    const meeting = await prisma.meetingNote.update({
      where: { id: meetingId },
      data: {
        ...data,
        actionItems: data.actionItems === null
          ? Prisma.JsonNull
          : data.actionItems ?? undefined,
      },
    });
    return json({ meeting });
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; meetingId: string }> },
) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { id: projectId, meetingId } = await params;
    if (!(await canAccessProject(projectId, user.id, user.role))) {
      return json({ error: "Not found" }, { status: 404 });
    }
    await prisma.meetingNote.delete({ where: { id: meetingId } });
    return json({ ok: true });
  });
}
