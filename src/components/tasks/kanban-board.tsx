"use client";

import * as React from "react";
import { Plus, LayoutGrid, Tag, Users } from "lucide-react";
import type { TaskStatus, Priority } from "@prisma/client";
import type { TaskListItem } from "@/types/app";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from "@/lib/constants";
import { TaskCard } from "@/components/tasks/task-card";
import { cn } from "@/lib/utils";

type GroupBy = "status" | "priority" | "assignee";

const PRIORITY_ORDER: Priority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const GROUP_BY_OPTIONS: { value: GroupBy; label: string; icon: React.ReactNode }[] = [
  { value: "status",   label: "Status",    icon: <LayoutGrid className="h-3.5 w-3.5" /> },
  { value: "priority", label: "Priority",  icon: <Tag className="h-3.5 w-3.5" /> },
  { value: "assignee", label: "Assignees", icon: <Users className="h-3.5 w-3.5" /> },
];

const PROGRESS_OPTIONS = [
  { value: "all",    label: "All Progress" },
  { value: "0",      label: "Not started (0%)" },
  { value: "1-99",   label: "In progress (1–99%)" },
  { value: "100",    label: "Done (100%)" },
];

export function KanbanBoard({
  tasks,
  canDrag,
  canCreate,
  onOpenTask,
  onCreateInStatus,
  onMoveTask,
}: {
  tasks: TaskListItem[];
  canDrag: boolean;
  canCreate: boolean;
  onOpenTask: (task: TaskListItem) => void;
  onCreateInStatus: (status: TaskStatus) => void;
  onMoveTask: (taskId: string, status: TaskStatus) => void;
}) {
  const [groupBy,         setGroupBy]         = React.useState<GroupBy>("status");
  const [filterPriority,  setFilterPriority]  = React.useState<string>("all");
  const [filterProgress,  setFilterProgress]  = React.useState<string>("all");
  const [dragOver,        setDragOver]        = React.useState<string | null>(null);

  // Only top-level tasks appear on the board.
  const topLevel = tasks.filter(t => !t.parentId);

  // Apply filters
  const filtered = React.useMemo(() => {
    let result = topLevel;
    if (filterPriority !== "all")
      result = result.filter(t => t.priority === filterPriority);
    if (filterProgress === "0")
      result = result.filter(t => t.progress === 0);
    else if (filterProgress === "1-99")
      result = result.filter(t => t.progress > 0 && t.progress < 100);
    else if (filterProgress === "100")
      result = result.filter(t => t.progress === 100);
    return result;
  }, [topLevel, filterPriority, filterProgress]);

  // Build columns based on groupBy
  const columns = React.useMemo(() => {
    if (groupBy === "status") {
      return TASK_STATUS_ORDER.map(status => ({
        key: status,
        label: TASK_STATUS_LABELS[status],
        color: `hsl(var(--status-${status.toLowerCase().replace("_", "")}))`,
        tasks: filtered.filter(t => t.status === status),
      }));
    }
    if (groupBy === "priority") {
      return PRIORITY_ORDER.map(priority => ({
        key: priority,
        label: PRIORITY_LABELS[priority],
        color: PRIORITY_COLORS[priority],
        tasks: filtered.filter(t => t.priority === priority),
      }));
    }
    // assignee grouping
    const assigneeMap = new Map<string, { name: string; tasks: TaskListItem[] }>();
    assigneeMap.set("__unassigned__", { name: "Unassigned", tasks: [] });
    for (const task of filtered) {
      if (task.assignees.length === 0) {
        assigneeMap.get("__unassigned__")!.tasks.push(task);
      } else {
        for (const a of task.assignees) {
          if (!assigneeMap.has(a.user.id)) {
            assigneeMap.set(a.user.id, { name: a.user.name ?? "Unknown", tasks: [] });
          }
          assigneeMap.get(a.user.id)!.tasks.push(task);
        }
      }
    }
    return Array.from(assigneeMap.entries())
      .filter(([, v]) => v.tasks.length > 0 || assigneeMap.size === 1)
      .map(([key, v]) => ({
        key,
        label: v.name,
        color: "#94a3b8",
        tasks: v.tasks,
      }));
  }, [groupBy, filtered]);

  const isDragStatus = groupBy === "status";

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Group by toggle */}
        <div className="flex items-center rounded-md border bg-muted/30 p-0.5 gap-0.5">
          {GROUP_BY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setGroupBy(opt.value)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-all",
                groupBy === opt.value
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-border/60" />

        {/* Priority filter (hidden when grouping by priority) */}
        {groupBy !== "priority" && (
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className="h-7 rounded-md border bg-background px-2 text-[11px] text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Priorities</option>
            {PRIORITY_ORDER.map(p => (
              <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
            ))}
          </select>
        )}

        {/* Progress filter */}
        <select
          value={filterProgress}
          onChange={e => setFilterProgress(e.target.value)}
          className="h-7 rounded-md border bg-background px-2 text-[11px] text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {PROGRESS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {(filterPriority !== "all" || filterProgress !== "all") && (
          <button
            onClick={() => { setFilterPriority("all"); setFilterProgress("all"); }}
            className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Board columns */}
      <div className="flex gap-4 overflow-x-auto pb-4 thin-scroll">
        {columns.map(col => (
          <div
            key={col.key}
            onDragOver={e => { if (!isDragStatus || !canDrag) return; e.preventDefault(); setDragOver(col.key); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={e => {
              if (!isDragStatus || !canDrag) return;
              e.preventDefault();
              const taskId = e.dataTransfer.getData("text/task-id");
              if (taskId) onMoveTask(taskId, col.key as TaskStatus);
              setDragOver(null);
            }}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors",
              dragOver === col.key && "border-primary bg-primary/5",
            )}
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
                <span className="text-sm font-semibold">{col.label}</span>
                <span className="rounded-full bg-background px-1.5 text-xs text-muted-foreground">
                  {col.tasks.length}
                </span>
              </div>
              {canCreate && isDragStatus && (
                <button
                  onClick={() => onCreateInStatus(col.key as TaskStatus)}
                  className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                  aria-label="Add task"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 thin-scroll">
              {col.tasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  draggable={isDragStatus && canDrag}
                  onDragStart={e => e.dataTransfer.setData("text/task-id", task.id)}
                  onClick={() => onOpenTask(task)}
                />
              ))}
              {col.tasks.length === 0 && (
                <div className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">
                  No tasks
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
