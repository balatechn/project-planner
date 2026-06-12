/**
 * Daily maintenance cron (Vercel Cron, 02:00 UTC = 07:30 IST):
 *  1. Purge recycle-bin items older than 30 days (every day)
 *  2. Send the weekly digest email to every active user (Mondays only)
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

  // ── 2. Weekly digest — Mondays only ──
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
          project: { deletedAt: null, isArchived: false },
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
