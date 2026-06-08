"use client";

import { format } from "date-fns";
import type { Person, ProjectSummary, TaskListItem } from "@/types/app";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  TASK_STATUS_COLORS,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
} from "@/lib/constants";
import { initials } from "@/lib/utils";

export function ProjectOverview({
  project,
  tasks,
  members,
}: {
  project: ProjectSummary;
  tasks: TaskListItem[];
  members: Person[];
}) {
  const byStatus = TASK_STATUS_ORDER.map((status) => ({
    status,
    count: tasks.filter((t) => t.status === status).length,
  }));
  const total = tasks.length || 1;

  // Workload per member
  const workload = members
    .map((m) => ({
      member: m,
      count: tasks.filter((t) =>
        t.assignees.some((a) => a.user.id === m.id),
      ).length,
    }))
    .sort((a, b) => b.count - a.count);
  const maxLoad = Math.max(1, ...workload.map((w) => w.count));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Status breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Stacked bar */}
          <div className="flex h-3 overflow-hidden rounded-full bg-muted">
            {byStatus.map((s) =>
              s.count > 0 ? (
                <div
                  key={s.status}
                  style={{
                    width: `${(s.count / total) * 100}%`,
                    backgroundColor: `hsl(${TASK_STATUS_COLORS[s.status]})`,
                  }}
                  title={`${TASK_STATUS_LABELS[s.status]}: ${s.count}`}
                />
              ) : null,
            )}
          </div>
          <div className="space-y-1.5">
            {byStatus.map((s) => (
              <div
                key={s.status}
                className="flex items-center justify-between text-sm"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor: `hsl(${TASK_STATUS_COLORS[s.status]})`,
                    }}
                  />
                  {TASK_STATUS_LABELS[s.status]}
                </span>
                <span className="font-medium">{s.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team workload</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {workload.length === 0 && (
            <p className="text-sm text-muted-foreground">No members.</p>
          )}
          {workload.map((w) => (
            <div key={w.member.id} className="flex items-center gap-3">
              <Avatar className="h-7 w-7">
                {w.member.image && <AvatarImage src={w.member.image} alt="" />}
                <AvatarFallback className="text-[10px]">
                  {initials(w.member.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{w.member.name}</p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full brand-gradient"
                    style={{ width: `${(w.count / maxLoad) * 100}%` }}
                  />
                </div>
              </div>
              <span className="text-sm font-medium">{w.count}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Detail label="Owner" value={project.owner.name ?? "—"} />
          <Detail
            label="Start date"
            value={
              project.startDate
                ? format(new Date(project.startDate), "MMM d, yyyy")
                : "—"
            }
          />
          <Detail
            label="End date"
            value={
              project.endDate
                ? format(new Date(project.endDate), "MMM d, yyyy")
                : "—"
            }
          />
          <Detail label="Department" value={project.department ?? "—"} />
          <Detail label="Total tasks" value={String(tasks.length)} />
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
