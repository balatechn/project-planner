import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { format } from "date-fns";
import { getAuthedUser, handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/projects";

type Params = { params: Promise<{ id: string }> };

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  DELAYED: "Delayed",
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export async function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { id } = await params;

    if (!(await canAccessProject(id, user.id, user.role))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [project, tasks] = await Promise.all([
      prisma.project.findUnique({
        where: { id },
        select: { name: true },
      }),
      prisma.task.findMany({
        where: { projectId: id, deletedAt: null },
        orderBy: [{ status: "asc" }, { orderIndex: "asc" }],
        select: {
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          estimatedHours: true,
          actualHours: true,
          parentId: true,
          assignees: {
            select: { user: { select: { name: true } } },
          },
        },
      }),
    ]);

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "National Group India Sharepoint";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Tasks");

    sheet.columns = [
      { header: "Title",            key: "title",          width: 45 },
      { header: "Status",           key: "status",         width: 14 },
      { header: "Priority",         key: "priority",       width: 10 },
      { header: "Assignee(s)",      key: "assignees",      width: 30 },
      { header: "Due Date",         key: "dueDate",        width: 12 },
      { header: "Est. Hours",       key: "estimatedHours", width: 12 },
      { header: "Actual Hours",     key: "actualHours",    width: 12 },
      { header: "Type",             key: "type",           width: 10 },
    ];

    // Bold + light-blue header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD6E4F7" },
    };
    headerRow.alignment = { vertical: "middle" };
    headerRow.height = 20;

    for (const task of tasks) {
      const row = sheet.addRow({
        title:          task.parentId ? `  └ ${task.title}` : task.title,
        status:         STATUS_LABELS[task.status] ?? task.status,
        priority:       PRIORITY_LABELS[task.priority] ?? task.priority,
        assignees:      task.assignees.map((a) => a.user.name ?? "").filter(Boolean).join(", "),
        dueDate:        task.dueDate ? format(new Date(task.dueDate), "dd MMM yyyy") : "",
        estimatedHours: task.estimatedHours ?? "",
        actualHours:    task.actualHours ?? "",
        type:           task.parentId ? "Subtask" : "Task",
      });

      if (task.parentId) {
        row.font = { color: { argb: "FF64748B" }, italic: true };
      }
    }

    // Freeze header
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const safeName = project.name.replace(/[^a-zA-Z0-9\s-]/g, "").trim();
    const dateStr = format(new Date(), "yyyy-MM-dd");
    const filename = `${safeName}-tasks-${dateStr}.xlsx`;

    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
