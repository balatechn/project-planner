"use client";

import * as React from "react";
import { format } from "date-fns";
import { FileSpreadsheet, Loader2, X, BarChart3, ChevronDown } from "lucide-react";
import type { TaskListItem } from "@/types/app";
import { TASK_STATUS_LABELS, PRIORITY_LABELS } from "@/lib/constants";
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

export function GanttReportModal({
  projects,
}: {
  projects: { id: string; name: string }[];
}) {
  const [open,      setOpen]      = React.useState(false);
  const [projectId, setProjectId] = React.useState(projects[0]?.id ?? "");
  const [tasks,     setTasks]     = React.useState<TaskListItem[]>([]);
  const [loading,   setLoading]   = React.useState(false);
  const [menuOpen,  setMenuOpen]  = React.useState(false);

  const projectName = projects.find(p => p.id === projectId)?.name ?? "Report";

  React.useEffect(() => {
    if (!open || !projectId) return;
    setLoading(true);
    fetch(`/api/tasks?projectId=${projectId}`)
      .then(r => r.json())
      .then(d => setTasks(d.tasks ?? []))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [open, projectId]);

  const sorted = React.useMemo(() => treeSort(tasks), [tasks]);

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const rows = sorted.map(t => ({
      "Type":        taskType(t),
      "WBS ID":      t.wbsNumber ?? "—",
      "Title":       t.title,
      "Status":      TASK_STATUS_LABELS[t.status],
      "Priority":    PRIORITY_LABELS[t.priority],
      "Start Date":  fmtDate(t.startDate),
      "Finish Date": fmtDate(t.dueDate),
      "Assignee(s)": assignees(t),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 12 }, { wch: 10 }, { wch: 50 }, { wch: 16 },
      { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 35 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Gantt Report");
    XLSX.writeFile(wb, `${projectName.replace(/[^a-z0-9]/gi, "_")}-gantt-report.xlsx`);
  }

  function openReport() {
    setMenuOpen(false);
    setOpen(true);
  }

  return (
    <>
      {/* Reports dropdown trigger */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="flex items-center gap-1.5 h-9 px-3 rounded-md border bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Reports
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-40 min-w-[180px] rounded-md border bg-popover shadow-md py-1">
              <button
                onClick={openReport}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                Gantt Chart Report
              </button>
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative flex flex-col w-full max-w-6xl max-h-[90vh] rounded-xl bg-background shadow-xl border">

            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between gap-4 border-b px-6 py-4">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-base font-semibold">Gantt Chart Report</h2>
                <select
                  value={projectId}
                  onChange={e => setProjectId(e.target.value)}
                  className="h-8 rounded-md border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {!loading && (
                  <span className="text-xs text-muted-foreground">{sorted.length} tasks</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={exportExcel}
                  disabled={loading || sorted.length === 0}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-md border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  Export Excel
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto">
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
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-muted/80 backdrop-blur">
                      {["Type", "WBS ID", "Title", "Status", "Priority", "Start Date", "Finish Date", "Assignee(s)"].map(h => (
                        <th key={h} className="border border-border px-3 py-2 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
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
                            task.parentId && "text-muted-foreground",
                          )}
                        >
                          <td className="border border-border/40 px-3 py-1.5 whitespace-nowrap">
                            <span className={cn(
                              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium",
                              type === "Milestone" && "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
                              type === "Subtask"   && "bg-muted text-muted-foreground",
                              type === "Task"      && "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
                            )}>
                              {type === "Milestone" ? "◆" : type === "Subtask" ? "└" : "■"} {type}
                            </span>
                          </td>
                          <td className="border border-border/40 px-3 py-1.5 font-mono text-xs">{task.wbsNumber ?? "—"}</td>
                          <td className="border border-border/40 px-3 py-1.5 max-w-[320px]">
                            <span style={{ paddingLeft: task.parentId ? "1.25rem" : undefined }} className="block truncate text-xs">
                              {task.title}
                            </span>
                          </td>
                          <td className="border border-border/40 px-3 py-1.5 whitespace-nowrap text-xs">{TASK_STATUS_LABELS[task.status]}</td>
                          <td className="border border-border/40 px-3 py-1.5 whitespace-nowrap text-xs">{PRIORITY_LABELS[task.priority]}</td>
                          <td className="border border-border/40 px-3 py-1.5 whitespace-nowrap text-xs">{fmtDate(task.startDate)}</td>
                          <td className="border border-border/40 px-3 py-1.5 whitespace-nowrap text-xs">{fmtDate(task.dueDate)}</td>
                          <td className="border border-border/40 px-3 py-1.5 text-xs">{assignees(task)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
