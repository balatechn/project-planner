"use client";

import * as React from "react";
import type { TaskListItem, ProjectSummary } from "@/types/app";

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}
function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 86_400_000);
}
function fmtDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}
function fmtDateShort(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

// ── Chart component ───────────────────────────────────────────────────────────
export function BurndownChart({
  project,
  tasks,
}: {
  project: Pick<ProjectSummary, "startDate" | "endDate" | "name">;
  tasks: TaskListItem[];
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Only top-level tasks (parentId = null) and non-milestones
  const trackedTasks = tasks.filter((t) => !t.isMilestone);
  const total = trackedTasks.length;

  const start = project.startDate ? new Date(project.startDate) : null;
  const end   = project.endDate   ? new Date(project.endDate)   : null;

  if (!start || !end || total === 0) {
    return (
      <div className="flex h-60 items-center justify-center rounded-xl border bg-card text-sm text-muted-foreground">
        {!start || !end
          ? "Set a project start and end date to see the burndown chart."
          : "Add tasks to see the burndown chart."}
      </div>
    );
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const chartEnd = today > end ? today : end;
  const totalDays = Math.max(1, daysBetween(start, chartEnd));

  // Build daily actual burndown: for each day, how many tasks were NOT yet completed
  const dataPoints: { date: Date; remaining: number }[] = [];
  for (let i = 0; i <= totalDays; i++) {
    const d = addDays(start, i);
    const remaining = trackedTasks.filter((t) => {
      if (!t.completedAt) return true;
      const c = new Date(t.completedAt);
      c.setHours(0, 0, 0, 0);
      return c > d;
    }).length;
    dataPoints.push({ date: d, remaining });
  }

  // Ideal burndown (straight line from total on day 0 to 0 on endDate)
  const projectDays = Math.max(1, daysBetween(start, end));

  // SVG dimensions
  const W = 800;
  const H = 320;
  const PAD = { top: 24, right: 24, bottom: 48, left: 48 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  function xPct(date: Date) {
    return Math.max(0, Math.min(1, daysBetween(start!, date) / totalDays));
  }
  function yPct(count: number) {
    return 1 - count / total;
  }
  function toSvgX(pct: number) {
    return PAD.left + pct * chartW;
  }
  function toSvgY(pct: number) {
    return PAD.top + pct * chartH;
  }

  // Build SVG path strings
  const actualPath = dataPoints
    .filter((_, i) => i <= daysBetween(start!, today))
    .map((p, i) =>
      `${i === 0 ? "M" : "L"}${toSvgX(xPct(p.date)).toFixed(1)},${toSvgY(yPct(p.remaining)).toFixed(1)}`
    )
    .join(" ");

  const idealPath = [
    `M${toSvgX(0).toFixed(1)},${toSvgY(0).toFixed(1)}`,
    `L${toSvgX(Math.min(1, projectDays / totalDays)).toFixed(1)},${toSvgY(1).toFixed(1)}`,
  ].join(" ");

  // Actual area fill
  const firstPt = dataPoints[0];
  const lastActualIdx = Math.min(dataPoints.length - 1, daysBetween(start!, today));
  const lastActualPt  = dataPoints[lastActualIdx];
  const areaPath = firstPt && lastActualPt
    ? `${actualPath} L${toSvgX(xPct(lastActualPt.date)).toFixed(1)},${toSvgY(1).toFixed(1)} L${toSvgX(0).toFixed(1)},${toSvgY(1).toFixed(1)} Z`
    : "";

  // X-axis labels (at most 8)
  const labelStep = Math.max(1, Math.ceil(totalDays / 7));
  const xLabels: { x: number; label: string }[] = [];
  for (let i = 0; i <= totalDays; i += labelStep) {
    const d = addDays(start, i);
    xLabels.push({ x: toSvgX(xPct(d)), label: fmtDateShort(d) });
  }

  // Y-axis labels (4–5 steps)
  const yStep = Math.ceil(total / 4);
  const yLabels: { y: number; label: string }[] = [];
  for (let v = 0; v <= total; v += yStep) {
    yLabels.push({ y: toSvgY(yPct(v)), label: String(v) });
  }

  // Today line
  const todayX = today >= start && today <= chartEnd ? toSvgX(xPct(today)) : null;
  // End date line
  const endX = end <= chartEnd ? toSvgX(xPct(end)) : null;

  // Stats
  const todayIdx = Math.min(dataPoints.length - 1, Math.max(0, daysBetween(start!, today)));
  const todayRemaining = dataPoints[todayIdx]?.remaining ?? 0;
  const daysLeft = daysBetween(today, end);
  const completedCount = total - todayRemaining;
  const idealToday = Math.round(Math.max(0, total * (1 - daysBetween(start!, today) / projectDays)));
  const velocity = daysLeft > 0 ? (todayRemaining / daysLeft).toFixed(1) : "—";

  return (
    <div className="space-y-4">
      {/* KPI pills */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: "Total Tasks",  value: total,          color: "text-foreground" },
          { label: "Completed",    value: completedCount, color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Remaining",    value: todayRemaining, color: "text-amber-600 dark:text-amber-400" },
          { label: "Ideal Left",   value: idealToday,     color: "text-blue-600 dark:text-blue-400" },
          { label: "Days Left",    value: Math.max(0, daysLeft), color: daysLeft < 0 ? "text-destructive" : "text-foreground" },
          { label: "Needed/Day",   value: velocity,       color: "text-muted-foreground" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border bg-card px-3 py-2 text-center min-w-[90px]">
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-xl border bg-card p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 300 }}>
          {/* Grid lines */}
          {yLabels.map(({ y, label }) => (
            <React.Fragment key={label}>
              <line x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y}
                stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={10}
                fill="currentColor" fillOpacity={0.5}>{label}</text>
            </React.Fragment>
          ))}

          {/* X-axis labels */}
          {xLabels.map(({ x, label }) => (
            <text key={label} x={x} y={H - PAD.bottom + 16} textAnchor="middle"
              fontSize={10} fill="currentColor" fillOpacity={0.5}>{label}</text>
          ))}

          {/* Axis lines */}
          <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + chartH}
            stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
          <line x1={PAD.left} y1={PAD.top + chartH} x2={PAD.left + chartW} y2={PAD.top + chartH}
            stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />

          {/* Today vertical line */}
          {todayX !== null && (
            <>
              <line x1={todayX} y1={PAD.top} x2={todayX} y2={PAD.top + chartH}
                stroke="#f59e0b" strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray="4 3" />
              <text x={todayX + 4} y={PAD.top + 10} fontSize={9}
                fill="#f59e0b" fillOpacity={0.8}>Today</text>
            </>
          )}

          {/* End date vertical line */}
          {endX !== null && endX !== todayX && (
            <>
              <line x1={endX} y1={PAD.top} x2={endX} y2={PAD.top + chartH}
                stroke="#ef4444" strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray="4 3" />
              <text x={endX + 4} y={PAD.top + 10} fontSize={9}
                fill="#ef4444" fillOpacity={0.7}>Deadline</text>
            </>
          )}

          {/* Ideal line */}
          <path d={idealPath} fill="none" stroke="#3b82f6" strokeOpacity={0.5}
            strokeWidth={1.5} strokeDasharray="6 4" />

          {/* Actual area fill */}
          {areaPath && (
            <path d={areaPath} fill="#f59e0b" fillOpacity={0.08} />
          )}

          {/* Actual line */}
          {actualPath && (
            <path d={actualPath} fill="none" stroke="#f59e0b" strokeWidth={2.5}
              strokeLinejoin="round" strokeLinecap="round" />
          )}

          {/* Legend */}
          <g transform={`translate(${PAD.left + 8},${PAD.top + 6})`}>
            <line x1={0} y1={6} x2={20} y2={6} stroke="#f59e0b" strokeWidth={2.5} />
            <text x={24} y={10} fontSize={10} fill="currentColor" fillOpacity={0.6}>Actual</text>
            <line x1={60} y1={6} x2={80} y2={6} stroke="#3b82f6" strokeWidth={1.5}
              strokeDasharray="6 4" strokeOpacity={0.6} />
            <text x={84} y={10} fontSize={10} fill="currentColor" fillOpacity={0.6}>Ideal</text>
          </g>
        </svg>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {total} tasks from {fmtDate(start)} to {fmtDate(end)}.
        {" "}Burndown tracks task completions — milestones excluded.
      </p>
    </div>
  );
}
