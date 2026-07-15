"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import type { TaskListItem } from "@/types/app";
import { TASK_STATUS_LABELS, PRIORITY_LABELS } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── helpers ──────────────────────────────────────────────────────────────────

function wbsCompare(a: TaskListItem, b: TaskListItem) {
  if (!a.wbsNumber && !b.wbsNumber) return 0;
  if (!a.wbsNumber) return 1;
  if (!b.wbsNumber) return -1;
  const ap = a.wbsNumber.split(".").map(Number);
  const bp = b.wbsNumber.split(".").map(Number);
  for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
    const av = ap[i] ?? 0; const bv = bp[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

function treeSort(tasks: TaskListItem[]): TaskListItem[] {
  const childMap = new Map<string, TaskListItem[]>();
  const topLevel: TaskListItem[] = [];
  for (const t of tasks) {
    if (t.parentId) {
      if (!childMap.has(t.parentId)) childMap.set(t.parentId, []);
      childMap.get(t.parentId)!.push(t);
    } else topLevel.push(t);
  }
  topLevel.sort(wbsCompare);
  const result: TaskListItem[] = [];
  function flatten(t: TaskListItem) {
    result.push(t);
    const ch = childMap.get(t.id) ?? [];
    ch.sort(wbsCompare);
    for (const c of ch) flatten(c);
  }
  for (const t of topLevel) flatten(t);
  return result;
}

function taskType(t: TaskListItem) {
  if (t.isMilestone) return "Milestone";
  if (t.parentId) return "Subtask";
  return "Task";
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return format(new Date(d), "dd MMM yyyy");
}

function assignees(t: TaskListItem) {
  return t.assignees.map(a => a.user.name ?? "").filter(Boolean).join(", ") || "—";
}

// ── component ─────────────────────────────────────────────────────────────────

export function GanttReportView({
  projects,
  initialProjectId,
}: {
  projects: { id: string; name: string }[];
  initialProjectId: string;
}) {
  const router = useRouter();
  const [projectId, setProjectId] = React.useState(initialProjectId);
  const [tasks,     setTasks]     = React.useState<TaskListItem[]>([]);
  const [loading,   setLoading]   = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  const projectName = projects.find(p => p.id === projectId)?.name ?? "Report";
  const sorted = React.useMemo(() => treeSort(tasks), [tasks]);

  // Load tasks whenever project changes
  React.useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    fetch(`/api/tasks?projectId=${projectId}`)
      .then(r => r.json())
      .then(d => setTasks(d.tasks ?? []))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  function handleProjectChange(id: string) {
    setProjectId(id);
    router.replace(`/reports/gantt?projectId=${id}`, { scroll: false });
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = "Project Planner";
      wb.created = new Date();

      const ws = wb.addWorksheet("Gantt Report", {
        pageSetup: { orientation: "landscape", fitToPage: true },
        views: [{ state: "frozen", xSplit: 0, ySplit: 1 }],
      });

      ws.columns = [
        { key: "type",      width: 14 },
        { key: "wbs",       width: 10 },
        { key: "title",     width: 54 },
        { key: "status",    width: 16 },
        { key: "priority",  width: 12 },
        { key: "start",     width: 16 },
        { key: "finish",    width: 16 },
        { key: "assignees", width: 36 },
      ];

      // Header row
      const headers = ["Type", "WBS ID", "Title", "Status", "Priority", "Start Date", "Finish Date", "Assignee(s)"];
      const hRow = ws.addRow(headers);
      hRow.height = 22;
      hRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10, name: "Calibri" };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
        cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        cell.border = { bottom: { style: "thin", color: { argb: "FFCBD5E1" } }, right: { style: "thin", color: { argb: "FFCBD5E1" } } };
      });

      const typeFill: Record<string, { bg: string; fg: string }> = {
        Milestone: { bg: "FFFDE68A", fg: "FF92400E" },
        Task:      { bg: "FFBFDBFE", fg: "FF1D4ED8" },
        Subtask:   { bg: "FFE2E8F0", fg: "FF475569" },
      };
      const statusFg: Record<string, string> = {
        COMPLETED:   "FF16A34A",
        IN_PROGRESS: "FF2563EB",
        NOT_STARTED: "FF94A3B8",
        ON_HOLD:     "FFF59E0B",
        DELAYED:     "FFDC2626",
      };

      sorted.forEach((task, idx) => {
        const type = taskType(task);
        const rowBg = idx % 2 === 0 ? "FFFFFFFF" : "FFF8FAFC";
        const row = ws.addRow([
          type,
          task.wbsNumber ?? "—",
          task.parentId ? `   └  ${task.title}` : task.title,
          TASK_STATUS_LABELS[task.status],
          PRIORITY_LABELS[task.priority],
          fmtDate(task.startDate),
          fmtDate(task.dueDate),
          assignees(task),
        ]);
        row.height = 18;
        row.eachCell((cell, col) => {
          cell.font = { size: 10, color: { argb: "FF1E293B" }, name: "Calibri" };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
          cell.alignment = { vertical: "middle", indent: 1 };
          cell.border = {
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            right:  { style: "thin", color: { argb: "FFE2E8F0" } },
          };
          if (col === 1) {
            const s = typeFill[type] ?? typeFill.Task;
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: s.bg } };
            cell.font = { size: 10, bold: true, color: { argb: s.fg }, name: "Calibri" };
            cell.alignment = { vertical: "middle", horizontal: "center" };
          }
          if (col === 4) {
            const fg = statusFg[task.status] ?? "FF1E293B";
            cell.font = { size: 10, bold: task.status === "COMPLETED", color: { argb: fg }, name: "Calibri" };
          }
          if (col === 3 && task.parentId) {
            cell.font = { size: 10, italic: true, color: { argb: "FF64748B" }, name: "Calibri" };
          }
        });
      });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName.replace(/[^a-z0-9]/gi, "_")}-gantt-report.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gantt Chart Report"
        description={loading ? "Loading tasks…" : `${sorted.length} task${sorted.length === 1 ? "" : "s"} · ${projectName}`}
      >
        {/* Project selector */}
        <select
          value={projectId}
          onChange={e => handleProjectChange(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Export button */}
        <Button
          variant="outline"
          size="sm"
          onClick={exportExcel}
          disabled={loading || exporting || sorted.length === 0}
          className="gap-1.5"
        >
          {exporting
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <FileSpreadsheet className="h-4 w-4 text-green-600" />}
          Export to Excel
        </Button>
      </PageHeader>

      {/* Table */}
      <div className="rounded-lg border bg-background overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex items-center justify-center py-24">
              <p className="text-sm text-muted-foreground">No tasks found for this project.</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-muted border-b">
                  {["Type", "WBS ID", "Title", "Status", "Priority", "Start Date", "Finish Date", "Assignee(s)"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap border-r border-border/50 last:border-r-0">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((task, i) => {
                  const type = taskType(task);
                  return (
                    <tr
                      key={task.id}
                      className={cn(
                        "border-b border-border/60 transition-colors hover:bg-muted/30",
                        i % 2 !== 0 && "bg-muted/10",
                      )}
                    >
                      <td className="px-3 py-1.5 border-r border-border/40 whitespace-nowrap">
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium",
                          type === "Milestone" && "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
                          type === "Subtask"   && "bg-muted text-muted-foreground",
                          type === "Task"      && "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
                        )}>
                          {type === "Milestone" ? "◆" : type === "Subtask" ? "└" : "■"} {type}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 border-r border-border/40 font-mono text-xs text-muted-foreground">
                        {task.wbsNumber ?? "—"}
                      </td>
                      <td className="px-3 py-1.5 border-r border-border/40 max-w-[380px]">
                        <span
                          className={cn("block truncate text-xs", task.parentId && "text-muted-foreground italic")}
                          style={{ paddingLeft: task.parentId ? "1.25rem" : undefined }}
                        >
                          {task.title}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 border-r border-border/40 whitespace-nowrap text-xs">
                        {TASK_STATUS_LABELS[task.status]}
                      </td>
                      <td className="px-3 py-1.5 border-r border-border/40 whitespace-nowrap text-xs">
                        {PRIORITY_LABELS[task.priority]}
                      </td>
                      <td className="px-3 py-1.5 border-r border-border/40 whitespace-nowrap text-xs">
                        {fmtDate(task.startDate)}
                      </td>
                      <td className="px-3 py-1.5 border-r border-border/40 whitespace-nowrap text-xs">
                        {fmtDate(task.dueDate)}
                      </td>
                      <td className="px-3 py-1.5 text-xs">{assignees(task)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
