"use client";

import * as React from "react";
import {
  addDays,
  differenceInCalendarDays,
  eachWeekOfInterval,
  format,
  getISOWeek,
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

// ── Layout constants ──────────────────────────────────────────────────────────
const DAY_WIDTH   = 24;
const ROW_HEIGHT  = 24;
const WEEK_ROW_H  = 20;
const DAY_ROW_H   = 14;
const HEADER_H    = WEEK_ROW_H + DAY_ROW_H; // 34

const ROW_NUM_W   = 28;
const TASK_NAME_W = 180;
const DURATION_W  = 60;
const START_W     = 72;
const FINISH_W    = 72;
const ASSIGNED_W  = 100;
const LEFT_CONTENT_W = ROW_NUM_W + TASK_NAME_W + DURATION_W + START_W + FINISH_W + ASSIGNED_W; // 512

const LEFT_DEFAULT = 512;
const LEFT_MIN     = 120;
const LEFT_MAX     = 820;
const HANDLE_W     = 5;
const MIN_ROWS     = 20;

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d: string | null | undefined) {
  return d ? format(new Date(d), "dd MMM yy") : "—";
}

function taskDur(s: string | null | undefined, e: string | null | undefined) {
  if (!s && !e) return "—";
  if (!s || !e) return "1 d";
  return `${Math.max(1, differenceInCalendarDays(new Date(e), new Date(s)) + 1)} d`;
}

function computeCriticalPath(tasks: TaskListItem[]): Set<string> {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const ef   = new Map<string, number>();

  function dur(t: TaskListItem) {
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
    const prereqs = (t.dependsOn ?? []).map((d) => ef.get(d.prerequisiteId) ?? 0);
    const es = prereqs.length > 0 ? Math.max(...prereqs) : 0;
    ef.set(t.id, es + dur(t));
  }

  const maxEF = Math.max(0, ...Array.from(ef.values()));
  const critical = new Set<string>();
  for (const [id, finish] of ef) if (finish === maxEF) critical.add(id);
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

const today = new Date();

// ── Component ─────────────────────────────────────────────────────────────────
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

  // ── Scroll sync ───────────────────────────────────────────────────────────
  const leftRef  = React.useRef<HTMLDivElement>(null);
  const rightRef = React.useRef<HTMLDivElement>(null);
  const syncing  = React.useRef(false);

  const onLeftScroll = React.useCallback(() => {
    if (syncing.current) return;
    syncing.current = true;
    if (rightRef.current && leftRef.current)
      rightRef.current.scrollTop = leftRef.current.scrollTop;
    syncing.current = false;
  }, []);

  const onRightScroll = React.useCallback(() => {
    if (syncing.current) return;
    syncing.current = true;
    if (leftRef.current && rightRef.current)
      leftRef.current.scrollTop = rightRef.current.scrollTop;
    syncing.current = false;
  }, []);

  // ── Panel resize ─────────────────────────────────────────────────────────
  const [leftWidth, setLeftWidth] = React.useState(LEFT_DEFAULT);
  const savedWidth = React.useRef(LEFT_DEFAULT);
  const isCollapsed = leftWidth < LEFT_MIN / 2;

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = leftWidth;
    const move = (ev: MouseEvent) =>
      setLeftWidth(Math.max(LEFT_MIN, Math.min(LEFT_MAX, w0 + ev.clientX - x0)));
    const up = () => {
      document.body.style.cursor      = "";
      document.body.style.userSelect  = "";
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup",   up);
    };
    document.body.style.cursor     = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup",   up);
  }

  function toggleCollapse() {
    if (!isCollapsed) {
      savedWidth.current = leftWidth;
      setLeftWidth(0);
    } else {
      setLeftWidth(savedWidth.current || LEFT_DEFAULT);
    }
  }

  // ── Data ─────────────────────────────────────────────────────────────────
  const scheduled    = tasks.filter((t) => t.startDate || t.dueDate);
  const criticalPath = React.useMemo(() => computeCriticalPath(tasks), [tasks]);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);

  const [addOpen, setAddOpen] = React.useState(false);
  const [saving,  setSaving ] = React.useState(false);
  const [form, setForm] = React.useState<InlineForm>({
    title:       "",
    priority:    "MEDIUM",
    assigneeId:  "__none__",
    startDate:   today.toISOString().split("T")[0],
    dueDate:     addDays(today, 7).toISOString().split("T")[0],
    isMilestone: false,
  });

  const { rangeStart, totalDays } = React.useMemo(() => {
    if (scheduled.length === 0)
      return { rangeStart: addDays(today, -7), totalDays: 38 };
    const dates: Date[] = [];
    for (const t of scheduled) {
      if (t.startDate) dates.push(new Date(t.startDate));
      if (t.dueDate)   dates.push(new Date(t.dueDate));
    }
    const s = addDays(minDate(dates), -7);
    const e = addDays(maxDate(dates), 14);
    return { rangeStart: s, totalDays: differenceInCalendarDays(e, s) + 1 };
  }, [scheduled]);

  const weeks   = React.useMemo(() => eachWeekOfInterval({ start: rangeStart, end: addDays(rangeStart, totalDays - 1) }), [rangeStart, totalDays]);
  const allDays = React.useMemo(() => Array.from({ length: totalDays }, (_, i) => addDays(rangeStart, i)), [rangeStart, totalDays]);
  const todayOffset = differenceInCalendarDays(today, rangeStart);
  const timelineW   = totalDays * DAY_WIDTH;

  // Month spans for the top header tier
  const months = React.useMemo(() => {
    if (!allDays.length) return [] as { label: string; dayCount: number }[];
    const result: { label: string; dayCount: number }[] = [];
    let cur = { label: format(allDays[0], "MMMM, yyyy"), dayCount: 0, m: allDays[0].getMonth(), y: allDays[0].getFullYear() };
    for (const d of allDays) {
      if (d.getMonth() !== cur.m || d.getFullYear() !== cur.y) {
        result.push({ label: cur.label, dayCount: cur.dayCount });
        cur = { label: format(d, "MMMM, yyyy"), dayCount: 1, m: d.getMonth(), y: d.getFullYear() };
      } else {
        cur.dayCount++;
      }
    }
    result.push({ label: cur.label, dayCount: cur.dayCount });
    return result;
  }, [allDays]);

  const [collapsedParents, setCollapsedParents] = React.useState<Set<string>>(new Set());
  function toggleRow(taskId: string) {
    setCollapsedParents((prev) => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  }

  const parentIds = React.useMemo(
    () => new Set(scheduled.filter((t) => t.parentId).map((t) => t.parentId!)),
    [scheduled],
  );
  const visibleScheduled = React.useMemo(
    () => scheduled.filter((t) => !t.parentId || !collapsedParents.has(t.parentId)),
    [scheduled, collapsedParents],
  );

  async function addTask() {
    if (!form.title.trim() || !projectId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title:       form.title,
          priority:    form.priority,
          isMilestone: form.isMilestone,
          assigneeIds: form.assigneeId !== "__none__" ? [form.assigneeId] : [],
          startDate:   form.startDate ? new Date(form.startDate).toISOString() : null,
          dueDate:     form.dueDate   ? new Date(form.dueDate).toISOString()   : null,
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Task added", variant: "success" });
      setAddOpen(false);
      setForm({ title: "", priority: "MEDIUM", assigneeId: "__none__", startDate: today.toISOString().split("T")[0], dueDate: addDays(today, 7).toISOString().split("T")[0], isMilestone: false });
      onSaved?.();
    } catch {
      toast({ title: "Could not add task", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  const rowCount  = scheduled.length > 0 ? visibleScheduled.length : tasks.length;
  const ghostCount = Math.max(0, MIN_ROWS - rowCount);

  // Row hover helper
  const hoverProps = (id: string) => ({
    onMouseEnter: () => setHoveredId(id),
    onMouseLeave: () => setHoveredId(null),
  });

  // Alternating row stripe (odd rows get subtle background)
  const rowStripe = (idx: number) => idx % 2 !== 0 ? "bg-muted/[0.07]" : "";

  // Ghost row cells for left panel
  const LeftGhostRow = ({ idx }: { idx: number }) => (
    <div className={cn("flex border-b border-border/30", rowStripe(idx))} style={{ height: ROW_HEIGHT, minWidth: LEFT_CONTENT_W }}>
      <div style={{ width: ROW_NUM_W  }} className="shrink-0 border-r border-border/40" />
      <div style={{ width: TASK_NAME_W}} className="shrink-0 border-r border-border/40" />
      <div style={{ width: DURATION_W }} className="shrink-0 border-r border-border/40" />
      <div style={{ width: START_W    }} className="shrink-0 border-r border-border/40" />
      <div style={{ width: FINISH_W   }} className="shrink-0 border-r border-border/40" />
      <div style={{ width: ASSIGNED_W }} className="shrink-0" />
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-2 pt-0.5">

      {/* Toolbar */}
      {canCreate && projectId && (
        <div className="flex items-center gap-2">
          <Button variant="brand" size="sm" className="h-7 px-2.5 text-xs" onClick={() => setAddOpen((v) => !v)}>
            <Plus className="h-3.5 w-3.5" />
            {addOpen ? "Cancel" : "Add Task"}
          </Button>
        </div>
      )}

      {/* Inline Add Form */}
      {addOpen && (
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Title *</label>
              <Input className="h-8 w-48" value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Task name"
                onKeyDown={(e) => e.key === "Enter" && addTask()} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Priority</label>
              <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
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
                  <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {allUsers.map((u) => <SelectItem key={u.id} value={u.id}>{u.name ?? u.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Start</label>
              <Input className="h-8 w-36" type="date" value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Due</label>
              <Input className="h-8 w-36" type="date" value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </div>
            <div className="flex items-center gap-1.5">
              <input type="checkbox" id="ms-check" checked={form.isMilestone}
                onChange={(e) => setForm((f) => ({ ...f, isMilestone: e.target.checked }))}
                className="h-4 w-4" />
              <label htmlFor="ms-check" className="text-xs">Milestone</label>
            </div>
            <Button variant="brand" size="sm" className="h-8" onClick={addTask} disabled={saving || !form.title.trim()}>
              {saving ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : "Save"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Split-pane Gantt ──────────────────────────────────────────────── */}
      <div
        className="flex rounded-lg border overflow-hidden"
        style={{ height: "calc(100vh - 248px)" }}
      >

        {/* ── Left panel ─────────────────────────────────────────────────── */}
        <div
          ref={leftRef}
          className="flex-shrink-0 overflow-y-auto overflow-x-hidden border-r border-border/60"
          style={{ width: leftWidth, transition: "none" }}
          onScroll={onLeftScroll}
        >
          {/* Left header */}
          <div
            className="sticky top-0 z-10 flex border-b bg-muted/50 shadow-sm"
            style={{ height: HEADER_H, minWidth: LEFT_CONTENT_W }}
          >
            <div style={{ width: ROW_NUM_W }} className="shrink-0 border-r border-border/70 flex items-center justify-center text-xs font-semibold text-muted-foreground">#</div>
            <div style={{ width: TASK_NAME_W }} className="shrink-0 border-r border-border/70 flex items-center px-3 text-xs font-semibold">Task Name</div>
            <div style={{ width: DURATION_W }} className="shrink-0 border-r border-border/70 flex items-center px-2 text-xs font-semibold text-muted-foreground">Duration</div>
            <div style={{ width: START_W }} className="shrink-0 border-r border-border/70 flex items-center px-2 text-xs font-semibold text-muted-foreground">Start</div>
            <div style={{ width: FINISH_W }} className="shrink-0 border-r border-border/70 flex items-center px-2 text-xs font-semibold text-muted-foreground">Finish</div>
            <div style={{ width: ASSIGNED_W }} className="shrink-0 flex items-center px-2 text-xs font-semibold text-muted-foreground">Assigned</div>
          </div>

          {/* Left rows */}
          <div style={{ minWidth: LEFT_CONTENT_W }}>

            {/* CASE 1: no tasks */}
            {tasks.length === 0 && Array.from({ length: MIN_ROWS }).map((_, i) => <LeftGhostRow key={i} idx={i} />)}

            {/* CASE 2: tasks without dates */}
            {tasks.length > 0 && scheduled.length === 0 && (
              <>
                {tasks.map((task, i) => (
                  <div key={task.id}
                    className={cn("flex border-b border-border/40 transition-colors cursor-pointer", rowStripe(i), hoveredId === task.id && "bg-muted/20")}
                    style={{ height: ROW_HEIGHT, minWidth: LEFT_CONTENT_W }}
                    {...hoverProps(task.id)}
                    onClick={() => onOpenTask(task)}
                  >
                    <div style={{ width: ROW_NUM_W }} className="shrink-0 border-r border-border/40 flex items-center justify-center text-xs text-muted-foreground">{i + 1}</div>
                    <div style={{ width: TASK_NAME_W }} className="shrink-0 border-r border-border/40 px-3 flex items-center text-xs overflow-hidden">
                      <span className="truncate">{task.title}</span>
                    </div>
                    <div style={{ width: DURATION_W }} className="shrink-0 border-r border-border/40 px-2 flex items-center text-xs text-muted-foreground">{taskDur(task.startDate, task.dueDate)}</div>
                    <div style={{ width: START_W }} className="shrink-0 border-r border-border/40 px-2 flex items-center text-[10px] text-muted-foreground">{fmtDate(task.startDate)}</div>
                    <div style={{ width: FINISH_W }} className="shrink-0 border-r border-border/40 px-2 flex items-center text-[10px] text-muted-foreground">{fmtDate(task.dueDate)}</div>
                    <div style={{ width: ASSIGNED_W }} className="shrink-0 px-2 flex items-center text-xs text-muted-foreground overflow-hidden">
                      <span className="truncate">{task.assignees.length > 0 ? task.assignees.map((a) => a.user.name ?? "").filter(Boolean).join(", ") : "—"}</span>
                    </div>
                  </div>
                ))}
                {Array.from({ length: ghostCount }).map((_, i) => <LeftGhostRow key={`gh-${i}`} idx={tasks.length + i} />)}
              </>
            )}

            {/* CASE 3: scheduled tasks */}
            {scheduled.length > 0 && (
              <>
                {visibleScheduled.map((task, i) => (
                  <div key={task.id}
                    className={cn("flex border-b border-border/40 transition-colors", rowStripe(i), hoveredId === task.id && "bg-muted/20")}
                    style={{ height: ROW_HEIGHT, minWidth: LEFT_CONTENT_W }}
                    {...hoverProps(task.id)}
                  >
                    {/* # */}
                    <div style={{ width: ROW_NUM_W }} className="shrink-0 border-r border-border/40 flex items-center justify-center text-xs text-muted-foreground">{i + 1}</div>

                    {/* Task Name */}
                    <div style={{ width: TASK_NAME_W }} className="shrink-0 border-r border-border/40 flex items-center overflow-hidden">
                      {parentIds.has(task.id) ? (
                        <button onClick={() => toggleRow(task.id)}
                          className="flex-shrink-0 ml-1 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title={collapsedParents.has(task.id) ? "Expand" : "Collapse"}>
                          {collapsedParents.has(task.id) ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      ) : (
                        <span className="flex-shrink-0 w-5" />
                      )}
                      <button onClick={() => onOpenTask(task)}
                        className={cn("flex-1 px-1.5 text-left text-xs hover:text-primary transition-colors overflow-hidden h-full flex items-center gap-1", task.parentId && "pl-3 text-muted-foreground")}>
                        {task.parentId && <span className="flex-shrink-0 text-border text-[10px]">└</span>}
                        {task.isMilestone && <span className="text-amber-500 flex-shrink-0">◆</span>}
                        {task.wbsNumber && <span className="text-[10px] text-muted-foreground flex-shrink-0 font-mono">{task.wbsNumber}</span>}
                        <span className="truncate">{task.title}</span>
                        {task._count.subtasks > 0 && (
                          <span className="flex-shrink-0 rounded-full bg-muted px-1 text-[9px] font-medium text-muted-foreground"
                            title={`${task._count.subtasks} subtask${task._count.subtasks !== 1 ? "s" : ""}`}>⊞{task._count.subtasks}</span>
                        )}
                        {task._count.checklistItems > 0 && (
                          <span className="flex-shrink-0 flex items-center gap-0.5 text-[9px] text-muted-foreground"
                            title={`${task._count.checklistItems} checklist items`}>
                            <CheckSquare className="h-2.5 w-2.5" />{task._count.checklistItems}
                          </span>
                        )}
                        {criticalPath.has(task.id) && <span className="ml-auto flex-shrink-0 h-2 w-2 rounded-full bg-red-500" title="Critical path" />}
                      </button>
                    </div>

                    {/* Duration */}
                    <div style={{ width: DURATION_W }} className="shrink-0 border-r border-border/40 px-2 flex items-center text-xs text-muted-foreground">{taskDur(task.startDate, task.dueDate)}</div>

                    {/* Start */}
                    <div style={{ width: START_W }} className="shrink-0 border-r border-border/40 px-2 flex items-center text-[10px] text-muted-foreground">{fmtDate(task.startDate)}</div>

                    {/* Finish */}
                    <div style={{ width: FINISH_W }} className="shrink-0 border-r border-border/40 px-2 flex items-center text-[10px] text-muted-foreground">{fmtDate(task.dueDate)}</div>

                    {/* Assigned */}
                    <div style={{ width: ASSIGNED_W }} className="shrink-0 px-2 flex items-center text-xs text-muted-foreground overflow-hidden">
                      <span className="truncate">{task.assignees.length > 0 ? task.assignees.map((a) => a.user.name ?? "").filter(Boolean).join(", ") : "—"}</span>
                    </div>
                  </div>
                ))}
                {Array.from({ length: ghostCount }).map((_, i) => <LeftGhostRow key={`gh-${i}`} idx={visibleScheduled.length + i} />)}
              </>
            )}
          </div>
        </div>

        {/* ── Drag handle ─────────────────────────────────────────────────── */}
        <div
          className="flex-shrink-0 relative flex items-center justify-center bg-border/50 hover:bg-primary/25 cursor-col-resize group transition-colors z-20"
          style={{ width: HANDLE_W }}
          onMouseDown={startDrag}
        >
          {/* ‹/› collapse button appears on hover */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleCollapse(); }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute flex h-8 w-5 items-center justify-center rounded border bg-background shadow-sm text-[11px] font-bold text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity select-none"
            title={isCollapsed ? "Expand panel" : "Collapse panel"}
          >
            {isCollapsed ? "›" : "‹"}
          </button>
        </div>

        {/* ── Right panel — timeline ──────────────────────────────────────── */}
        <div
          ref={rightRef}
          className="flex-1 overflow-x-auto overflow-y-auto thin-scroll"
          onScroll={onRightScroll}
        >
          <div style={{ width: Math.max(timelineW, 300), minWidth: "100%" }}>

            {/* Two-tier timeline header: Month row + Week-number row */}
            <div className="sticky top-0 z-10 bg-muted/50 border-b shadow-sm" style={{ width: timelineW }}>
              {/* Month row */}
              <div className="flex" style={{ height: WEEK_ROW_H }}>
                {months.map((m, i) => (
                  <div key={`${m.label}-${i}`}
                    className="flex-shrink-0 px-2 flex items-center text-xs font-semibold text-foreground/80 border-r border-border/50 bg-muted/20 overflow-hidden"
                    style={{ width: m.dayCount * DAY_WIDTH }}>
                    <span className="truncate">{m.label}</span>
                  </div>
                ))}
              </div>
              {/* Week-number row (W22, W23 …) */}
              <div className="flex border-t border-border/20" style={{ height: DAY_ROW_H }}>
                {weeks.map((w, i) => (
                  <div key={w.toISOString()}
                    className={cn(
                      "flex-shrink-0 flex items-center justify-center border-r border-border/30 text-[9px] font-medium",
                      i % 2 !== 0 ? "bg-muted/20 text-muted-foreground" : "text-muted-foreground/70",
                      isToday(w) && "text-primary font-semibold",
                    )}
                    style={{ width: DAY_WIDTH * 7 }}>
                    W{getISOWeek(w)}
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline body */}
            <div className="relative" style={{ width: timelineW }}>

              {/* Background: week separators only (row stripes on the rows themselves) */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {weeks.map((_, i) => (
                  <div key={i} className="absolute top-0 bottom-0 w-px bg-border/25"
                    style={{ left: (i + 1) * DAY_WIDTH * 7 }} />
                ))}
              </div>

              {/* Today marker */}
              {todayOffset >= 0 && todayOffset < totalDays && (
                <div className="absolute top-0 bottom-0 w-0.5 bg-primary/70 z-10 pointer-events-none"
                  style={{ left: todayOffset * DAY_WIDTH }} />
              )}

              {/* CASE 1: no tasks */}
              {tasks.length === 0 && (
                <div className="relative">
                  {Array.from({ length: MIN_ROWS }).map((_, i) => (
                    <div key={i} className={cn("border-b border-border/30", rowStripe(i))} style={{ height: ROW_HEIGHT }} />
                  ))}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="rounded-md border bg-card/90 px-4 py-2 text-sm text-muted-foreground shadow-sm">
                      No tasks yet — click &ldquo;Add Task&rdquo; to see the timeline.
                    </p>
                  </div>
                </div>
              )}

              {/* CASE 2: tasks without dates */}
              {tasks.length > 0 && scheduled.length === 0 && (
                <div className="relative">
                  {tasks.map((task, i) => (
                    <div key={task.id}
                      className={cn("border-b border-border/40 transition-colors", rowStripe(i), hoveredId === task.id && "bg-muted/20")}
                      style={{ height: ROW_HEIGHT }}
                      {...hoverProps(task.id)} />
                  ))}
                  {Array.from({ length: ghostCount }).map((_, i) => (
                    <div key={`gh-${i}`} className={cn("border-b border-border/30", rowStripe(tasks.length + i))} style={{ height: ROW_HEIGHT }} />
                  ))}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="rounded-md border bg-card/90 px-4 py-2 text-sm text-muted-foreground shadow-sm">
                      Add start / due dates to see tasks on the timeline.
                    </p>
                  </div>
                </div>
              )}

              {/* CASE 3: scheduled tasks with bars */}
              {scheduled.length > 0 && (
                <>
                  {visibleScheduled.map((task, i) => {
                    const s      = task.startDate ? new Date(task.startDate) : new Date(task.dueDate!);
                    const e      = task.dueDate   ? new Date(task.dueDate)   : addDays(new Date(task.startDate!), 1);
                    const offset = Math.max(0, differenceInCalendarDays(s, rangeStart));
                    const span   = Math.max(1, differenceInCalendarDays(e, s) + 1);
                    const isCrit = criticalPath.has(task.id);
                    const barColor = isCrit ? "#ef4444" : `hsl(${TASK_STATUS_COLORS[task.status]})`;

                    return (
                      <div key={task.id}
                        className={cn("relative border-b border-border/40 transition-colors", rowStripe(i), hoveredId === task.id && "bg-muted/20")}
                        style={{ height: ROW_HEIGHT }}
                        {...hoverProps(task.id)}
                      >
                        {/* Baseline */}
                        {task.baselineStart && task.baselineEnd && (() => {
                          const bs = differenceInCalendarDays(new Date(task.baselineStart), rangeStart);
                          const be = differenceInCalendarDays(new Date(task.baselineEnd),   rangeStart);
                          return (
                            <div className="absolute rounded-sm opacity-30 border-2 border-dashed"
                              style={{ left: Math.max(0, bs) * DAY_WIDTH, width: Math.max(1, be - bs + 1) * DAY_WIDTH, height: 7, top: "50%", marginTop: 5, borderColor: barColor }}
                              title="Baseline" />
                          );
                        })()}

                        {task.isMilestone ? (
                          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer"
                            style={{ left: (offset + span / 2) * DAY_WIDTH }}
                            onClick={() => onOpenTask(task)} title={task.title}>
                            <svg width="14" height="14" viewBox="0 0 18 18">
                              <path d="M9 1 L17 9 L9 17 L1 9 Z" fill={barColor} stroke="white" strokeWidth="1.5" />
                            </svg>
                          </div>
                        ) : (
                          <div onClick={() => onOpenTask(task)}
                            className="absolute top-1/2 -translate-y-1/2 cursor-pointer rounded-sm flex items-center overflow-hidden"
                            style={{ left: offset * DAY_WIDTH, width: span * DAY_WIDTH, height: 12, backgroundColor: barColor }}
                            title={`${task.title} · ${span} day(s)${isCrit ? " · Critical path" : ""}`}>
                            <div className="absolute inset-y-0 left-0 bg-black/20 rounded-l-sm" style={{ width: `${task.progress}%` }} />
                            {span * DAY_WIDTH > 36 && (
                              <span className="relative px-1 text-[8px] font-medium text-white truncate">{task.progress}%</span>
                            )}
                          </div>
                        )}
                        {/* Task name label to the right of bar */}
                        <span
                          className="absolute text-[10px] whitespace-nowrap text-foreground/65 pointer-events-none select-none leading-none"
                          style={{
                            left: task.isMilestone
                              ? (offset + span / 2) * DAY_WIDTH + 10
                              : (offset + span) * DAY_WIDTH + 4,
                            top: "50%",
                            transform: "translateY(-50%)",
                          }}
                        >
                          {task.title}
                        </span>
                      </div>
                    );
                  })}
                  {Array.from({ length: ghostCount }).map((_, i) => (
                    <div key={`gh-${i}`} className={cn("border-b border-border/30", rowStripe(visibleScheduled.length + i))} style={{ height: ROW_HEIGHT }} />
                  ))}

                  {/* ── Dependency connector arrows ─────────────────────── */}
                  {(() => {
                    // Build bar position map: taskId → { rowIndex, leftX, rightX }
                    const posMap = new Map<string, { ri: number; lx: number; rx: number }>();
                    visibleScheduled.forEach((task, ri) => {
                      const s  = task.startDate ? new Date(task.startDate) : new Date(task.dueDate!);
                      const e  = task.dueDate   ? new Date(task.dueDate)   : addDays(new Date(task.startDate!), 1);
                      const lx = Math.max(0, differenceInCalendarDays(s, rangeStart)) * DAY_WIDTH;
                      const rx = lx + Math.max(1, differenceInCalendarDays(e, s) + 1) * DAY_WIDTH;
                      posMap.set(task.id, { ri, lx, rx });
                    });

                    const arrows: React.ReactNode[] = [];
                    visibleScheduled.forEach((task) => {
                      const succ = posMap.get(task.id);
                      if (!succ || !task.dependsOn?.length) return;
                      const sCY = succ.ri * ROW_HEIGHT + ROW_HEIGHT / 2;

                      for (const dep of task.dependsOn) {
                        const pred = posMap.get(dep.prerequisiteId);
                        if (!pred) continue;
                        const pCY  = pred.ri * ROW_HEIGHT + ROW_HEIGHT / 2;
                        const pRX  = pred.rx;
                        const sLX  = succ.lx;
                        const elbX = pRX + 8;

                        // Simple L-shape (successor to the right)
                        // Loopback path (successor to the left — route below both rows)
                        let d: string;
                        if (sLX >= elbX) {
                          d = `M ${pRX},${pCY} L ${elbX},${pCY} L ${elbX},${sCY} L ${sLX},${sCY}`;
                        } else {
                          const midY = Math.max(pCY, sCY) + ROW_HEIGHT * 0.45;
                          d = `M ${pRX},${pCY} L ${elbX},${pCY} L ${elbX},${midY} L ${sLX - 5},${midY} L ${sLX - 5},${sCY} L ${sLX},${sCY}`;
                        }

                        arrows.push(
                          <g key={`${dep.prerequisiteId}->${task.id}`}>
                            <path d={d} fill="none" stroke="rgba(148,163,184,0.85)" strokeWidth="1.5" strokeLinejoin="round" />
                            {/* Arrowhead pointing right (►) */}
                            <path
                              d={`M ${sLX - 5},${sCY - 4} L ${sLX},${sCY} L ${sLX - 5},${sCY + 4}`}
                              fill="none" stroke="rgba(148,163,184,0.85)" strokeWidth="1.5" strokeLinejoin="round"
                            />
                          </g>
                        );
                      }
                    });

                    if (!arrows.length) return null;
                    return (
                      <svg
                        className="absolute inset-0 pointer-events-none"
                        style={{ zIndex: 9, width: timelineW, height: (visibleScheduled.length + ghostCount) * ROW_HEIGHT }}
                        overflow="visible"
                      >
                        {arrows}
                      </svg>
                    );
                  })()}
                </>
              )}
            </div>
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
