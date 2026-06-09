"use client";

import * as React from "react";
import Link from "next/link";
import {
  addMonths,
  differenceInDays,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { ProjectStatusBadge } from "@/components/badges";
import { Progress } from "@/components/ui/progress";

type ProjectRow = {
  id: string;
  name: string;
  key: string;
  color: string;
  status: string;
  priority: string;
  startDate: Date | string | null;
  endDate: Date | string | null;
  entity?: string | null;
  department: string | null;
  projectManager?: { name: string | null } | null;
  tasks: { status: string; progress: number }[];
};

const MONTH_WIDTH = 80; // px per month column
const ROW_HEIGHT = 44;
const LABEL_WIDTH = 220;

export function PortfolioTimeline({ projects }: { projects: ProjectRow[] }) {
  const now = new Date();

  // Determine timeline range
  const dates = projects
    .flatMap((p) => [p.startDate, p.endDate])
    .filter(Boolean)
    .map((d) => (d instanceof Date ? d : new Date(d as string)));
  const minDate = dates.length
    ? new Date(Math.min(...dates.map((d) => d.getTime())))
    : subMonths(now, 1);
  const maxDate = dates.length
    ? new Date(Math.max(...dates.map((d) => d.getTime())))
    : addMonths(now, 11);

  const start = startOfMonth(subMonths(minDate, 1));
  const end = endOfMonth(addMonths(maxDate, 1));

  // Generate month headers
  const months: Date[] = [];
  let cur = start;
  while (cur <= end) {
    months.push(cur);
    cur = addMonths(cur, 1);
  }

  const totalDays = differenceInDays(end, start) || 1;
  const totalWidth = months.length * MONTH_WIDTH;

  function dayX(date: Date | string) {
    const d = differenceInDays(date instanceof Date ? date : new Date(date), start);
    return Math.round((d / totalDays) * totalWidth);
  }

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-lg font-semibold">No projects with timelines</p>
          <p className="text-sm text-muted-foreground">
            Set start and end dates on projects to see them here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto thin-scroll">
        <div style={{ minWidth: LABEL_WIDTH + totalWidth }}>
          {/* Month header row */}
          <div className="flex border-b bg-muted/50 sticky top-0 z-10">
            <div
              className="flex-shrink-0 border-r px-3 py-2 text-xs font-semibold text-muted-foreground"
              style={{ width: LABEL_WIDTH }}
            >
              Project
            </div>
            <div className="relative" style={{ width: totalWidth }}>
              {months.map((m, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full border-r px-2 py-2 text-xs font-medium text-muted-foreground"
                  style={{ left: i * MONTH_WIDTH, width: MONTH_WIDTH }}
                >
                  {format(m, "MMM yy")}
                </div>
              ))}
            </div>
          </div>

          {/* Project rows */}
          {projects.map((p) => {
            const pct =
              p.tasks.length === 0
                ? 0
                : Math.round(
                    p.tasks.reduce(
                      (s, t) =>
                        s + (t.status === "COMPLETED" ? 100 : t.progress),
                      0,
                    ) / p.tasks.length,
                  );

            const barStart = p.startDate ? dayX(p.startDate) : null;
            const barEnd = p.endDate ? dayX(p.endDate) : null;
            const barWidth =
              barStart !== null && barEnd !== null
                ? Math.max(barEnd - barStart, 16)
                : null;

            return (
              <div
                key={p.id}
                className="flex border-b hover:bg-muted/20 transition-colors"
                style={{ height: ROW_HEIGHT }}
              >
                {/* Label */}
                <div
                  className="flex-shrink-0 border-r px-3 flex items-center gap-2"
                  style={{ width: LABEL_WIDTH }}
                >
                  <span
                    className="h-7 w-1 rounded-full flex-shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <Link
                    href={`/projects/${p.id}?view=gantt`}
                    className="min-w-0"
                  >
                    <p className="text-sm font-medium truncate hover:text-primary transition-colors">
                      {p.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {p.projectManager?.name ?? p.department ?? p.key}
                    </p>
                  </Link>
                </div>

                {/* Timeline bar */}
                <div className="relative flex-1" style={{ width: totalWidth }}>
                  {/* Today marker */}
                  {now >= start && now <= end && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-primary/50 z-10"
                      style={{ left: dayX(now.toISOString()) }}
                    />
                  )}

                  {/* Month grid lines */}
                  {months.map((_, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 w-px bg-border/50"
                      style={{ left: i * MONTH_WIDTH }}
                    />
                  ))}

                  {/* Project bar */}
                  {barStart !== null && barWidth !== null && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 rounded-md flex items-center px-2 overflow-hidden text-xs text-white font-medium"
                      style={{
                        left: barStart,
                        width: barWidth,
                        height: 26,
                        backgroundColor: p.color,
                        opacity: p.status === "COMPLETED" ? 0.6 : 1,
                      }}
                    >
                      {barWidth > 60 && (
                        <>
                          <div
                            className="absolute inset-y-0 left-0 rounded-md opacity-30 bg-black"
                            style={{ width: `${pct}%` }}
                          />
                          <span className="relative truncate">{pct}%</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 border-t px-4 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-6 bg-primary/50" />
          <span>Today</span>
        </div>
        <span>Bar fill = completion %</span>
      </div>
    </Card>
  );
}
