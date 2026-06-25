import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { formatDistanceToNow, isPast, isToday } from "date-fns";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  FolderKanban,
  ListTodo,
  Plus,
  Target,
  Users,
  Video,
  Zap,
} from "lucide-react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { projectAccessWhere } from "@/lib/projects";
import { StatCard } from "@/components/stat-card";
import { Sparkline, Donut } from "@/components/dashboard-charts";
import { EmptyState } from "@/components/empty-state";
import { HealthBadge } from "@/components/health-badge";
import { projectHealth } from "@/lib/health";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { DashboardQuickAccess } from "@/components/dashboard-quick-access";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  PriorityBadge,
  ProjectStatusBadge,
  TaskStatusBadge,
} from "@/components/badges";
import { AvatarStack } from "@/components/avatar-stack";

export const metadata: Metadata = { title: "Dashboard" };

const getDashboardData = unstable_cache(
  async (userId: string, role: string, whereJson: string) => {
    const where = JSON.parse(whereJson);
    const [projects, recentActivity] = await Promise.all([
      prisma.project.findMany({
        where: { ...where, isArchived: false },
        select: {
          id: true,
          name: true,
          key: true,
          department: true,
          status: true,
          color: true,
          endDate: true,
          owner: { select: { id: true, name: true, image: true } },
          members: { select: { user: { select: { id: true, name: true, image: true } } } },
          tasks: { where: { deletedAt: null }, select: { status: true, progress: true, dueDate: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
      prisma.activity.findMany({
        where: { project: where },
        select: {
          id: true,
          action: true,
          createdAt: true,
          user: { select: { name: true, image: true } },
          project: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);
    return { projects, recentActivity };
  },
  ["dashboard-data"],
  { revalidate: 30 },
);

const getUserStats = unstable_cache(
  async (userId: string) => {
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const [myTasks, overdueCount, completedThisWeek, recentCompletions, priorityCount] =
      await Promise.all([
        prisma.task.findMany({
          where: { assignees: { some: { userId } }, status: { not: "COMPLETED" }, deletedAt: null },
          select: {
            id: true, title: true, priority: true, status: true, dueDate: true,
            project: { select: { id: true, name: true, color: true } },
          },
          orderBy: [{ dueDate: "asc" }],
          take: 10,
        }),
        prisma.task.count({
          where: { assignees: { some: { userId } }, status: { notIn: ["COMPLETED"] }, dueDate: { lt: now }, deletedAt: null },
        }),
        prisma.task.count({
          where: { assignees: { some: { userId } }, status: "COMPLETED", completedAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
        }),
        prisma.task.findMany({
          where: { assignees: { some: { userId } }, status: "COMPLETED", completedAt: { gte: fourteenDaysAgo } },
          select: { completedAt: true },
        }),
        prisma.task.count({
          where: { assignees: { some: { userId } }, status: { notIn: ["COMPLETED"] }, priority: { in: ["HIGH", "CRITICAL"] }, deletedAt: null },
        }),
      ]);

    const trendPoints: number[] = Array.from({ length: 14 }, (_, i) => {
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - (13 - i));
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      return recentCompletions.filter(
        (t) => t.completedAt && t.completedAt >= dayStart && t.completedAt < dayEnd,
      ).length;
    });

    return { myTasks, overdueCount, completedThisWeek, trendPoints, priorityCount };
  },
  ["dashboard-user-stats"],
  { revalidate: 30 },
);

const getAnnouncements = unstable_cache(
  async () =>
    prisma.announcement.findMany({
      where: { isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      select: { id: true, title: true, body: true, type: true, isPinned: true },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
  ["dashboard-announcements"],
  { revalidate: 60 },
);

const getWorkspaceStats = unstable_cache(
  async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const [teamSize, todayMeetings] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.roomBooking.count({
        where: { startTime: { gte: today, lt: tomorrow }, status: { not: "CANCELLED" } },
      }),
    ]);
    return { teamSize, todayMeetings };
  },
  ["dashboard-workspace"],
  { revalidate: 120 },
);

function getGreeting(name: string) {
  const hour = new Date().getHours();
  const prefix = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return `${prefix}, ${name} 👋`;
}

function activityLabel(action: string) {
  const map: Record<string, string> = {
    "task.created": "created a task",
    "task.completed": "completed a task",
    "task.updated": "updated a task",
    "task.assigned": "assigned a task",
    "project.created": "created a project",
    "project.updated": "updated a project",
    "comment.created": "added a comment",
    "file.uploaded": "uploaded a file",
  };
  return map[action] ?? action.replace(/\./g, " ").replace(/_/g, " ");
}

export default async function DashboardPage() {
  const user = await requireUser();
  const where = projectAccessWhere(user.id, user.role);

  const [{ projects, recentActivity }, userStats, activeAnnouncements, workspaceStats] =
    await Promise.all([
      getDashboardData(user.id, user.role, JSON.stringify(where)),
      getUserStats(user.id),
      getAnnouncements(),
      getWorkspaceStats(),
    ]);

  const { myTasks, overdueCount, completedThisWeek, trendPoints, priorityCount } = userStats;
  const { teamSize, todayMeetings } = workspaceStats;

  const activeProjects = projects.length;
  const openTasks = myTasks.length;
  const weekRatio =
    completedThisWeek + openTasks > 0
      ? Math.round((completedThisWeek / (completedThisWeek + openTasks)) * 100)
      : 0;

  const tasksDueToday = myTasks.filter((t) => t.dueDate && isToday(new Date(t.dueDate)));
  const highPriorityTasks = myTasks.filter((t) => t.priority === "HIGH" || t.priority === "CRITICAL");

  const firstName = user.name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6 pb-8">
      {activeAnnouncements.length > 0 && (
        <AnnouncementBanner announcements={activeAnnouncements} />
      )}

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {getGreeting(firstName)}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Here&apos;s your workspace at a glance.
            </span>
            {user.department && (
              <Badge variant="secondary" className="text-xs">{user.department}</Badge>
            )}
            <Badge variant="outline" className="text-xs capitalize">
              {user.role?.toLowerCase().replace("_", " ")}
            </Badge>
          </div>
        </div>
        <Button asChild variant="brand" className="shrink-0">
          <Link href="/projects?new=1">
            <Plus className="h-4 w-4" />
            New Project
          </Link>
        </Button>
      </div>

      {/* ── KPI Cards (2 rows × 4) ── */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <StatCard label="Active Projects"  value={activeProjects}      icon={FolderKanban}   accent="blue"  />
        <StatCard label="Open Tasks"       value={openTasks}           icon={ListTodo}       accent="gray"  />
        <StatCard label="Overdue"          value={overdueCount}        icon={AlertTriangle}  accent="red"   hint="Assigned to you" />
        <StatCard label="Completed (7d)"   value={completedThisWeek}   icon={CheckCircle2}   accent="green" />
        <StatCard label="Completion Rate"  value={`${weekRatio}%`}     icon={Target}         accent="blue"  hint="This week" />
        <StatCard label="Priority Tasks"   value={priorityCount}       icon={Zap}            accent="amber" hint="High + Urgent" />
        <StatCard label="Meetings Today"   value={todayMeetings}       icon={Video}          accent="gray"  />
        <StatCard label="Team Size"        value={teamSize}            icon={Users}          accent="green" hint="Active members" />
      </div>

      {/* ── Quick Access Grid ── */}
      <DashboardQuickAccess />

      {/* ── Trend + projects + activity ── */}
      <div className="grid gap-4 items-stretch lg:grid-cols-3">

        {/* 14-day trend chart */}
        <div className="flex items-center gap-4 rounded-xl border bg-card p-5 lg:col-span-1">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Completion — 14 days
            </p>
            <div className="mt-3">
              <Sparkline points={trendPoints} />
            </div>
          </div>
          <div className="flex items-center gap-3 border-l pl-4 shrink-0">
            <Donut percent={weekRatio} />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">This week</p>
              <p className="text-xs text-muted-foreground">{completedThisWeek} done</p>
              <p className="text-xs text-muted-foreground">{openTasks} open</p>
            </div>
          </div>
        </div>

        {/* Recent projects */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Recent Projects</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/projects">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {projects.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title="No projects yet"
                description="Create your first project to start planning."
                actionLabel="New Project"
                actionHref="/projects?new=1"
                compact
              />
            ) : (
              projects.slice(0, 4).map((p) => {
                const tasks = p.tasks;
                const done = tasks.filter((t) => t.status === "COMPLETED").length;
                const pct = tasks.length === 0 ? 0 : Math.round(
                  tasks.reduce((s, t) => s + (t.status === "COMPLETED" ? 100 : t.progress), 0) / tasks.length,
                );
                const overdue = p.endDate && isPast(new Date(p.endDate));
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <span className="mt-0.5 h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{p.name}</p>
                        <ProjectStatusBadge status={p.status} />
                        <HealthBadge health={projectHealth(tasks)} />
                        {overdue && (
                          <span className="text-[10px] font-semibold text-destructive">OVERDUE</span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Progress value={pct} className="h-1" />
                        <span className="text-xs text-muted-foreground shrink-0">{pct}%</span>
                        <span className="text-xs text-muted-foreground shrink-0">{done}/{tasks.length}</span>
                      </div>
                    </div>
                    <AvatarStack
                      people={[p.owner, ...p.members.map((m) => m.user)].filter(Boolean)}
                      max={3}
                      size="h-6 w-6"
                    />
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Productivity + Activity ── */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Today's tasks */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Due Today
              {tasksDueToday.length > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{tasksDueToday.length}</Badge>
              )}
            </CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-xs h-7">
              <Link href="/my-tasks">All tasks</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {tasksDueToday.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No tasks due today 🎉</p>
            ) : (
              <div className="space-y-2">
                {tasksDueToday.slice(0, 5).map((t) => (
                  <Link
                    key={t.id}
                    href={`/projects/${t.project.id}?task=${t.id}`}
                    className="flex items-center gap-2 rounded-lg p-2 hover:bg-muted/50 transition-colors"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: t.project.color }} />
                    <span className="flex-1 min-w-0 truncate text-sm">{t.title}</span>
                    <PriorityBadge priority={t.priority} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Priority tasks */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              High Priority
              {highPriorityTasks.length > 0 && (
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] px-1.5 py-0 border-0">
                  {highPriorityTasks.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {highPriorityTasks.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No priority tasks 👍</p>
            ) : (
              <div className="space-y-2">
                {highPriorityTasks.slice(0, 5).map((t) => {
                  const overdue = t.dueDate && isPast(new Date(t.dueDate));
                  return (
                    <Link
                      key={t.id}
                      href={`/projects/${t.project.id}?task=${t.id}`}
                      className="flex items-center gap-2 rounded-lg p-2 hover:bg-muted/50 transition-colors"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: t.project.color }} />
                      <span className="flex-1 min-w-0 truncate text-sm">{t.title}</span>
                      {overdue && <span className="text-[10px] font-semibold text-destructive shrink-0">LATE</span>}
                      <TaskStatusBadge status={t.status} />
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity feed */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.slice(0, 7).map((a) => (
                  <div key={a.id} className="flex gap-2.5 text-xs">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0">
                      <p className="leading-snug">
                        <span className="font-semibold">{a.user.name?.split(" ")[0] ?? "Someone"}</span>
                        {" "}
                        <span className="text-muted-foreground">{activityLabel(a.action)}</span>
                      </p>
                      <p className="text-muted-foreground/70 mt-0.5">
                        {a.project?.name ? `${a.project.name} · ` : ""}
                        {formatDistanceToNow(a.createdAt, { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── My open tasks (full list, auto-hides when empty) ── */}
      {myTasks.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm">All Open Tasks</CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-xs h-7">
              <Link href="/my-tasks">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {myTasks.map((t) => {
                const overdue = t.dueDate && isPast(new Date(t.dueDate)) && t.status !== "COMPLETED";
                return (
                  <Link
                    key={t.id}
                    href={`/projects/${t.project.id}?task=${t.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 hover:bg-muted/40 rounded-lg px-2 transition-colors"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: t.project.color }} />
                      <span className="truncate text-sm font-medium">{t.title}</span>
                      <PriorityBadge priority={t.priority} />
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {t.dueDate && (
                        <span className={`flex items-center gap-1 text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(t.dueDate), { addSuffix: true })}
                        </span>
                      )}
                      <TaskStatusBadge status={t.status} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
