/**
 * Daily maintenance cron (Vercel Cron, 02:00 UTC = 07:30 IST):
 *  1. Purge recycle-bin items older than 30 days (every day)
 *  2. Due-date reminder emails — tasks due in 1 or 3 days (every day)
 *  3. Send the weekly digest email to every active user (Mondays only)
 * Guarded by CRON_SECRET when set.
 */
import { NextResponse } from "next/server";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { renderEmail, sendEmail } from "@/lib/email";

const BIN_RETENTION_DAYS = 30;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const results: Record<string, number> = {};

  // ── 1. Purge expired recycle-bin items ──
  const cutoff = new Date(now.getTime() - BIN_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const [purgedTasks, purgedProjects] = await Promise.all([
    prisma.task.deleteMany({ where: { deletedAt: { lt: cutoff } } }),
    prisma.project.deleteMany({ where: { deletedAt: { lt: cutoff } } }),
  ]);
  results.purgedTasks = purgedTasks.count;
  results.purgedProjects = purgedProjects.count;

  // ── 2. Due-date reminders (every day) ──
  // Window: tasks due exactly tomorrow OR exactly 3 days from now (IST day boundaries
  // approximated by UTC midnight since the cron fires at 02:00 UTC = start of IST day).
  const dayMs = 24 * 60 * 60 * 1000;
  const todayMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day1Start = new Date(todayMidnight.getTime() + 1 * dayMs);
  const day1End   = new Date(todayMidnight.getTime() + 2 * dayMs - 1);
  const day3Start = new Date(todayMidnight.getTime() + 3 * dayMs);
  const day3End   = new Date(todayMidnight.getTime() + 4 * dayMs - 1);

  const reminderTasks = await prisma.task.findMany({
    where: {
      deletedAt: null,
      status: { notIn: ["COMPLETED"] },
      project: { deletedAt: null, isArchived: false, published: true },
      OR: [
        { dueDate: { gte: day1Start, lte: day1End } },
        { dueDate: { gte: day3Start, lte: day3End } },
      ],
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      priority: true,
      projectId: true,
      project: { select: { name: true } },
      assignees: {
        select: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  // Group tasks by assignee
  const byUser = new Map<
    string,
    {
      name: string;
      email: string;
      tomorrow: typeof reminderTasks;
      threeDays: typeof reminderTasks;
    }
  >();
  for (const task of reminderTasks) {
    const isDueTomorrow = task.dueDate! >= day1Start && task.dueDate! <= day1End;
    for (const { user } of task.assignees) {
      if (!user.email) continue;
      if (!byUser.has(user.id)) {
        byUser.set(user.id, { name: user.name ?? "", email: user.email, tomorrow: [], threeDays: [] });
      }
      const bucket = byUser.get(user.id)!;
      if (isDueTomorrow) bucket.tomorrow.push(task);
      else bucket.threeDays.push(task);
    }
  }

  const baseUrl = process.env.AUTH_URL ?? "https://sharepoint.nationalgroupindia.com";

  const taskRow = (t: (typeof reminderTasks)[number]) =>
    `<tr>
      <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0">${t.title}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;color:#64748b">${t.project.name}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;white-space:nowrap">${t.dueDate ? format(t.dueDate, "MMM d") : "—"}</td>
    </tr>`;

  const taskSection = (label: string, colour: string, rows: typeof reminderTasks) =>
    rows.length
      ? `<p style="margin:14px 0 5px;font-weight:700;color:${colour}">${label} (${rows.length})</p>
         <table style="width:100%;border-collapse:collapse;font-size:13px">${rows.map(taskRow).join("")}</table>`
      : "";

  let remindersSent = 0;
  for (const { name, email, tomorrow, threeDays } of byUser.values()) {
    if (tomorrow.length === 0 && threeDays.length === 0) continue;
    const total = tomorrow.length + threeDays.length;
    const ok = await sendEmail({
      to: email,
      subject: `Reminder: ${total} task${total === 1 ? "" : "s"} due soon`,
      html: renderEmail({
        heading: `Tasks due soon, ${name.split(" ")[0] || "there"}`,
        body: `
          <p>You have <strong>${total} task${total === 1 ? "" : "s"}</strong> coming up.</p>
          ${taskSection("Due tomorrow", "#dc2626", tomorrow)}
          ${taskSection("Due in 3 days", "#1e3a5f", threeDays)}
        `,
        ctaLabel: "Open My Tasks",
        ctaUrl: `${baseUrl}/my-tasks`,
      }),
    });
    if (ok) remindersSent += 1;
  }
  results.remindersSent = remindersSent;

  // ── 3. Weekly digest — Mondays only ──
  if (now.getUTCDay() === 1) {
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
    });

    let sent = 0;
    for (const user of users) {
      const open = await prisma.task.findMany({
        where: {
          assignees: { some: { userId: user.id } },
          status: { not: "COMPLETED" },
          project: { deletedAt: null, isArchived: false, published: true },
        },
        select: {
          title: true,
          dueDate: true,
          priority: true,
          project: { select: { name: true } },
        },
        orderBy: [{ dueDate: "asc" }],
        take: 50,
      });
      if (open.length === 0) continue;

      const overdue = open.filter((t) => t.dueDate && t.dueDate < now);
      const dueThisWeek = open.filter(
        (t) => t.dueDate && t.dueDate >= now && t.dueDate <= weekEnd,
      );

      const row = (t: (typeof open)[number]) =>
        `<tr>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${t.title}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;color:#64748b">${t.project.name}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;white-space:nowrap">${t.dueDate ? format(t.dueDate, "MMM d") : "—"}</td>
        </tr>`;

      const section = (label: string, colour: string, rows: typeof open) =>
        rows.length
          ? `<p style="margin:16px 0 6px;font-weight:700;color:${colour}">${label} (${rows.length})</p>
             <table style="width:100%;border-collapse:collapse;font-size:13px">${rows.map(row).join("")}</table>`
          : "";

      const ok = await sendEmail({
        to: user.email!,
        subject: `Your week ahead — ${overdue.length} overdue, ${dueThisWeek.length} due this week`,
        html: renderEmail({
          heading: `Weekly digest for ${user.name?.split(" ")[0] ?? "you"}`,
          body: `
            <p>You have <strong>${open.length} open ${open.length === 1 ? "task" : "tasks"}</strong> assigned to you.</p>
            ${section("⚠️ Overdue", "#dc2626", overdue)}
            ${section("📅 Due this week", "#1e3a5f", dueThisWeek)}
          `,
          ctaLabel: "Open My Tasks",
          ctaUrl: `${process.env.AUTH_URL ?? "https://sharepoint.nationalgroupindia.com"}/my-tasks`,
        }),
      });
      if (ok) sent += 1;
    }
    results.digestsSent = sent;
  }

  console.log("[daily-maintenance]", JSON.stringify(results));
  return NextResponse.json({ ok: true, ...results });
}
