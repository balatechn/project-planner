import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { format, addDays, nextMonday, nextFriday, startOfTomorrow } from "date-fns";

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? "";

const SYSTEM = (today: string, projects: { id: string; name: string }[]) => `
You are a task-creation assistant. Parse the user's message and return ONLY valid JSON.

Today's date: ${today}
User's projects: ${JSON.stringify(projects)}

Return this exact JSON shape:
{
  "intent": "create_task" | "unknown",
  "title": "<task title>",
  "priority": "LOW" | "MEDIUM" | "HIGH",
  "dueDate": "<YYYY-MM-DD>" | null,
  "projectId": "<project id from the list above>" | null
}

Rules:
- If message is not a task/reminder, set intent to "unknown"
- Default priority is "MEDIUM"
- Resolve relative dates: "today"="${today}", "tomorrow", "Friday", "next week", "Monday", etc.
- If no project mentioned or unclear, set projectId to null
- Match project names case-insensitively (partial match is fine)
- Title should be concise (remove words like "add task", "remind me to", "create")
- Return ONLY the JSON object, no markdown, no explanation
`.trim();

export async function POST(req: Request) {
  const user = await requireUser();

  if (!GEMINI_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const { text } = (await req.json()) as { text?: string };
  if (!text?.trim()) {
    return NextResponse.json({ error: "Empty input" }, { status: 400 });
  }

  // Fetch user's accessible projects for context
  const projects = await prisma.project.findMany({
    where: {
      isArchived: false,
      OR: [
        { ownerId: user.id },
        { members: { some: { userId: user.id } } },
      ],
    },
    select: { id: true, name: true },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  const today = format(new Date(), "yyyy-MM-dd");

  // Call Gemini
  const genAI = new GoogleGenerativeAI(GEMINI_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  let parsed: {
    intent: string;
    title: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
    dueDate: string | null;
    projectId: string | null;
  };

  try {
    const result = await model.generateContent(
      SYSTEM(today, projects) + "\n\nUser message: " + text.trim(),
    );
    const raw = result.response.text().trim().replace(/^```json\n?|```$/g, "").trim();
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Could not understand that. Try: 'Review report by Friday'" }, { status: 422 });
  }

  if (parsed.intent !== "create_task") {
    return NextResponse.json(
      { error: "Couldn't identify a task. Try: 'Finish presentation by Monday high priority'" },
      { status: 422 },
    );
  }

  // Resolve projectId — fall back to user's most recent project
  const projectId =
    parsed.projectId && projects.find((p) => p.id === parsed.projectId)
      ? parsed.projectId
      : projects[0]?.id ?? null;

  if (!projectId) {
    return NextResponse.json({ error: "No project found. Create a project first." }, { status: 422 });
  }

  const task = await prisma.task.create({
    data: {
      projectId,
      title: parsed.title,
      priority: parsed.priority ?? "MEDIUM",
      status: "NOT_STARTED",
      dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
      orderIndex: 0,
      createdById: user.id,
      assignees: { create: [{ userId: user.id }] },
    },
    include: {
      project: { select: { id: true, name: true } },
    },
  });

  await logActivity({
    userId: user.id,
    action: "task.created",
    entityType: "task",
    entityId: task.id,
    projectId: task.projectId,
    metadata: { title: task.title, source: "ai_quick_add" },
  });

  return NextResponse.json({
    task: {
      id: task.id,
      title: task.title,
      priority: task.priority,
      dueDate: task.dueDate?.toISOString() ?? null,
      projectId: task.projectId,
      projectName: task.project.name,
    },
  });
}
