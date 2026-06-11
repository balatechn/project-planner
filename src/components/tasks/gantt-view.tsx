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
import { CheckSquare, ChevronDown, ChevronRight, Loader2, Plus } from "lucide-react";
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
const ROW_HEIGHT = 30;
const LABEL_WIDTH = 240;
const MIN_ROWS = 15; // minimum ghost rows to always show grid

// Compute critical path: longest duration chain through dependencies
function computeCriticalPath(tasks: TaskListItem[]): Set<string> {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const es = new Map<string, number>();
  const ef = new Map<string, number>();

  function taskDur(t: TaskListItem) {
    if (!t.startDate || !t.dueDate) return 1;
    return Math.max(1, differenceInCalendarDays(new Date(t.dueDate), new Date(t.startDate)) + 1);
  }

  const sorted: TaskListItem[] = [];
  const visited = new Set<string>();
  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const t = byId.get(id);
    if (!t) return;
    for (const dep of (t.dependsOn ?? [])) visit(dep.prerequisiteId);
    sorted.push(t);
  }
  tasks.forEach((t) => visit(t.id));

  for (const t of sorted) {
    const prereqFinishes = (t.dependsOn ?? []).map((d) => ef.get(d.prerequisiteId) ?? 0);
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

// Stable reference — defined once at module load so useMemo deps stay clean
const today = new Date();

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
  const scheduled = tasks.filter((t) => t.startDate || t.dueDate);
  const criticalPath = React.useMemo(() => computeCriticalPath(tasks), [tasks]);

  const [addOpen, setAddOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<InlineForm>({
    title: "",
    priority: "MEDIUM",
    assigneeId: "__none__",
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

  // ── Subtask collapse state ────────────────────────────────────────────────
  const [collapsedParents, setCollapsedParents] = React.useState<Set<string>>(new Set());

  function toggleCollapse(taskId: string) {
    setCollapsedParents((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  // Build set of task IDs that have children in the scheduled list
  const parentIds = React.useMemo(
    () => new Set(scheduled.filter((t) => t.parentId).map((t) => t.parentId!)),
    [scheduled],
  );

  // Visible rows: hide subtasks whose parent is collapsed
  const visibleScheduled = React.useMemo(
    () =>
      scheduled.filter(
        (t) => !t.parentId || !collapsedParents.has(t.parentId),
      ),
    [scheduled, collapsedParents],
  );

  async function addTask() {
    if (!form.title.trim() || !projectId) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        projectId,
        title: form.title,
        priority: form.priority,
        isMilestone: form.isMilestone,
        assigneeIds: form.assigneeId && form.assigneeId !== "__none__" ? [form.assigneeId] : [],
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
      setForm({
        title: "",
        priority: "MEDIUM",
        assigneeId: "__none__",
        startDate: today.toISOString().split("T")[0],
        dueDate: addDays(today, 7).toISOString().split("T")[0],
        isMilestone: false,
      });
      onSaved?.();
    } catch {
      toast({ title: "Could not add task", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  // Ghost rows to always show grid lines even when few / no tasks
  const ghostCount = Math.max(0, MIN_ROWS - (visibleScheduled.length > 0 ? visibleScheduled.length : tasks.length > 0 ? tasks.length : 0));

  return (
    <div className="space-y-3 pt-1">
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
                  {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => (
                    <SelectItem key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</SelectItem>
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
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {allUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name ?? u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Start</label>
              <Input
                className="h-8 w-36"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Due</label>
              <Input
                className="h-8 w-36"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
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
            <Button
              variant="brand"
              size="sm"
              className="h-8"
              onClick={addTask}
              disabled={saving || !form.title.trim()}
            >
              {saving ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : "Save"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Gantt Chart ────────────────────────────────────────────────── */}
      <div
        className="overflow-x-auto rounded-lg border thin-scroll"
        style={{ minHeight: "calc(100vh - 290px)" }}
      >
        <div
          className="relative"
          style={{
            width: Math.max(totalDays * DAY_WIDTH + LABEL_WIDTH, 600),
            minWidth: "100%",
            minHeight: "inherit",
          }}
        >
          {/* ── Column header ─────────────────────────────────────── */}
          <div className="flex border-b bg-muted/50 sticky top-0 z-10 shadow-sm">
            <div
              className="shrink-0 border-r border-border/70 px-3 py-2 text-xs font-semibold bg-muted/50"
              style={{ width: LABEL_WIDTH }}
            >
              Task
            </div>
            <div className="flex" style={{ width: totalDays * DAY_WIDTH }}>
              {weeks.map((w, i) => (
                <div
                  key={w.toISOString()}
                  className={cn(
                    "px-2 py-1.5 text-xs font-medium text-muted-foreground border-r border-border/50",
                    i % 2 !== 0 ? "bg-muted/30" : "bg-muted/10",
                    isToday(w) && "text-primary font-semibold",
                  )}
                  style={{ width: DAY_WIDTH * 7 }}
                >
                  {format(w, "MMM d")}
                </div>
              ))}
            </div>
          </div>

          {/* ── Body ──────────────────────────────────────────────── */}
          <div className="relative">

            {/* Full-height background column grid (rendered once, spans all rows) */}
            <div
              className="absolute inset-0 pointer-events-none overflow-hidden"
              style={{ left: LABEL_WIDTH }}
            >
              {weeks.map((w, i) => (
                <React.Fragment key={w.toISOString()}>
                  {/* Alternating column shading */}
                  <div
                    className={cn(
                      "absolute top-0 bottom-0",
                      i % 2 !== 0 ? "bg-muted/15" : "bg-transparent",
                    )}
                    style={{ left: i * DAY_WIDTH * 7, width: DAY_WIDTH * 7 }}
                  />
                  {/* Column right border */}
                  <div
                    className="absolute top-0 bottom-0 w-px bg-border/50"
                    style={{ left: (i + 1) * DAY_WIDTH * 7 }}
                  />
                </React.Fragment>
              ))}
            </div>

            {/* Today marker line */}
            {todayOffset >= 0 && todayOffset <= totalDays && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-primary/70 z-20 pointer-events-none"
                style={{ left: LABEL_WIDTH + todayOffset * DAY_WIDTH }}
              />
            )}

            {/* ── Rows ─────────────────────────────────────────────── */}

            {/* CASE 1: No tasks at all */}
            {tasks.length === 0 && (
              <div className="relative">
                {Array.from({ length: MIN_ROWS }).map((_, i) => (
                  <div
                    key={i}
                    className="flex border-b border-border/40"
                    style={{ height: ROW_HEIGHT }}
                  >
                    <div
                      className="shrink-0 border-r border-border/60"
                      style={{ width: LABEL_WIDTH }}
                    />
                  </div>
                ))}
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  style={{ left: LABEL_WIDTH }}
                >
                  <p className="rounded-md border bg-card/90 px-4 py-2 text-sm text-muted-foreground shadow-sm">
                    No tasks yet — click &ldquo;Add Task&rdquo; to see the timeline.
                  </p>
                </div>
              </div>
            )}

            {/* CASE 2: Tasks exist but none have dates */}
            {tasks.length > 0 && scheduled.length === 0 && (
              <div className="relative">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex border-b border-border/40 hover:bg-muted/20 transition-colors"
                    style={{ height: ROW_HEIGHT }}
                  >
                    <button
                      onClick={() => onOpenTask(task)}
                      className="shrink-0 border-r border-border/60 px-3 text-left text-xs hover:text-primary transition-colors overflow-hidden flex items-center"
                      style={{ width: LABEL_WIDTH, height: ROW_HEIGHT }}
                    >
                      <span className="truncate">{task.title}</span>
                    </button>
                    <div style={{ flex: 1, height: ROW_HEIGHT }} />
                  </div>
                ))}
                {Array.from({ length: ghostCount }).map((_, i) => (
                  <div
                    key={`gh-${i}`}
                    className="flex border-b border-border/30"
                    style={{ height: ROW_HEIGHT }}
                  >
                    <div className="shrink-0 border-r border-border/60" style={{ width: LABEL_WIDTH }} />
                  </div>
                ))}
                <div
                  className="absolute flex items-center justify-center pointer-events-none"
                  style={{ top: 0, bottom: 0, left: LABEL_WIDTH, right: 0 }}
                >
                  <p className="rounded-md border bg-card/90 px-4 py-2 text-sm text-muted-foreground shadow-sm">
                    Add start / due dates to see tasks on the timeline.
                  </p>
                </div>
              </div>
            )}

            {/* CASE 3: Tasks with dates — render bars */}
            {scheduled.length > 0 && (
              <>
                {visibleScheduled.map((task) => {
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
                      className="flex items-center border-b border-border/40 hover:bg-muted/25 transition-colors"
                      style={{ height: ROW_HEIGHT }}
                    >
                      {/* Label column */}
                      <div
                        className="shrink-0 border-r border-border/60 flex items-center overflow-hidden"
                        style={{ width: LABEL_WIDTH, height: ROW_HEIGHT }}
                      >
                        {/* Collapse toggle for parent tasks */}
                        {parentIds.has(task.id) ? (
                          <button
                            onClick={() => toggleCollapse(task.id)}
                            className="flex-shrink-0 ml-1 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title={collapsedParents.has(task.id) ? "Expand subtasks" : "Collapse subtasks"}
                          >
                            {collapsedParents.has(task.id) ? (
                              <ChevronRight className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </button>
                        ) : (
                          <span className="flex-shrink-0 w-5" />
                        )}

                        <button
                          onClick={() => onOpenTask(task)}
                          className={cn(
                            "flex-1 px-1.5 text-left text-xs hover:text-primary transition-colors overflow-hidden h-full flex items-center gap-1",
                            task.parentId && "pl-3 text-muted-foreground",
                          )}
                        >
                          {task.parentId && (
                            <span className="flex-shrink-0 text-border text-[10px]">└</span>
                          )}
                          {task.isMilestone && (
                            <span className="text-amber-500 flex-shrink-0">◆</span>
                          )}
                          {task.wbsNumber && (
                            <span className="text-[10px] text-muted-foreground flex-shrink-0 font-mono">
                              {task.wbsNumber}
                            </span>
                          )}
                          <span className="truncate">{task.title}</span>
                          {/* Subtask count badge */}
                          {task._count.subtasks > 0 && (
                            <span
                              className="flex-shrink-0 rounded-full bg-muted px-1 text-[9px] font-medium text-muted-foreground"
                              title={`${task._count.subtasks} subtask${task._count.subtasks !== 1 ? "s" : ""}`}
                            >
                              ⊞{task._count.subtasks}
                            </span>
                          )}
                          {/* Checklist badge */}
                          {task._count.checklistItems > 0 && (
                            <span
                              className="flex-shrink-0 flex items-center gap-0.5 text-[9px] text-muted-foreground"
                              title={`${task._count.checklistItems} checklist items`}
                            >
                              <CheckSquare className="h-2.5 w-2.5" />
                              {task._count.checklistItems}
                            </span>
                          )}
                          {isCritical && (
                            <span
                              className="ml-auto flex-shrink-0 h-2 w-2 rounded-full bg-red-500"
                              title="Critical path"
                            />
                          )}
                        </button>
                      </div>

                      {/* Timeline column */}
                      <div
                        className="relative"
                        style={{ width: totalDays * DAY_WIDTH, height: ROW_HEIGHT }}
                      >
                        {/* Baseline bar */}
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

                        {task.isMilestone ? (
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
                            {/* Task bar */}
                            <div
                              onClick={() => onOpenTask(task)}
                              className="absolute top-1/2 -translate-y-1/2 cursor-pointer rounded-sm flex items-center overflow-hidden"
                              style={{
                                left: offset * DAY_WIDTH,
                                width: span * DAY_WIDTH,
                                height: 16,
                                backgroundColor: barColor,
                              }}
                              title={`${task.title} · ${span} day(s)${isCritical ? " · Critical path" : ""}`}
                            >
                              {/* Progress fill */}
                              <div
                                className="absolute inset-y-0 left-0 bg-black/20 rounded-l-sm"
                                style={{ width: `${task.progress}%` }}
                              />
                              {span * DAY_WIDTH > 44 && (
                                <span className="relative px-1.5 text-[9px] font-medium text-white truncate">
                                  {task.progress}%
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Ghost rows to fill remaining grid space */}
                {Array.from({ length: ghostCount }).map((_, i) => (
                  <div
                    key={`gh-${i}`}
                    className="flex border-b border-border/30"
                    style={{ height: ROW_HEIGHT }}
                  >
                    <div className="shrink-0 border-r border-border/60" style={{ width: LABEL_WIDTH }} />
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-6 bg-primary/70" />
          <span>Today</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-red-500" />
          <span>Critical path</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M6 1L11 6L6 11L1 6Z" fill="#f59e0b" />
          </svg>
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
