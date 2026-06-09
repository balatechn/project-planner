"use client";

import * as React from "react";
import {
  addDays,
  differenceInCalendarDays,
  eachWeekOfInterval,
  format,
  isToday,
  max as maxDate,
  min as minDate,
} from "date-fns";
import { Loader2, Plus } from "lucide-react";
import type { TaskListItem, Person } from "@/types/app";
import { TASK_STATUS_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DAY_WIDTH = 28;
const ROW_HEIGHT = 38;
const LABEL_WIDTH = 240;

// Compute critical path: tasks where removing them would extend total project duration
function computeCriticalPath(tasks: TaskListItem[]): Set<string> {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  // Simple: tasks without any dependedOnBy are leaf tasks; tasks with longest chain from root
  // For a basic implementation, mark tasks that form the longest duration chain
  // We'll use earliest/latest start/finish
  const es = new Map<string, number>(); // earliest start (days offset)
  const ef = new Map<string, number>(); // earliest finish

  function taskDur(t: TaskListItem) {
    if (!t.startDate || !t.dueDate) return 1;
    return Math.max(1, differenceInCalendarDays(new Date(t.dueDate), new Date(t.startDate)) + 1);
  }

  // Sort topologically
  const sorted: TaskListItem[] = [];
  const visited = new Set<string>();
  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const t = byId.get(id);
    if (!t) return;
    for (const dep of t.dependsOn) visit(dep.prerequisiteId);
    sorted.push(t);
  }
  tasks.forEach((t) => visit(t.id));

  for (const t of sorted) {
    const prereqFinishes = t.dependsOn.map((d) => ef.get(d.prerequisiteId) ?? 0);
    const start = prereqFinishes.length > 0 ? Math.max(...prereqFinishes) : 0;
    es.set(t.id, start);
    ef.set(t.id, start + taskDur(t));
  }

  const maxEF = Math.max(0, ...Array.from(ef.values()));
  const critical = new Set<string>();
  for (const [id, finish] of ef) {
    if (finish === maxEF) critical.add(id);
  }
  return critical;
}

type InlineForm = {
  title: string;
  priority: string;
  assigneeId: string;
  startDate: string;
  dueDate: string;
  isMilestone: boolean;
};

export function GanttView({
  tasks,
  onOpenTask,
  canCreate,
  projectId,
  allUsers = [],
  onSaved,
}: {
  tasks: TaskListItem[];
  onOpenTask: (task: TaskListItem) => void;
  canCreate?: boolean;
  projectId?: string;
  allUsers?: Person[];
  onSaved?: () => void;
}) {
  const { toast } = useToast();
  const today = new Date();
  const scheduled = tasks.filter((t) => t.startDate || t.dueDate);
  const criticalPath = React.useMemo(() => computeCriticalPath(tasks), [tasks]);

  const [addOpen, setAddOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<InlineForm>({
    title: "",
    priority: "MEDIUM",
    assigneeId: "",
    startDate: today.toISOString().split("T")[0],
    dueDate: addDays(today, 7).toISOString().split("T")[0],
    isMilestone: false,
  });

  const { start, end, totalDays } = React.useMemo(() => {
    if (scheduled.length === 0) {
      return { start: addDays(today, -7), end: addDays(today, 30), totalDays: 38 };
    }
    const dates: Date[] = [];
    for (const t of scheduled) {
      if (t.startDate) dates.push(new Date(t.startDate));
      if (t.dueDate) dates.push(new Date(t.dueDate));
    }
    const s = addDays(minDate(dates), -7);
    const e = addDays(maxDate(dates), 14);
    return { start: s, end: e, totalDays: differenceInCalendarDays(e, s) + 1 };
  }, [scheduled]);

  const weeks = eachWeekOfInterval({ start, end });
  const todayOffset = differenceInCalendarDays(today, start);

  async function addTask() {
    if (!form.title.trim() || !projectId) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        projectId,
        title: form.title,
        priority: form.priority,
        isMilestone: form.isMilestone,
        assigneeIds: form.assigneeId ? [form.assigneeId] : [],
        startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
      };
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Task added", variant: "success" });
      setAddOpen(false);
      setForm({ title: "", priority: "MEDIUM", assigneeId: "", startDate: today.toISOString().split("T")[0], dueDate: addDays(today, 7).toISOString().split("T")[0], isMilestone: false });
      onSaved?.();
    } catch {
      toast({ title: "Could not add task", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 pt-2">
      {/* Toolbar */}
      {canCreate && projectId && (
        <div className="flex items-center gap-2">
          <Button
            variant="brand"
            size="sm"
            onClick={() => setAddOpen((v) => !v)}
          >
            <Plus className="h-4 w-4" />
            {addOpen ? "Cancel" : "Add Task"}
          </Button>
        </div>
      )}

      {/* Inline Add Form */}
      {addOpen && (
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Title *</label>
              <Input
                className="h-8 w-48"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Task name"
                onKeyDown={(e) => { if (e.key === "Enter") addTask(); }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Priority</label>
              <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                <SelectTrigger className="h-8 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["LOW","MEDIUM","HIGH","CRITICAL"].map((p) => (
                    <SelectItem key={p} value={p}>{p.charAt(0)+p.slice(1).toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {allUsers.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Assign to</label>
                <Select value={form.assigneeId} onValueChange={(v) => setForm((f) => ({ ...f, assigneeId: v }))}>
                  <SelectTrigger className="h-8 w-36">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {allUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name ?? u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Start</label>
              <Input className="h-8 w-36" type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Due</label>
              <Input className="h-8 w-36" type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="checkbox"
                id="milestone-check"
                checked={form.isMilestone}
                onChange={(e) => setForm((f) => ({ ...f, isMilestone: e.target.checked }))}
                className="h-4 w-4"
              />
              <label htmlFor="milestone-check" className="text-xs">Milestone</label>
            </div>
            <Button variant="brand" size="sm" className="h-8" onClick={addTask} disabled={saving || !form.title.trim()}>
              {saving ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : "Save"}
            </Button>
          </div>
        </div>
      )}

      {/* Gantt chart */}
      <div className="overflow-x-auto rounded-lg border thin-scroll">
        <div style={{ width: Math.max(totalDays * DAY_WIDTH + LABEL_WIDTH, 600), minWidth: "100%" }}>
          {/* Header */}
          <div className="flex border-b bg-muted/40 sticky top-0 z-10">
            <div className="shrink-0 border-r px-3 py-2 text-xs font-semibold" style={{ width: LABEL_WIDTH }}>
              Task
            </div>
            <div className="relative" style={{ width: totalDays * DAY_WIDTH }}>
              <div className="flex">
                {weeks.map((w) => (
                  <div
                    key={w.toISOString()}
                    className="border-r px-2 py-2 text-xs text-muted-foreground"
                    style={{ width: DAY_WIDTH * 7 }}
                  >
                    {format(w, "MMM d")}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Today vertical line + rows */}
          <div className="relative">
            {/* Today marker */}
            {todayOffset >= 0 && todayOffset <= totalDays && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-primary/60 z-20 pointer-events-none"
                style={{ left: LABEL_WIDTH + todayOffset * DAY_WIDTH }}
              />
            )}

            {tasks.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No tasks yet — add a task to see the timeline.
              </p>
            ) : scheduled.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Add start and due dates to tasks to see them on the timeline.
              </p>
            ) : (
              scheduled.map((task) => {
                const s = task.startDate ? new Date(task.startDate) : new Date(task.dueDate!);
                const e = task.dueDate ? new Date(task.dueDate) : addDays(new Date(task.startDate!), 1);
                const offset = Math.max(0, differenceInCalendarDays(s, start));
                const span = Math.max(1, differenceInCalendarDays(e, s) + 1);
                const isCritical = criticalPath.has(task.id);
                const statusColor = `hsl(${TASK_STATUS_COLORS[task.status]})`;
                const barColor = isCritical ? "#ef4444" : statusColor;

                return (
                  <div
                    key={task.id}
                    className="flex items-center border-b last:border-0 hover:bg-muted/20 transition-colors"
                    style={{ height: ROW_HEIGHT }}
                  >
                    {/* Label column */}
                    <button
                      onClick={() => onOpenTask(task)}
                      className="shrink-0 border-r px-3 text-left text-sm hover:text-primary transition-colors overflow-hidden"
                      style={{ width: LABEL_WIDTH, height: ROW_HEIGHT }}
                    >
                      <div className="flex items-center gap-1.5 h-full">
                        {task.isMilestone && (
                          <span className="text-amber-500 flex-shrink-0">◆</span>
                        )}
                        {task.wbsNumber && (
                          <span className="text-xs text-muted-foreground flex-shrink-0 font-mono">
                            {task.wbsNumber}
                          </span>
                        )}
                        <span className="truncate">{task.title}</span>
                        {isCritical && (
                          <span className="ml-auto flex-shrink-0 h-2 w-2 rounded-full bg-red-500" title="Critical path" />
                        )}
                      </div>
                    </button>

                    {/* Timeline column */}
                    <div
                      className="relative"
                      style={{ width: totalDays * DAY_WIDTH, height: ROW_HEIGHT }}
                    >
                      {/* Week grid lines */}
                      {weeks.map((w, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 w-px bg-border/40"
                          style={{ left: i * DAY_WIDTH * 7 }}
                        />
                      ))}

                      {task.isMilestone ? (
                        // Milestone diamond
                        <div
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer"
                          style={{ left: (offset + span / 2) * DAY_WIDTH }}
                          onClick={() => onOpenTask(task)}
                          title={task.title}
                        >
                          <svg width="18" height="18" viewBox="0 0 18 18">
                            <path
                              d="M9 1 L17 9 L9 17 L1 9 Z"
                              fill={barColor}
                              stroke="white"
                              strokeWidth="1.5"
                            />
                          </svg>
                        </div>
                      ) : (
                        <>
                          {/* Baseline bar (dashed, if available) */}
                          {task.baselineStart && task.baselineEnd && (() => {
                            const bs = differenceInCalendarDays(new Date(task.baselineStart), start);
                            const be = differenceInCalendarDays(new Date(task.baselineEnd), start);
                            const bw = Math.max(1, be - bs + 1);
                            return (
                              <div
                                className="absolute rounded-sm opacity-30 border-2 border-dashed"
                                style={{
                                  left: Math.max(0, bs) * DAY_WIDTH,
                                  width: bw * DAY_WIDTH,
                                  height: 10,
                                  top: "50%",
                                  marginTop: 8,
                                  borderColor: barColor,
                                }}
                                title="Baseline"
                              />
                            );
                          })()}

                          {/* Task bar */}
                          <div
                            onClick={() => onOpenTask(task)}
                            className="absolute top-1/2 -translate-y-1/2 cursor-pointer rounded-sm flex items-center overflow-hidden group"
                            style={{
                              left: offset * DAY_WIDTH,
                              width: span * DAY_WIDTH,
                              height: 22,
                              backgroundColor: barColor,
                            }}
                            title={`${task.title} · ${span} day(s)${isCritical ? " · Critical path" : ""}`}
                          >
                            {/* Progress fill */}
                            <div
                              className="absolute inset-y-0 left-0 bg-black/20 rounded-l-sm"
                              style={{ width: `${task.progress}%` }}
                            />
                            {span * DAY_WIDTH > 40 && (
                              <span className="relative px-1.5 text-[10px] font-medium text-white truncate">
                                {task.progress}%
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-6 bg-primary/60" />
          <span>Today</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-red-500" />
          <span>Critical path</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1L11 6L6 11L1 6Z" fill="#f59e0b"/></svg>
          <span>Milestone</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-6 border-2 border-dashed border-muted-foreground opacity-50 rounded-sm" />
          <span>Baseline</span>
        </div>
      </div>
    </div>
  );
}
