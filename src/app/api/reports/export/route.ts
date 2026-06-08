import ExcelJS from "exceljs";
import { format } from "date-fns";
import { getAuthedUser, handle } from "@/lib/api";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { projectAccessWhere } from "@/lib/projects";

// GET /api/reports/export?format=xlsx|pdf
export async function GET(req: Request) {
  return handle(async () => {
    const user = await getAuthedUser();
    requirePermission(user.role, "report:export");
    const { searchParams } = new URL(req.url);
    const fmt = searchParams.get("format") ?? "xlsx";
    const where = projectAccessWhere(user.id, user.role);

    const projects = await prisma.project.findMany({
      where: { ...where, isArchived: false },
      include: {
        owner: { select: { name: true } },
        tasks: { select: { status: true, progress: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { name: "asc" },
    });

    const rows = projects.map((p) => {
      const pct =
        p.tasks.length === 0
          ? 0
          : Math.round(
              p.tasks.reduce(
                (s, t) => s + (t.status === "COMPLETED" ? 100 : t.progress),
                0,
              ) / p.tasks.length,
            );
      return {
        name: p.name,
        key: p.key,
        department: p.department ?? "—",
        status: p.status,
        priority: p.priority,
        owner: p.owner.name ?? "—",
        tasks: p._count.tasks,
        completion: pct,
        budget: p.budget?.toString() ?? "",
        endDate: p.endDate ? format(p.endDate, "yyyy-MM-dd") : "",
      };
    });

    if (fmt === "pdf") {
      // Lightweight printable HTML — opens in browser and triggers print-to-PDF.
      const html = printableHtml(rows);
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Excel via ExcelJS
    const wb = new ExcelJS.Workbook();
    wb.creator = "Project Planner";
    const ws = wb.addWorksheet("Projects");
    ws.columns = [
      { header: "Project", key: "name", width: 32 },
      { header: "Key", key: "key", width: 12 },
      { header: "Department", key: "department", width: 18 },
      { header: "Status", key: "status", width: 14 },
      { header: "Priority", key: "priority", width: 12 },
      { header: "Owner", key: "owner", width: 22 },
      { header: "Tasks", key: "tasks", width: 8 },
      { header: "Completion %", key: "completion", width: 14 },
      { header: "Budget", key: "budget", width: 14 },
      { header: "End date", key: "endDate", width: 14 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2563EB" },
    };
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    rows.forEach((r) => ws.addRow(r));

    const buffer = await wb.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="project-report-${format(new Date(), "yyyyMMdd")}.xlsx"`,
      },
    });
  });
}

function printableHtml(
  rows: { name: string; department: string; status: string; completion: number; owner: string; tasks: number }[],
): string {
  const body = rows
    .map(
      (r) => `<tr>
        <td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.department)}</td>
        <td>${escapeHtml(r.status)}</td>
        <td>${escapeHtml(r.owner)}</td>
        <td style="text-align:right">${r.tasks}</td>
        <td style="text-align:right">${r.completion}%</td>
      </tr>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Project Report</title>
  <style>
    body{font-family:Segoe UI,Arial,sans-serif;margin:40px;color:#0f172a}
    h1{color:#2563eb}
    table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}
    th,td{border:1px solid #e2e8f0;padding:8px 10px;text-align:left}
    th{background:#2563eb;color:#fff}
    @media print{button{display:none}}
  </style></head>
  <body onload="window.print()">
    <h1>Project Report</h1>
    <p>Generated ${format(new Date(), "PPpp")}</p>
    <table><thead><tr>
      <th>Project</th><th>Department</th><th>Status</th><th>Owner</th><th>Tasks</th><th>Completion</th>
    </tr></thead><tbody>${body}</tbody></table>
  </body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
