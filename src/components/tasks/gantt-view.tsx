"use client";

import * as React from "react";
import {
  addDays,
  differenceInCalendarDays,
  format,
  getISOWeek,
  isToday,
  max as maxDate,
  min as minDate,
} from "date-fns";
import {
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Settings2,
  ZoomIn,
  ZoomOut,
  CalendarDays,
  Maximize2,
} from "lucide-react";
import type { TaskListItem } from "@/types/app";
import { TASK_STATUS_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Layout constants ──────────────────────────────────────────────────────────
const ROW_HEIGHT     = 24;
const TIER1_H        = 20;
const TIER2_H        = 14;
const HEADER_H       = TIER1_H + TIER2_H; // 34

const ROW_NUM_W      = 28;
const TASK_NAME_W    = 180;
const DURATION_W     = 60;
const START_W        = 72;
const FINISH_W       = 72;
const ASSIGNED_W     = 100;
const LEFT_CONTENT_W = ROW_NUM_W + TASK_NAME_W + DURATION_W + START_W + FINISH_W + ASSIGNED_W; // 512

const LEFT_DEFAULT   = 512;
const LEFT_MIN       = 120;
const LEFT_MAX       = 820;
const HANDLE_W       = 5;
const MIN_ROWS       = 20;

// ── Zoom / timescale types ────────────────────────────────────────────────────
type ZoomLevel = "days" | "weeks" | "months" | "quarters";
type TierUnit  = "year" | "quarter" | "month" | "week" | "day";

interface ZoomPreset { label: string; dayPx: number; topUnit: TierUnit; botUnit: TierUnit }
interface TsSettings  { topUnit: TierUnit; botUnit: TierUnit; dayPx: number }

const ZOOM_PRESETS: Record<ZoomLevel, ZoomPreset> = {
  days:     { label: "Days",     dayPx: 28, topUnit: "month",   botUnit: "day"     },
  weeks:    { label: "Weeks",    dayPx: 24, topUnit: "month",   botUnit: "week"    },
  months:   { label: "Months",   dayPx:  8, topUnit: "year",    botUnit: "month"   },
  quarters: { label: "Quarters", dayPx:  3, topUnit: "year",    botUnit: "quarter" },
};
const ZOOM_ORDER: ZoomLevel[] = ["days", "weeks", "months", "quarters"];

// ── Tier segment generator ────────────────────────────────────────────────────
function getQ(d: Date) { return Math.floor(d.getMonth() / 3) + 1; }

function genSegments(
  allDays: Date[],
  unit: TierUnit,
  dayPx: number,
): { label: string; width: number; highlight?: boolean }[] {
  if (!allDays.length) return [];

  if (unit === "day") {
    const DOW = ["S", "M", "T", "W", "T", "F", "S"];
    return allDays.map(d => ({ label: DOW[d.getDay()], width: dayPx, highlight: isToday(d) }));
  }
  if (unit === "week") {
    const segs: { label: string; count: number }[] = [];
    let cur = { w: getISOWeek(allDays[0]), y: allDays[0].getFullYear(), count: 0 };
    for (const d of allDays) {
      const w = getISOWeek(d); const y = d.getFullYear();
      if (w !== cur.w || y !== cur.y) { segs.push({ label: `W${cur.w}`, count: cur.count }); cur = { w, y, count: 1 }; }
      else cur.count++;
    }
    segs.push({ label: `W${cur.w}`, count: cur.count });
    return segs.map(s => ({ label: s.label, width: s.count * dayPx }));
  }
  if (unit === "month") {
    const segs: { m: number; y: number; count: number }[] = [];
    let cur = { m: allDays[0].getMonth(), y: allDays[0].getFullYear(), count: 0 };
    for (const d of allDays) {
      if (d.getMonth() !== cur.m || d.getFullYear() !== cur.y) { segs.push({ ...cur }); cur = { m: d.getMonth(), y: d.getFullYear(), count: 1 }; }
      else cur.count++;
    }
    segs.push({ ...cur });
    return segs.map(s => ({
      label: format(new Date(s.y, s.m),
        s.count * dayPx > 80 ? "MMMM yyyy" : s.count * dayPx > 40 ? "MMM yyyy" : "MMM"),
      width: s.count * dayPx,
    }));
  }
  if (unit === "quarter") {
    const segs: { label: string; count: number }[] = [];
    let cur = { q: getQ(allDays[0]), y: allDays[0].getFullYear(), count: 0 };
    for (const d of allDays) {
      const q = getQ(d); const y = d.getFullYear();
      if (q !== cur.q || y !== cur.y) { segs.push({ label: `Q${cur.q} ${cur.y}`, count: cur.count }); cur = { q, y, count: 1 }; }
      else cur.count++;
    }
    segs.push({ label: `Q${cur.q} ${cur.y}`, count: cur.count });
    return segs.map(s => ({ label: s.label, width: s.count * dayPx }));
  }
  if (unit === "year") {
    const segs: { label: string; count: number }[] = [];
    let cur = { y: allDays[0].getFullYear(), count: 0 };
    for (const d of allDays) {
      if (d.getFullYear() !== cur.y) { segs.push({ label: String(cur.y), count: cur.count }); cur = { y: d.getFullYear(), count: 1 }; }
      else cur.count++;
    }
    segs.push({ label: String(cur.y), count: cur.count });
    return segs.map(s => ({ label: s.label, width: s.count * dayPx }));
  }
  return [];
}

// ── Misc helpers ──────────────────────────────────────────────────────────────
function fmtDate(d: string | null | undefined) {
  return d ? format(new Date(d), "dd MMM yy") : "—";
}
function taskDur(s: string | null | undefined, e: string | null | undefined) {
  if (!s && !e) return "—";
  if (!s || !e) return "1 d";
  return `${Math.max(1, differenceInCalendarDays(new Date(e), new Date(s)) + 1)} d`;
}

function computeCriticalPath(tasks: TaskListItem[]): Set<string> {
  const byId = new Map(tasks.map(t => [t.id, t]));
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
  tasks.forEach(t => visit(t.id));
  for (const t of sorted) {
    const prereqs = (t.dependsOn ?? []).map(d => ef.get(d.prerequisiteId) ?? 0);
    ef.set(t.id, (prereqs.length > 0 ? Math.max(...prereqs) : 0) + dur(t));
  }
  const maxEF = Math.max(0, ...Array.from(ef.values()));
  const critical = new Set<string>();
  for (const [id, finish] of ef) if (finish === maxEF) critical.add(id);
  return critical;
}

const today = new Date();

// ── TimescaleDialog ────────────────────────────────────────────────────────────
const UNIT_LABELS: Record<TierUnit, string> = { year: "Years", quarter: "Quarters", month: "Months", week: "Weeks", day: "Days" };
const TOP_UNITS: TierUnit[] = ["year", "quarter", "month", "week"];
const BOT_UNITS: TierUnit[] = ["quarter", "month", "week", "day"];

function TimescaleDialog({
  open, onClose, settings, onApply, allDays,
}: {
  open: boolean; onClose: () => void;
  settings: TsSettings; onApply: (s: TsSettings) => void;
  allDays: Date[];
}) {
  const [local, setLocal] = React.useState(settings);
  React.useEffect(() => { if (open) setLocal(settings); }, [open, settings]);

  const previewDays = React.useMemo(
    () => allDays.slice(0, Math.min(allDays.length, Math.ceil(300 / Math.max(1, local.dayPx)))),
    [allDays, local.dayPx],
  );
  const topPrev = React.useMemo(() => genSegments(previewDays, local.topUnit, local.dayPx), [previewDays, local.topUnit, local.dayPx]);
  const botPrev = React.useMemo(() => genSegments(previewDays, local.botUnit, local.dayPx), [previewDays, local.botUnit, local.dayPx]);

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <Settings2 className="h-4 w-4" /> Timescale Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pb-1">
          {/* Top tier */}
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Top Tier</p>
            <div className="flex items-center gap-3">
              <Label className="text-xs w-12 shrink-0">Units</Label>
              <Select value={local.topUnit} onValueChange={v => setLocal(l => ({ ...l, topUnit: v as TierUnit }))}>
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>{TOP_UNITS.map(u => <SelectItem key={u} value={u} className="text-xs">{UNIT_LABELS[u]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Bottom tier */}
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bottom Tier</p>
            <div className="flex items-center gap-3">
              <Label className="text-xs w-12 shrink-0">Units</Label>
              <Select value={local.botUnit} onValueChange={v => setLocal(l => ({ ...l, botUnit: v as TierUnit }))}>
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>{BOT_UNITS.map(u => <SelectItem key={u} value={u} className="text-xs">{UNIT_LABELS[u]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Scale size */}
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Scale Size</p>
            <div className="flex items-center gap-3">
              <Label className="text-xs w-12 shrink-0">Width</Label>
              <input type="range" min={1} max={60} step={1} value={local.dayPx}
                onChange={e => setLocal(l => ({ ...l, dayPx: Number(e.target.value) }))}
                className="flex-1 h-1.5 accent-primary cursor-pointer" />
              <span className="text-[11px] text-muted-foreground w-16 text-right tabular-nums">{local.dayPx} px/day</span>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg border overflow-hidden">
            <div className="px-3 py-1.5 border-b bg-muted/30">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Preview</p>
            </div>
            <div className="overflow-x-auto" style={{ maxHeight: 56 }}>
              <div style={{ width: topPrev.reduce((s, seg) => s + seg.width, 0), minWidth: "100%" }}>
                <div className="flex bg-muted/20 border-b" style={{ height: 20 }}>
                  {topPrev.map((seg, i) => (
                    <div key={i} className="flex-shrink-0 flex items-center px-1 border-r border-border/40 overflow-hidden" style={{ width: seg.width }}>
                      <span className="truncate text-[9px] font-semibold">{seg.label}</span>
                    </div>
                  ))}
                </div>
                <div className="flex" style={{ height: 14 }}>
                  {botPrev.map((seg, i) => (
                    <div key={i}
                      className={cn("flex-shrink-0 flex items-center justify-center border-r border-border/30 overflow-hidden",
                        i % 2 !== 0 ? "bg-muted/20" : "",
                        seg.highlight ? "text-primary font-bold bg-primary/10" : "text-muted-foreground")}
                      style={{ width: seg.width }}>
                      <span className="truncate text-[8px]">{seg.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-muted-foreground mr-1">Presets:</span>
            {ZOOM_ORDER.map(level => (
              <button key={level}
                onClick={() => { const p = ZOOM_PRESETS[level]; setLocal({ topUnit: p.topUnit, botUnit: p.botUnit, dayPx: p.dayPx }); }}
                className="px-2 py-0.5 rounded text-[10px] border bg-background hover:bg-muted transition-colors">
                {ZOOM_PRESETS[level].label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t pt-3">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onClose}>Cancel</Button>
          <Button variant="brand" size="sm" className="h-7 text-xs" onClick={() => { onApply(local); onClose(); }}>Apply</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── GanttView ─────────────────────────────────────────────────────────────────
export function GanttView({
  tasks, onOpenTask,
}: {
  tasks: TaskListItem[];
  onOpenTask: (task: TaskListItem) => void;
}) {

  // ── Scroll sync ───────────────────────────────────────────────────────────
  const leftRef  = React.useRef<HTMLDivElement>(null);
  const rightRef = React.useRef<HTMLDivElement>(null);
  const syncing  = React.useRef(false);

  const [dynamicMinRows, setDynamicMinRows] = React.useState(MIN_ROWS);
  React.useEffect(() => {
    const el = rightRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const h = entry.contentRect.height;
      setDynamicMinRows(Math.max(MIN_ROWS, Math.ceil((h - HEADER_H) / ROW_HEIGHT) + 1));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onLeftScroll = React.useCallback(() => {
    if (syncing.current) return;
    syncing.current = true;
    if (rightRef.current && leftRef.current) rightRef.current.scrollTop = leftRef.current.scrollTop;
    syncing.current = false;
  }, []);

  const onRightScroll = React.useCallback(() => {
    if (syncing.current) return;
    syncing.current = true;
    if (leftRef.current && rightRef.current) leftRef.current.scrollTop = rightRef.current.scrollTop;
    syncing.current = false;
  }, []);

  // ── Panel resize ──────────────────────────────────────────────────────────
  const [leftWidth, setLeftWidth] = React.useState(LEFT_DEFAULT);
  const savedWidth   = React.useRef(LEFT_DEFAULT);
  const isCollapsed  = leftWidth < LEFT_MIN / 2;

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    const x0 = e.clientX; const w0 = leftWidth;
    const move = (ev: MouseEvent) => setLeftWidth(Math.max(LEFT_MIN, Math.min(LEFT_MAX, w0 + ev.clientX - x0)));
    const up   = () => { document.body.style.cursor = ""; document.body.style.userSelect = ""; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none";
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  }

  function toggleCollapse() {
    if (!isCollapsed) { savedWidth.current = leftWidth; setLeftWidth(0); }
    else setLeftWidth(savedWidth.current || LEFT_DEFAULT);
  }

  // ── Timescale state ───────────────────────────────────────────────────────
  const [tsSettings, setTsSettings] = React.useState<TsSettings>({
    topUnit: "month", botUnit: "week", dayPx: 24,
  });
  const [tsOpen, setTsOpen] = React.useState(false);

  const dayPx = tsSettings.dayPx;

  const activeZoom = (Object.keys(ZOOM_PRESETS) as ZoomLevel[]).find(
    k => ZOOM_PRESETS[k].topUnit === tsSettings.topUnit &&
         ZOOM_PRESETS[k].botUnit === tsSettings.botUnit &&
         ZOOM_PRESETS[k].dayPx   === tsSettings.dayPx
  ) ?? null;

  function applyZoom(level: ZoomLevel) {
    const p = ZOOM_PRESETS[level];
    setTsSettings({ topUnit: p.topUnit, botUnit: p.botUnit, dayPx: p.dayPx });
  }

  function zoomIn() {
    const idx = activeZoom ? ZOOM_ORDER.indexOf(activeZoom) : ZOOM_ORDER.length - 1;
    if (idx > 0) applyZoom(ZOOM_ORDER[idx - 1]);
    else setTsSettings(s => ({ ...s, dayPx: Math.min(60, Math.round(s.dayPx * 1.4)) }));
  }

  function zoomOut() {
    const idx = activeZoom ? ZOOM_ORDER.indexOf(activeZoom) : 0;
    if (idx < ZOOM_ORDER.length - 1) applyZoom(ZOOM_ORDER[idx + 1]);
    else setTsSettings(s => ({ ...s, dayPx: Math.max(1, Math.round(s.dayPx / 1.4)) }));
  }

  // ── Data ──────────────────────────────────────────────────────────────────
  const sortedTasks = React.useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (!a.wbsNumber && !b.wbsNumber) return 0;
      if (!a.wbsNumber) return 1;
      if (!b.wbsNumber) return -1;
      const aParts = a.wbsNumber.split(".").map(Number);
      const bParts = b.wbsNumber.split(".").map(Number);
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const av = aParts[i] ?? 0;
        const bv = bParts[i] ?? 0;
        if (av !== bv) return av - bv;
      }
      return 0;
    });
  }, [tasks]);

  const scheduled    = sortedTasks.filter(t => t.startDate || t.dueDate);
  const criticalPath = React.useMemo(() => computeCriticalPath(tasks), [tasks]);
  const [hoveredId,  setHoveredId]  = React.useState<string | null>(null);

  const { rangeStart, totalDays } = React.useMemo(() => {
    if (scheduled.length === 0) return { rangeStart: addDays(today, -7), totalDays: 38 };
    const dates: Date[] = [];
    for (const t of scheduled) {
      if (t.startDate) dates.push(new Date(t.startDate));
      if (t.dueDate)   dates.push(new Date(t.dueDate));
    }
    const s = addDays(minDate(dates), -7);
    const e = addDays(maxDate(dates), 14);
    return { rangeStart: s, totalDays: differenceInCalendarDays(e, s) + 1 };
  }, [scheduled]);

  const allDays      = React.useMemo(() => Array.from({ length: totalDays }, (_, i) => addDays(rangeStart, i)), [rangeStart, totalDays]);
  const todayOffset  = differenceInCalendarDays(today, rangeStart);
  const timelineW    = totalDays * dayPx;

  // Tier segments
  const topSegs = React.useMemo(() => genSegments(allDays, tsSettings.topUnit, dayPx), [allDays, tsSettings.topUnit, dayPx]);
  const botSegs = React.useMemo(() => genSegments(allDays, tsSettings.botUnit, dayPx), [allDays, tsSettings.botUnit, dayPx]);

  // Vertical grid separator X positions
  const gridSeps = React.useMemo(() => {
    const xs: number[] = [];
    let x = 0;
    for (const seg of botSegs) { x += seg.width; xs.push(x); }
    xs.pop();
    return xs;
  }, [botSegs]);

  function scrollToToday() {
    const cw = rightRef.current?.clientWidth ?? 600;
    rightRef.current?.scrollTo({ left: Math.max(0, todayOffset * dayPx - cw / 2), behavior: "smooth" });
  }

  function fitToProject() {
    const cw = (rightRef.current?.clientWidth ?? 600) - 20;
    setTsSettings(s => ({ ...s, dayPx: Math.max(1, Math.floor(cw / Math.max(totalDays, 1))) }));
  }

  // Collapsible parents
  const [collapsedParents, setCollapsedParents] = React.useState<Set<string>>(new Set());
  function toggleRow(id: string) {
    setCollapsedParents(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  const parentIds = React.useMemo(
    () => new Set(sortedTasks.filter(t => t.parentId).map(t => t.parentId!)),
    [sortedTasks],
  );
  const visibleTasks = React.useMemo(
    () => sortedTasks.filter(t => !t.parentId || !collapsedParents.has(t.parentId)),
    [sortedTasks, collapsedParents],
  );
  const visibleScheduled = React.useMemo(
    () => visibleTasks.filter(t => t.startDate || t.dueDate),
    [visibleTasks],
  );

  const rowCount   = visibleTasks.length;
  const ghostCount = Math.max(0, dynamicMinRows - rowCount);
  const hoverProps = (id: string) => ({ onMouseEnter: () => setHoveredId(id), onMouseLeave: () => setHoveredId(null) });
  const rowStripe  = (idx: number) => idx % 2 !== 0 ? "bg-muted/[0.07]" : "";

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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 220px)" }}>

      {/* ── Timescale Ribbon ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-1 flex-wrap select-none">
        {/* Zoom level presets */}
        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider pr-1">Zoom</span>
        {ZOOM_ORDER.map(level => (
          <button key={level} onClick={() => applyZoom(level)}
            className={cn(
              "px-2 py-0.5 rounded text-[11px] font-medium transition-all",
              activeZoom === level
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-background border hover:bg-muted text-foreground/70 hover:text-foreground"
            )}>
            {ZOOM_PRESETS[level].label}
          </button>
        ))}

        <div className="h-4 w-px bg-border/60 mx-0.5" />

        {/* Zoom in / out */}
        <button onClick={zoomIn}
          className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title="Zoom In">
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button onClick={zoomOut}
          className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title="Zoom Out">
          <ZoomOut className="h-3.5 w-3.5" />
        </button>

        <div className="h-4 w-px bg-border/60 mx-0.5" />

        {/* Today + Fit */}
        <button onClick={scrollToToday}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-background border hover:bg-muted transition-colors text-foreground/70 hover:text-foreground"
          title="Scroll to today">
          <CalendarDays className="h-3 w-3" /> Today
        </button>
        <button onClick={fitToProject}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-background border hover:bg-muted transition-colors text-foreground/70 hover:text-foreground"
          title="Fit entire project in view">
          <Maximize2 className="h-3 w-3" /> Fit
        </button>

        <div className="h-4 w-px bg-border/60 mx-0.5" />

        {/* Timescale settings */}
        <button onClick={() => setTsOpen(true)}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-background border hover:bg-muted transition-colors text-foreground/70 hover:text-foreground"
          title="Timescale Settings">
          <Settings2 className="h-3 w-3" /> Timescale
        </button>

        {!activeZoom && (
          <span className="ml-1 text-[9px] text-muted-foreground italic">Custom · {dayPx}px/day</span>
        )}
      </div>

      {/* ── Split-pane Gantt ──────────────────────────────────────────────── */}
      <div className="flex rounded-lg border overflow-hidden flex-1 min-h-0">

        {/* ── Left panel ───────────────────────────────────────────────── */}
        <div ref={leftRef}
          className="flex-shrink-0 overflow-y-auto overflow-x-hidden border-r border-border/60"
          style={{ width: leftWidth, transition: "none" }}
          onScroll={onLeftScroll}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex border-b bg-muted/50 shadow-sm"
            style={{ height: HEADER_H, minWidth: LEFT_CONTENT_W }}>
            <div style={{ width: ROW_NUM_W }} className="shrink-0 border-r border-border/70 flex items-center justify-center text-[10px] font-semibold text-muted-foreground">#</div>
            <div style={{ width: TASK_NAME_W }} className="shrink-0 border-r border-border/70 flex items-center px-3 text-[10px] font-semibold">Task Name</div>
            <div style={{ width: DURATION_W }} className="shrink-0 border-r border-border/70 flex items-center px-2 text-[10px] font-semibold text-muted-foreground">Dur.</div>
            <div style={{ width: START_W }} className="shrink-0 border-r border-border/70 flex items-center px-2 text-[10px] font-semibold text-muted-foreground">Start</div>
            <div style={{ width: FINISH_W }} className="shrink-0 border-r border-border/70 flex items-center px-2 text-[10px] font-semibold text-muted-foreground">Finish</div>
            <div style={{ width: ASSIGNED_W }} className="shrink-0 flex items-center px-2 text-[10px] font-semibold text-muted-foreground">Assigned</div>
          </div>

          {/* Rows */}
          <div style={{ minWidth: LEFT_CONTENT_W }}>
            {sortedTasks.length === 0
              ? Array.from({ length: MIN_ROWS }).map((_, i) => <LeftGhostRow key={i} idx={i} />)
              : <>
                  {visibleTasks.map((task, i) => (
                    <div key={task.id}
                      className={cn("flex border-b border-border/40 transition-colors cursor-pointer", rowStripe(i), hoveredId === task.id && "bg-muted/20")}
                      style={{ height: ROW_HEIGHT, minWidth: LEFT_CONTENT_W }}
                      {...hoverProps(task.id)}
                    >
                      <div style={{ width: ROW_NUM_W }} className="shrink-0 border-r border-border/40 flex items-center justify-center text-[10px] text-muted-foreground">{i + 1}</div>
                      <div style={{ width: TASK_NAME_W }} className="shrink-0 border-r border-border/40 flex items-center overflow-hidden">
                        {parentIds.has(task.id) ? (
                          <button onClick={() => toggleRow(task.id)}
                            className="flex-shrink-0 ml-1 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title={collapsedParents.has(task.id) ? "Expand" : "Collapse"}>
                            {collapsedParents.has(task.id) ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                        ) : <span className="flex-shrink-0 w-5" />}
                        <button onClick={() => onOpenTask(task)}
                          className={cn("flex-1 px-1.5 text-left text-[10px] hover:text-primary transition-colors overflow-hidden h-full flex items-center gap-1", task.parentId && "pl-3 text-muted-foreground")}>
                          {task.parentId && <span className="flex-shrink-0 text-border text-[9px]">└</span>}
                          {task.isMilestone && <span className="text-amber-500 flex-shrink-0 text-[9px]">◆</span>}
                          {task.wbsNumber && <span className="text-[9px] text-muted-foreground flex-shrink-0 font-mono">{task.wbsNumber}</span>}
                          <span className="truncate">{task.title}</span>
                          {task._count.subtasks > 0 && (
                            <span className="flex-shrink-0 rounded-full bg-muted px-1 text-[8px] font-medium text-muted-foreground" title={`${task._count.subtasks} subtask(s)`}>⊞{task._count.subtasks}</span>
                          )}
                          {task._count.checklistItems > 0 && (
                            <span className="flex-shrink-0 flex items-center gap-0.5 text-[8px] text-muted-foreground" title={`${task._count.checklistItems} checklist items`}>
                              <CheckSquare className="h-2 w-2" />{task._count.checklistItems}
                            </span>
                          )}
                          {criticalPath.has(task.id) && <span className="ml-auto flex-shrink-0 h-1.5 w-1.5 rounded-full bg-red-500" title="Critical path" />}
                        </button>
                      </div>
                      <div style={{ width: DURATION_W }} className="shrink-0 border-r border-border/40 px-2 flex items-center text-[10px] text-muted-foreground">{taskDur(task.startDate, task.dueDate)}</div>
                      <div style={{ width: START_W }} className="shrink-0 border-r border-border/40 px-2 flex items-center text-[10px] text-muted-foreground">{fmtDate(task.startDate)}</div>
                      <div style={{ width: FINISH_W }} className="shrink-0 border-r border-border/40 px-2 flex items-center text-[10px] text-muted-foreground">{fmtDate(task.dueDate)}</div>
                      <div style={{ width: ASSIGNED_W }} className="shrink-0 px-2 flex items-center text-[10px] text-muted-foreground overflow-hidden">
                        <span className="truncate">{task.assignees.length > 0 ? task.assignees.map(a => a.user.name ?? "").filter(Boolean).join(", ") : "—"}</span>
                      </div>
                    </div>
                  ))}
                  {Array.from({ length: ghostCount }).map((_, i) => <LeftGhostRow key={`gh-${i}`} idx={visibleTasks.length + i} />)}
                </>
            }
          </div>
        </div>

        {/* ── Drag handle ──────────────────────────────────────────────── */}
        <div
          className="flex-shrink-0 relative flex items-center justify-center bg-border/50 hover:bg-primary/25 cursor-col-resize group transition-colors z-20"
          style={{ width: HANDLE_W }}
          onMouseDown={startDrag}
        >
          <button
            onClick={e => { e.stopPropagation(); toggleCollapse(); }}
            onMouseDown={e => e.stopPropagation()}
            className="absolute flex h-8 w-5 items-center justify-center rounded border bg-background shadow-sm text-[11px] font-bold text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity select-none"
            title={isCollapsed ? "Expand panel" : "Collapse panel"}
          >
            {isCollapsed ? "›" : "‹"}
          </button>
        </div>

        {/* ── Right panel — timeline ───────────────────────────────────── */}
        <div ref={rightRef}
          className="flex-1 overflow-x-auto overflow-y-auto thin-scroll"
          onScroll={onRightScroll}
        >
          <div style={{ width: Math.max(timelineW, 300), minWidth: "100%" }}>

            {/* Two-tier header */}
            <div className="sticky top-0 z-10 bg-muted/50 border-b shadow-sm" style={{ width: timelineW }}>
              {/* Top tier */}
              <div className="flex" style={{ height: TIER1_H }}>
                {topSegs.map((seg, i) => (
                  <div key={i}
                    className="flex-shrink-0 flex items-center px-1.5 border-r border-border/50 bg-muted/20 overflow-hidden"
                    style={{ width: seg.width }}>
                    <span className="truncate text-[10px] font-semibold text-foreground/80">{seg.label}</span>
                  </div>
                ))}
              </div>
              {/* Bottom tier */}
              <div className="flex border-t border-border/20" style={{ height: TIER2_H }}>
                {botSegs.map((seg, i) => (
                  <div key={i}
                    className={cn(
                      "flex-shrink-0 flex items-center justify-center border-r border-border/30 overflow-hidden",
                      i % 2 !== 0 ? "bg-muted/20" : "",
                      seg.highlight ? "text-primary font-bold bg-primary/10" : "text-muted-foreground/70",
                    )}
                    style={{ width: seg.width }}>
                    <span className="truncate text-[8px] font-medium">{seg.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline body */}
            <div className="relative" style={{ width: timelineW }}>

              {/* Background grid (bottom-tier separators) */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {gridSeps.map((x, i) => (
                  <div key={i} className="absolute top-0 bottom-0 w-px bg-border/25" style={{ left: x }} />
                ))}
              </div>

              {/* Today marker */}
              {todayOffset >= 0 && todayOffset < totalDays && (
                <div className="absolute top-0 bottom-0 w-0.5 bg-primary/70 z-10 pointer-events-none"
                  style={{ left: todayOffset * dayPx }} />
              )}

              {/* No tasks */}
              {sortedTasks.length === 0 && (
                <div className="relative">
                  {Array.from({ length: MIN_ROWS }).map((_, i) => (
                    <div key={i} className={cn("border-b border-border/30", rowStripe(i))} style={{ height: ROW_HEIGHT }} />
                  ))}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="rounded-md border bg-card/90 px-4 py-2 text-xs text-muted-foreground shadow-sm">
                      No tasks yet — click &ldquo;Add Task&rdquo; to see the timeline.
                    </p>
                  </div>
                </div>
              )}

              {/* All tasks — bars only for those with dates */}
              {sortedTasks.length > 0 && (
                <>
                  {visibleTasks.map((task, i) => {
                    const hasBar = !!(task.startDate || task.dueDate);
                    if (!hasBar) {
                      return (
                        <div key={task.id}
                          className={cn("relative border-b border-border/40 transition-colors", rowStripe(i), hoveredId === task.id && "bg-muted/20")}
                          style={{ height: ROW_HEIGHT }}
                          {...hoverProps(task.id)}
                        />
                      );
                    }
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
                              style={{ left: Math.max(0, bs) * dayPx, width: Math.max(1, be - bs + 1) * dayPx, height: 7, top: "50%", marginTop: 5, borderColor: barColor }}
                              title="Baseline" />
                          );
                        })()}

                        {task.isMilestone ? (
                          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer"
                            style={{ left: (offset + span / 2) * dayPx }}
                            onClick={() => onOpenTask(task)} title={task.title}>
                            <svg width="14" height="14" viewBox="0 0 18 18">
                              <path d="M9 1 L17 9 L9 17 L1 9 Z" fill={barColor} stroke="white" strokeWidth="1.5" />
                            </svg>
                          </div>
                        ) : (
                          <div onClick={() => onOpenTask(task)}
                            className="absolute top-1/2 -translate-y-1/2 cursor-pointer rounded-sm flex items-center overflow-hidden"
                            style={{ left: offset * dayPx, width: span * dayPx, height: 12, backgroundColor: barColor }}
                            title={`${task.title} · ${span} day(s)${isCrit ? " · Critical path" : ""}`}>
                            <div className="absolute inset-y-0 left-0 bg-black/20 rounded-l-sm" style={{ width: `${task.progress}%` }} />
                            {span * dayPx > 36 && (
                              <span className="relative px-1 text-[8px] font-medium text-white truncate">{task.progress}%</span>
                            )}
                          </div>
                        )}

                        {/* Task name label */}
                        <span
                          className="absolute text-[10px] whitespace-nowrap text-foreground/65 pointer-events-none select-none leading-none"
                          style={{
                            left: task.isMilestone ? (offset + span / 2) * dayPx + 10 : (offset + span) * dayPx + 4,
                            top: "50%", transform: "translateY(-50%)",
                          }}
                        >
                          {task.title}
                        </span>
                      </div>
                    );
                  })}

                  {Array.from({ length: ghostCount }).map((_, i) => (
                    <div key={`gh-${i}`} className={cn("border-b border-border/30", rowStripe(visibleTasks.length + i))} style={{ height: ROW_HEIGHT }} />
                  ))}

                  {/* Overlay when no tasks have dates */}
                  {visibleScheduled.length === 0 && (
                    <div className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none" style={{ height: visibleTasks.length * ROW_HEIGHT }}>
                      <p className="rounded-md border bg-card/90 px-4 py-2 text-xs text-muted-foreground shadow-sm">
                        Add start / due dates to see tasks on the timeline.
                      </p>
                    </div>
                  )}

                  {/* Dependency connector arrows */}
                  {(() => {
                    const posMap = new Map<string, { ri: number; lx: number; rx: number }>();
                    visibleTasks.forEach((task, ri) => {
                      if (!task.startDate && !task.dueDate) return;
                      const s  = task.startDate ? new Date(task.startDate) : new Date(task.dueDate!);
                      const e  = task.dueDate   ? new Date(task.dueDate)   : addDays(new Date(task.startDate!), 1);
                      const lx = Math.max(0, differenceInCalendarDays(s, rangeStart)) * dayPx;
                      const rx = lx + Math.max(1, differenceInCalendarDays(e, s) + 1) * dayPx;
                      posMap.set(task.id, { ri, lx, rx });
                    });
                    const arrows: React.ReactNode[] = [];
                    visibleTasks.forEach(task => {
                      const succ = posMap.get(task.id);
                      if (!succ || !task.dependsOn?.length) return;
                      const sCY = succ.ri * ROW_HEIGHT + ROW_HEIGHT / 2;
                      for (const dep of task.dependsOn) {
                        const pred = posMap.get(dep.prerequisiteId);
                        if (!pred) continue;
                        const pCY = pred.ri * ROW_HEIGHT + ROW_HEIGHT / 2;
                        const pRX = pred.rx; const sLX = succ.lx; const elbX = pRX + 8;
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
                            <path d={`M ${sLX - 5},${sCY - 4} L ${sLX},${sCY} L ${sLX - 5},${sCY + 4}`}
                              fill="none" stroke="rgba(148,163,184,0.85)" strokeWidth="1.5" strokeLinejoin="round" />
                          </g>
                        );
                      }
                    });
                    if (!arrows.length) return null;
                    return (
                      <svg className="absolute inset-0 pointer-events-none"
                        style={{ zIndex: 9, width: timelineW, height: (visibleTasks.length + ghostCount) * ROW_HEIGHT }}
                        overflow="visible">
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
      <div className="flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5"><div className="h-0.5 w-5 bg-primary/70" /><span>Today</span></div>
        <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-red-500" /><span>Critical path</span></div>
        <div className="flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 12 12"><path d="M6 1L11 6L6 11L1 6Z" fill="#f59e0b" /></svg>
          <span>Milestone</span>
        </div>
        <div className="flex items-center gap-1.5"><div className="h-2.5 w-5 border-2 border-dashed border-muted-foreground opacity-50 rounded-sm" /><span>Baseline</span></div>
      </div>

      {/* Timescale Settings Dialog */}
      <TimescaleDialog
        open={tsOpen}
        onClose={() => setTsOpen(false)}
        settings={tsSettings}
        onApply={s => setTsSettings(s)}
        allDays={allDays}
      />
    </div>
  );
}
