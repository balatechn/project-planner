import type { Metadata } from "next";
import { requireUserWithPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/constants";

export const metadata: Metadata = { title: "Team Workload" };

export default async function TeamPage() {
  await requireUserWithPermission("report:view");

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      department: true,
      jobTitle: true,
      weeklyCapacity: true,
      assignedTasks: {
        where: { task: { status: { notIn: ["COMPLETED"] } } },
        select: { task: { select: { estimatedHours: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  const enriched = users
    .map((u) => {
      const openTasks = u.assignedTasks.length;
      const estHours = u.assignedTasks.reduce(
        (s, a) => s + (a.task.estimatedHours ?? 0),
        0,
      );
      const utilization = u.weeklyCapacity
        ? Math.min(150, Math.round((estHours / u.weeklyCapacity) * 100))
        : 0;
      return { ...u, openTasks, estHours, utilization };
    })
    .sort((a, b) => b.openTasks - a.openTasks);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Workload"
        description="Open task load and capacity utilization per team member."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {enriched.map((u) => {
          const over = u.utilization > 100;
          return (
            <Card key={u.id}>
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <Avatar className="h-10 w-10">
                  {u.image && <AvatarImage src={u.image} alt="" />}
                  <AvatarFallback>{initials(u.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <CardTitle className="truncate text-base">
                    {u.name ?? u.email}
                  </CardTitle>
                  <p className="truncate text-xs text-muted-foreground">
                    {u.jobTitle ?? ROLE_LABELS[u.role]} · {u.department ?? "—"}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Open tasks</span>
                  <Badge variant="secondary">{u.openTasks}</Badge>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      Capacity ({u.estHours}h / {u.weeklyCapacity}h)
                    </span>
                    <span
                      className={over ? "font-medium text-destructive" : ""}
                    >
                      {u.utilization}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={over ? "h-full bg-destructive" : "h-full brand-gradient"}
                      style={{ width: `${Math.min(100, u.utilization)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
