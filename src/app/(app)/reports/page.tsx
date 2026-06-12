import type { Metadata } from "next";
import { format } from "date-fns";
import { AlertTriangle, BarChart3, CheckCircle2, FolderKanban } from "lucide-react";
import { requireUserWithPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { projectAccessWhere } from "@/lib/projects";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PriorityBadge } from "@/components/badges";
import { ExportButtons } from "./export-buttons";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const user = await requireUserWithPermission("report:view");
  const where = projectAccessWhere(user.id, user.role);

  const [projects, delayedTasks, allTasks, users] = await Promise.all([
    prisma.project.findMany({
      where: { ...where, isArchived: false },
      include: { tasks: { where: { deletedAt: null }, select: { status: true, progress: true } } },
    }),
    prisma.task.findMany({
      where: {
        project: where,
        status: { notIn: ["COMPLETED"] },
        dueDate: { lt: new Date() },
      },
      include: {
        project: { select: { name: true } },
        assignees: { select: { user: { select: { name: true } } } },
      },
      orderBy: { dueDate: "asc" },
      take: 25,
    }),
    prisma.task.findMany({
      where: { project: where },
      select: {
        status: true,
        estimatedHours: true,
        assignees: { select: { userId: true } },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, department: true, weeklyCapacity: true },
    }),
  ]);

  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter((t) => t.status === "COMPLETED").length;
  const overallCompletion =
    totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  // Department-wise rollup
  const deptMap = new Map<
    string,
    { count: number; progressSum: number; taskCount: number }
  >();
  for (const p of projects) {
    const dept = p.department ?? "Unassigned";
    const entry = deptMap.get(dept) ?? {
      count: 0,
      progressSum: 0,
      taskCount: 0,
    };
    const pct =
      p.tasks.length === 0
        ? 0
        : p.tasks.reduce(
            (s, t) => s + (t.status === "COMPLETED" ? 100 : t.progress),
            0,
          ) / p.tasks.length;
    entry.count += 1;
    entry.progressSum += pct;
    entry.taskCount += p.tasks.length;
    deptMap.set(dept, entry);
  }
  const departments = [...deptMap.entries()].map(([dept, v]) => ({
    dept,
    count: v.count,
    avgProgress: Math.round(v.progressSum / v.count),
    taskCount: v.taskCount,
  }));

  // Resource utilization (open tasks per user)
  const loadByUser = new Map<string, number>();
  for (const t of allTasks) {
    if (t.status === "COMPLETED") continue;
    for (const a of t.assignees) {
      loadByUser.set(a.userId, (loadByUser.get(a.userId) ?? 0) + 1);
    }
  }
  const utilization = users
    .map((u) => ({
      name: u.name ?? "—",
      department: u.department ?? "—",
      openTasks: loadByUser.get(u.id) ?? 0,
    }))
    .sort((a, b) => b.openTasks - a.openTasks)
    .slice(0, 12);
  const maxLoad = Math.max(1, ...utilization.map((u) => u.openTasks));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Workspace-wide analytics and exports."
      >
        <ExportButtons />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Projects"
          value={projects.length}
          icon={FolderKanban}
          accent="blue"
        />
        <StatCard
          label="Overall completion"
          value={`${overallCompletion}%`}
          icon={CheckCircle2}
          accent="green"
        />
        <StatCard
          label="Delayed tasks"
          value={delayedTasks.length}
          icon={AlertTriangle}
          accent="red"
        />
        <StatCard
          label="Total tasks"
          value={totalTasks}
          icon={BarChart3}
          accent="gray"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Department-wise */}
        <Card>
          <CardHeader>
            <CardTitle>Department-wise progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {departments.length === 0 && (
              <p className="text-sm text-muted-foreground">No data.</p>
            )}
            {departments.map((d) => (
              <div key={d.dept}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium">{d.dept}</span>
                  <span className="text-muted-foreground">
                    {d.count} projects · {d.avgProgress}%
                  </span>
                </div>
                <Progress value={d.avgProgress} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Resource utilization */}
        <Card>
          <CardHeader>
            <CardTitle>Resource utilization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {utilization.map((u) => (
              <div key={u.name} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-sm">{u.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full brand-gradient"
                    style={{ width: `${(u.openTasks / maxLoad) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-sm font-medium">
                  {u.openTasks}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Delayed task report */}
      <Card>
        <CardHeader>
          <CardTitle>Delayed tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {delayedTasks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No delayed tasks. 🎉
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Task</th>
                    <th className="pb-2 font-medium">Project</th>
                    <th className="pb-2 font-medium">Assignees</th>
                    <th className="pb-2 font-medium">Priority</th>
                    <th className="pb-2 text-right font-medium">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {delayedTasks.map((t) => (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="py-2.5 font-medium">{t.title}</td>
                      <td className="py-2.5 text-muted-foreground">
                        {t.project.name}
                      </td>
                      <td className="py-2.5 text-muted-foreground">
                        {t.assignees.map((a) => a.user.name).join(", ") || "—"}
                      </td>
                      <td className="py-2.5">
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td className="py-2.5 text-right text-destructive">
                        {t.dueDate ? format(t.dueDate, "MMM d, yyyy") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
