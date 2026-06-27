import { NextResponse } from "next/server";
import { startOfDay, endOfDay, addDays, format } from "date-fns";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { projectAccessWhere } from "@/lib/projects";
import { logActivity } from "@/lib/activity";
import { ensureInboxLabels } from "@/lib/ensure-inbox-labels";

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? "";

const taskSelect = {
  id: true,
  title: true,
  priority: true,
  status: true,
  dueDate: true,
  project: { select: { id: true, name: true, color: true } },
} as const;

type RawTask = {
  id: string;
  title: string;
  priority: string;
  status: string;
  dueDate: Date | null;
  project: { id: string; name: string; color: string };
};

function serializeTask(t: RawTask) {
  return {
    id: t.id,
    title: t.title,
    priority: t.priority,
    status: t.status,
    dueDate: t.dueDate?.toISOString() ?? null,
    projectId: t.project.id,
    projectName: t.project.name,
    projectColor: t.project.color,
  };
}

export async function GET() {
  const user = await requireUser();
  const labels = await ensureInboxLabels();

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekEnd = addDays(now, 7);

  const myOpen = {
    assignees: { some: { userId: user.id } },
    status: { not: "COMPLETED" as const },
    deletedAt: null,
  };

  const [
    pending,
    completedToday,
    urgent,
    todaysTasks,
    followUpTasks,
    delegatedTasks,
    teamPendingTasks,
    upcomingMeetings,
    approvalTasks,
    callTasks,
    procurementTasks,
    noteTasks,
  ] = await Promise.all([
    prisma.task.count({ where: myOpen }),
    prisma.task.count({
      where: {
        assignees: { some: { userId: user.id } },
        status: "COMPLETED",
        completedAt: { gte: todayStart },
        deletedAt: null,
      },
    }),
    prisma.task.count({
      where: { ...myOpen, priority: "HIGH", dueDate: { lt: now } },
    }),
    prisma.task.findMany({
      where: { ...myOpen, dueDate: { gte: todayStart, lte: todayEnd } },
      select: taskSelect,
      orderBy: { dueDate: "asc" },
      take: 30,
    }),
    prisma.task.findMany({
      where: { ...myOpen, labels: { some: { labelId: labels["Follow-up"] } } },
      select: taskSelect,
      orderBy: { dueDate: "asc" },
      take: 30,
    }),
    prisma.task.findMany({
      where: {
        createdById: user.id,
        status: { not: "COMPLETED" },
        deletedAt: null,
        assignees: { some: {} },
        NOT: { assignees: { some: { userId: user.id } } },
      },
      select: taskSelect,
      orderBy: { dueDate: "asc" },
      take: 30,
    }),
    prisma.task.findMany({
      where: {
        project: projectAccessWhere(user.id, user.role),
        status: { not: "COMPLETED" },
        deletedAt: null,
        NOT: { assignees: { some: { userId: user.id } } },
      },
      select: taskSelect,
      orderBy: { dueDate: "asc" },
      take: 30,
    }),
    prisma.roomBooking.findMany({
      where: {
        OR: [{ organizerId: user.id }, { attendeeIds: { has: user.id } }],
        startTime: { gte: now, lte: weekEnd },
        status: { not: "CANCELLED" },
      },
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
        room: { select: { name: true } },
      },
      orderBy: { startTime: "asc" },
      take: 10,
    }),
    prisma.task.findMany({
      where: { ...myOpen, labels: { some: { labelId: labels["Approval"] } } },
      select: taskSelect,
      orderBy: { dueDate: "asc" },
      take: 30,
    }),
    prisma.task.findMany({
      where: { ...myOpen, labels: { some: { labelId: labels["Call"] } } },
      select: taskSelect,
      orderBy: { dueDate: "asc" },
      take: 30,
    }),
    prisma.task.findMany({
      where: { ...myOpen, labels: { some: { labelId: labels["Procurement"] } } },
      select: taskSelect,
      orderBy: { dueDate: "asc" },
      take: 30,
    }),
    prisma.task.findMany({
      where: { ...myOpen, labels: { some: { labelId: labels["Note"] } } },
      select: taskSelect,
      orderBy: { dueDate: "asc" },
      take: 30,
    }),
  ]);

  return NextResponse.json({
    stats: { pending, completedToday, urgent },
    sections: {
      todaysTasks: todaysTasks.map(serializeTask),
      pendingFollowUps: followUpTasks.map(serializeTask),
      delegatedTasks: delegatedTasks.map(serializeTask),
      teamPending: teamPendingTasks.map(serializeTask),
      upcomingMeetings: upcomingMeetings.map((m) => ({
        id: m.id,
        title: m.title,
        startTime: m.startTime.toISOString(),
        endTime: m.endTime.toISOString(),
        roomName: m.room.name,
      })),
      awaitingApproval: approvalTasks.map(serializeTask),
      callsToMake: callTasks.map(serializeTask),
      procurement: procurementTasks.map(serializeTask),
      notes: noteTasks.map(serializeTask),
    },
  });
}

export async function POST(req: Request) {
  const user = await requireUser();

  if (!GEMINI_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const { text } = (await req.json()) as { text?: string };
  if (!text?.trim()) {
    return NextResponse.json({ error: "Empty input" }, { status: 400 });
  }

  const labels = await ensureInboxLabels();

  const projects = await prisma.project.findMany({
    where: {
      isArchived: false,
      OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
    },
    select: { id: true, name: true },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  const today = format(new Date(), "yyyy-MM-dd");
  const SYSTEM = `You are a task extraction assistant. Extract ALL actionable items from the text below.

Today: ${today}
User's projects: ${JSON.stringify(projects)}

Return ONLY a valid JSON array (no markdown, no explanation):
[{ "title": "concise task (max 80 chars)", "label": "Follow-up"|"Approval"|"Call"|"Procurement"|"Note"|null, "priority": "LOW"|"MEDIUM"|"HIGH", "dueDate": "YYYY-MM-DD"|null, "projectId": "<id from projects list>"|null }]

Label rules: Follow-up=track later, Approval=needs sign-off, Call=phone/video call, Procurement=buying/ordering, Note=info to remember, null=general task.
Return ONLY the JSON array.`;

  let parsed: Array<{
    title: string;
    label: string | null;
    priority: "LOW" | "MEDIUM" | "HIGH";
    dueDate: string | null;
    projectId: string | null;
  }>;

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(SYSTEM + "\n\nText:\n" + text.trim());
    const raw = result.response.text().trim().replace(/^```json\n?|```$/g, "").trim();
    parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("not array");
  } catch {
    return NextResponse.json(
      { error: "Could not parse tasks. Try pasting clearer text." },
      { status: 422 },
    );
  }

  const projectSet = new Set(projects.map((p) => p.id));
  const defaultProjectId = projects[0]?.id ?? null;
  let created = 0;

  for (const t of parsed) {
    if (!t.title?.trim()) continue;
    const projectId =
      t.projectId && projectSet.has(t.projectId) ? t.projectId : defaultProjectId;
    if (!projectId) continue;

    const labelId = t.label ? labels[t.label as keyof typeof labels] ?? null : null;

    try {
      const task = await prisma.task.create({
        data: {
          projectId,
          title: t.title.slice(0, 200),
          priority: t.priority ?? "MEDIUM",
          status: "NOT_STARTED",
          dueDate: t.dueDate ? new Date(t.dueDate) : null,
          orderIndex: 0,
          createdById: user.id,
          assignees: { create: [{ userId: user.id }] },
          ...(labelId ? { labels: { create: [{ labelId }] } } : {}),
        },
      });
      await logActivity({
        userId: user.id,
        action: "task.created",
        entityType: "task",
        entityId: task.id,
        projectId: task.projectId,
        metadata: { title: task.title, source: "ai_inbox_analyze" },
      });
      created++;
    } catch {
      // skip duplicates / race conditions
    }
  }

  return NextResponse.json({ created, total: parsed.length });
}
