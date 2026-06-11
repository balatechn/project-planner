"use client";

import * as React from "react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";

type Log = {
  id: string;
  hours: number;
  logDate: string;
  description: string | null;
  task: {
    id: string;
    title: string;
    project: { id: string; name: string; key: string; color: string };
  };
};

function StatCard({ label, value, unit = "h" }: { label: string; value: number; unit?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">
        {value.toFixed(1)}<span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>
      </p>
    </div>
  );
}

export function MyTimesheetsClient({ logs }: { logs: Log[] }) {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const thisWeekHours = logs
    .filter((l) => isWithinInterval(parseISO(l.logDate), { start: weekStart, end: weekEnd }))
    .reduce((s, l) => s + l.hours, 0);

  const thisMonthHours = logs
    .filter((l) => isWithinInterval(parseISO(l.logDate), { start: monthStart, end: monthEnd }))
    .reduce((s, l) => s + l.hours, 0);

  const totalHours = logs.reduce((s, l) => s + l.hours, 0);

  // Group by project for project summary
  const byProject = React.useMemo(() => {
    const map = new Map<string, { project: Log["task"]["project"]; hours: number }>();
    for (const l of logs) {
      const key = l.task.project.id;
      const existing = map.get(key);
      if (existing) {
        existing.hours += l.hours;
      } else {
        map.set(key, { project: l.task.project, hours: l.hours });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.hours - a.hours);
  }, [logs]);

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="My Timesheets"
        description="Track hours logged across your tasks and projects"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="This Week" value={thisWeekHours} />
        <StatCard label="This Month" value={thisMonthHours} />
        <StatCard label="Total Logged" value={totalHours} />
        <StatCard label="Log Entries" value={logs.length} unit="" />
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <Clock className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">No time logs yet</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Log hours on any task from the project workspace to track your time here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Recent logs table */}
          <div className="lg:col-span-2 rounded-xl border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-sm">Recent Entries</h2>
              <span className="text-xs text-muted-foreground">{logs.length} entries</span>
            </div>
            <div className="divide-y overflow-auto max-h-[500px]">
              {logs.map((l) => (
                <div key={l.id} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/40 transition-colors">
                  <div
                    className="mt-0.5 h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: l.task.project.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{l.task.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {l.task.project.key} · {l.task.project.name}
                    </p>
                    {l.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{l.description}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-semibold">{l.hours}h</p>
                    <p className="text-[11px] text-muted-foreground">
                      {format(parseISO(l.logDate), "MMM d")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* By project */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h2 className="font-semibold text-sm">Hours by Project</h2>
            </div>
            <div className="p-4 space-y-3">
              {byProject.map(({ project, hours }) => (
                <div key={project.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: project.color }}
                      />
                      <span className="truncate font-medium">{project.name}</span>
                    </div>
                    <span className="flex-shrink-0 text-xs font-semibold ml-2">{hours.toFixed(1)}h</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (hours / totalHours) * 100)}%`,
                        backgroundColor: project.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
