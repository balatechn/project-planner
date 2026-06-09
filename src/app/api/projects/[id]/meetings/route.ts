import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma, Prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/projects";
import { z } from "zod";

const createMeetingSchema = z.object({
  title: z.string().min(1).max(200),
  meetingDate: z.string().datetime().transform((v) => new Date(v)),
  agenda: z.string().max(5000).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
  actionItems: z.array(z.object({
    text: z.string(),
    assigneeId: z.string().optional().nullable(),
    dueDate: z.string().optional().nullable(),
    done: z.boolean().default(false),
  })).optional().nullable(),
  attendees: z.string().optional().nullable(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { id: projectId } = await params;
    if (!(await canAccessProject(projectId, user.id, user.role))) {
      return json({ error: "Not found" }, { status: 404 });
    }
    const meetings = await prisma.meetingNote.findMany({
      where: { projectId },
      orderBy: { meetingDate: "desc" },
    });
    return json({ meetings });
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
    const data = createMeetingSchema.parse(body);
    const meeting = await prisma.meetingNote.create({
      data: {
        projectId,
        createdById: user.id,
        title: data.title,
        meetingDate: data.meetingDate,
        agenda: data.agenda ?? null,
        notes: data.notes ?? null,
        actionItems: data.actionItems ? data.actionItems : Prisma.JsonNull,
        attendees: data.attendees ?? null,
      },
    });
    return json({ meeting }, { status: 201 });
  });
}
