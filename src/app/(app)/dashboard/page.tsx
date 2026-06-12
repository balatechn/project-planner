import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { formatDistanceToNow, isPast } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FolderKanban,
  ListTodo,
  Plus,
} from "lucide-react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { projectAccessWhere } from "@/lib/projects";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Sparkline, Donut } from "@/components/dashboard-charts";
import { EmptyState } from "@/components/empty-state";
import { HealthBadge } from "@/components/health-badge";
import { projectHealth } from "@/lib/health";
import { AnnouncementBanner } from "@/components/announcement-banner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  PriorityBadge,
  ProjectStatusBadge,
  TaskStatusBadge,
} from "@/components/badges";
import { AvatarStack } from "@/components/avatar-stack";

export const metadata: Metadata = { title: "Dashboard" };

// Cache the project list per user for 30 s — fast repeat visits, still fresh
const getDashboardData = unstable_cache(
  async (
    userId: string,
    role: string,
    whereJson: string,
  ) => {
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
          owner: { select: { id: true, name: true, image: true } },
          members: {
            select: { user: { select: { id: true, name: true, image: true } } },
          },
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
        take: 8,
      }),
    ]);
    return { projects, recentActivity };
  },
  ["dashboard-data"],
  { revalidate: 30 }, // 30 s cache per user
);

// Per-user task stats — cached 30 s so repeat dashboard visits skip 4 queries
const getUserStats = unstable_cache(
  async (userId: string) => {
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const [myTasks, overdueCount, completedThisWeek, recentCompletions] =
      await Promise.all([
        prisma.task.findMany({
          where: {
            assignees: { some: { userId } },
            status: { not: "COMPLETED" },
          },
          select: {
            id: true,
            title: true,
            priority: true,
            status: true,
            dueDate: true,
            project: { select: { id: true, name: true, color: true } },
          },
          orderBy: [{ dueDate: "asc" }],
          take: 8,
        }),
        prisma.task.count({
          where: {
            assignees: { some: { userId } },
            status: { notIn: ["COMPLETED"] },
            dueDate: { lt: now },
          },
        }),
        prisma.task.count({
          where: {
            assignees: { some: { userId } },
            status: "COMPLETED",
            completedAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
          },
        }),
        prisma.task.findMany({
          where: {
            assignees: { some: { userId } },
            status: "COMPLETED",
            completedAt: { gte: fourteenDaysAgo },
          },
          select: { completedAt: true },
        }),
      ]);

    // Compute the trend inside the cache — plain numbers serialize cleanly
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

    return { myTasks, overdueCount, completedThisWeek, trendPoints };
  },
  ["dashboard-user-stats"],
  { revalidate: 30 },
);

// Announcements rarely change — shared cache across all users, 60 s
const getAnnouncements = unstable_cache(
  async () =>
    prisma.announcement.findMany({
      where: {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true, title: true, body: true, type: true, isPinned: true },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
  ["dashboard-announcements"],
  { revalidate: 60 },
);

export default async function DashboardPage() {
  const user = await requireUser();
  const where = projectAccessWhere(user.id, user.role);

  // Single fully-parallel fetch stage — no query waterfalls
  const [{ projects, recentActivity }, userStats, activeAnnouncements] =
    await Promise.all([
      getDashboardData(user.id, user.role, JSON.stringify(where)),
      getUserStats(user.id),
      getAnnouncements(),
    ]);
  const { myTasks, overdueCount, completedThisWeek, trendPoints } = userStats;

  const activeProjects = projects.length;
  const openTasks = myTasks.length;
  const weekRatio =
    completedThisWeek + openTasks > 0
      ? Math.round((completedThisWeek / (completedThisWeek + openTasks)) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {activeAnnouncements.length > 0 && (
        <AnnouncementBanner announcements={activeAnnouncements} />
      )}

      <PageHeader
        title={`Welcome back, ${user.name?.split(" ")[0] ?? "there"} 👋`}
        description="Here's what's happening across your workspace today."
      >
        <Button asChild variant="brand">
          <Link href="/projects?new=1">
            <Plus /> New Project
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Projects"
          value={activeProjects}
          icon={FolderKanban}
          accent="blue"
        />
        <StatCard
          label="My Open Tasks"
          value={openTasks}
          icon={ListTodo}
          accent="gray"
        />
        <StatCard
          label="Overdue"
          value={overdueCount}
          icon={AlertTriangle}
          accent="red"
          hint="Assigned to you"
        />
        <StatCard
          label="Completed (7d)"
          value={completedThisWeek}
          icon={CheckCircle2}
          accent="green"
        />
      </div>

      {/* ── My productivity: 14-day trend + weekly completion ratio ── */}
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] items-center rounded-xl border bg-card p-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Completion Trend — last 14 days
          </p>
          <div className="mt-3">
            <Sparkline points={trendPoints} />
          </div>
        </div>
        <div className="flex items-center gap-4 sm:border-l sm:pl-6">
          <Donut percent={weekRatio} />
          <div className="space-y-0.5">
            <p className="text-sm font-semibold">This week</p>
            <p className="text-xs text-muted-foreground">
              {completedThisWeek} done · {openTasks} open
            </p>
          </div>
        </div>
      </div>

      {/* ── Microsoft 365 Quick Access ──────────────────────────────── */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-muted-foreground select-none">
          Quick Access
        </span>
        <div className="flex items-center gap-2">

          {/* Outlook */}
          <a
            href="https://outlook.office.com"
            target="_blank"
            rel="noopener noreferrer"
            title="Outlook"
            className="flex h-9 w-9 items-center justify-center rounded-xl shadow-sm transition-transform hover:scale-110 hover:shadow-md"
            style={{ backgroundColor: "#0078D4" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <path d="M20 4H4C2.9 4 2 4.9 2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
            </svg>
          </a>

          {/* OneDrive */}
          <a
            href="https://onedrive.live.com"
            target="_blank"
            rel="noopener noreferrer"
            title="OneDrive"
            className="flex h-9 w-9 items-center justify-center rounded-xl shadow-sm transition-transform hover:scale-110 hover:shadow-md"
            style={{ backgroundColor: "#0364B8" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
            </svg>
          </a>

          {/* Microsoft Teams */}
          <a
            href="https://teams.microsoft.com"
            target="_blank"
            rel="noopener noreferrer"
            title="Microsoft Teams"
            className="flex h-9 w-9 items-center justify-center rounded-xl shadow-sm transition-transform hover:scale-110 hover:shadow-md"
            style={{ backgroundColor: "#6264A7" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <path d="M17 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-9 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zm9.93.19C19.43 14.71 22 15.73 22 18v2h-4v-2c0-1.27-.62-2.36-1.56-3.16A9.16 9.16 0 0 1 17.93 14.19z" />
            </svg>
          </a>

        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Projects */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent Projects</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/projects">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {projects.length === 0 && (
              <EmptyState
                icon={FolderKanban}
                title="No projects yet"
                description="Create your first project to start planning tasks and tracking progress."
                actionLabel="New Project"
                actionHref="/projects?new=1"
                compact
              />
            )}
            {projects.map((p) => {
              const tasks = p.tasks;
              const done = tasks.filter((t) => t.status === "COMPLETED").length;
              const pct =
                tasks.length === 0
                  ? 0
                  : Math.round(
                      tasks.reduce(
                        (s, t) =>
                          s + (t.status === "COMPLETED" ? 100 : t.progress),
                        0,
                      ) / tasks.length,
                    );
              return (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="block rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="mt-0.5 h-9 w-1.5 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.department ?? "—"} · {tasks.length} tasks · {done}{" "}
                          done
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <ProjectStatusBadge status={p.status} />
                      <HealthBadge health={projectHealth(tasks)} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <Progress value={pct} className="h-1.5" />
                    <span className="w-10 text-right text-xs font-medium text-muted-foreground">
                      {pct}%
                    </span>
                    <AvatarStack
                      people={[
                        p.owner,
                        ...p.members.map((m) => m.user),
                      ].filter(Boolean)}
                      max={3}
                      size="h-6 w-6"
                    />
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        {/* Activity feed */}
        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivity.length === 0 && (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            )}
            {recentActivity.map((a) => (
              <div key={a.id} className="flex gap-3 text-sm">
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div>
                  <p>
                    <span className="font-medium">
                      {a.user.name ?? "Someone"}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      {a.action.replace(/\./g, " ").replace(/_/g, " ")}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.project?.name ? `${a.project.name} · ` : ""}
                    {formatDistanceToNow(a.createdAt, { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* My tasks */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>My Tasks</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/my-tasks">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {myTasks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              You have no open tasks. Enjoy the calm. ☕
            </p>
          ) : (
            <div className="divide-y">
              {myTasks.map((t) => {
                const overdue =
                  t.dueDate && isPast(t.dueDate) && t.status !== "COMPLETED";
                return (
                  <Link
                    key={t.id}
                    href={`/projects/${t.project.id}?task=${t.id}`}
                    className="flex items-center justify-between gap-3 py-3 hover:bg-muted/40"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: t.project.color }}
                      />
                      <span className="truncate font-medium">{t.title}</span>
                      <PriorityBadge priority={t.priority} />
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {t.dueDate && (
                        <span
                          className={`flex items-center gap-1 text-xs ${
                            overdue
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }`}
                        >
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(t.dueDate, { addSuffix: true })}
                        </span>
                      )}
                      <TaskStatusBadge status={t.status} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
