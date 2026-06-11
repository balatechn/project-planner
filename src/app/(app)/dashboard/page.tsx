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
          tasks: { select: { status: true, progress: true } },
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

export default async function DashboardPage() {
  const user = await requireUser();
  const where = projectAccessWhere(user.id, user.role);

  // Per-user real-time task counts run fresh every request (cheap queries)
  const now = new Date();
  const [{ projects, recentActivity }, myTasks, overdueCount, completedThisWeek, activeAnnouncements] =
    await Promise.all([
      getDashboardData(user.id, user.role, JSON.stringify(where)),
      prisma.task.findMany({
        where: {
          assignees: { some: { userId: user.id } },
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
          assignees: { some: { userId: user.id } },
          status: { notIn: ["COMPLETED"] },
          dueDate: { lt: new Date() },
        },
      }),
      prisma.task.count({
        where: {
          assignees: { some: { userId: user.id } },
          status: "COMPLETED",
          completedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.announcement.findMany({
        where: {
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: { id: true, title: true, body: true, type: true, isPinned: true },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        take: 5,
      }),
    ]);

  const activeProjects = projects.length;
  const openTasks = myTasks.length;

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
              <p className="py-8 text-center text-sm text-muted-foreground">
                No projects yet. Create your first project to get started.
              </p>
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
                    <ProjectStatusBadge status={p.status} />
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
