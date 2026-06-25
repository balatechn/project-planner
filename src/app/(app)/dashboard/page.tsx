import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { format, formatDistanceToNow, isPast, isToday } from "date-fns";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Car,
  CheckCircle2,
  CheckSquare,
  Clock,
  FolderKanban,
  GraduationCap,
  HelpCircle,
  Layers,
  ListTodo,
  Plus,
  Users,
  Video,
} from "lucide-react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { projectAccessWhere } from "@/lib/projects";
import { HealthBadge } from "@/components/health-badge";
import { projectHealth } from "@/lib/health";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  PriorityBadge,
  ProjectStatusBadge,
  TaskStatusBadge,
} from "@/components/badges";
import { AvatarStack } from "@/components/avatar-stack";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

const getDashboardData = unstable_cache(
  async (userId: string, whereJson: string) => {
    const where = JSON.parse(whereJson);
    const [projects, recentActivity] = await Promise.all([
      prisma.project.findMany({
        where: { ...where, isArchived: false },
        select: {
          id: true, name: true, status: true, color: true, endDate: true,
          owner: { select: { id: true, name: true, image: true } },
          members: { select: { user: { select: { id: true, name: true, image: true } } } },
          tasks: { where: { deletedAt: null }, select: { status: true, progress: true, dueDate: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
      prisma.activity.findMany({
        where: { project: where },
        select: {
          id: true, action: true, createdAt: true,
          user: { select: { name: true } },
          project: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
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
    const [myTasks, overdueCount, completedThisWeek] = await Promise.all([
      prisma.task.findMany({
        where: { assignees: { some: { userId } }, status: { not: "COMPLETED" }, deletedAt: null },
        select: {
          id: true, title: true, priority: true, status: true, dueDate: true,
          project: { select: { id: true, name: true, color: true } },
        },
        orderBy: [{ dueDate: "asc" }],
        take: 12,
      }),
      prisma.task.count({
        where: { assignees: { some: { userId } }, status: { notIn: ["COMPLETED"] }, dueDate: { lt: now }, deletedAt: null },
      }),
      prisma.task.count({
        where: { assignees: { some: { userId } }, status: "COMPLETED", completedAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
      }),
    ]);
    return { myTasks, overdueCount, completedThisWeek };
  },
  ["dashboard-user-stats"],
  { revalidate: 30 },
);

const getAnnouncements = unstable_cache(
  async () =>
    prisma.announcement.findMany({
      where: { isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      select: { id: true, title: true, type: true },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take: 3,
    }),
  ["dashboard-announcements"],
  { revalidate: 60 },
);

function greeting(name: string) {
  const h = new Date().getHours();
  return `${h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"}, ${name} 👋`;
}

function actionLabel(action: string) {
  const m: Record<string, string> = {
    "task.created": "created a task", "task.completed": "completed a task",
    "task.updated": "updated a task", "task.assigned": "assigned a task",
    "project.created": "created a project", "project.updated": "updated a project",
    "comment.created": "added a comment", "file.uploaded": "uploaded a file",
  };
  return m[action] ?? action.replace(/[._]/g, " ");
}

const QUICK: { label: string; href: string; icon: React.ComponentType<{ className?: string }>; bg: string; fg: string; external?: boolean }[] = [
  { label: "Projects",  href: "/projects",       icon: FolderKanban,  bg: "bg-blue-500/10",   fg: "text-blue-600 dark:text-blue-400" },
  { label: "My Tasks",  href: "/my-tasks",        icon: CheckSquare,   bg: "bg-emerald-500/10",fg: "text-emerald-600 dark:text-emerald-400" },
  { label: "Calendar",  href: "/calendar",        icon: CalendarDays,  bg: "bg-violet-500/10", fg: "text-violet-600 dark:text-violet-400" },
  { label: "Training",  href: "/training",        icon: GraduationCap, bg: "bg-amber-500/10",  fg: "text-amber-600 dark:text-amber-400" },
  { label: "Rooms",     href: "/meeting-rooms",   icon: Video,         bg: "bg-indigo-500/10", fg: "text-indigo-600 dark:text-indigo-400" },
  { label: "Sales",     href: "/montra-sales",    icon: Car,           bg: "bg-orange-500/10", fg: "text-orange-600 dark:text-orange-400" },
  { label: "Team",      href: "/team",            icon: Users,         bg: "bg-pink-500/10",   fg: "text-pink-600 dark:text-pink-400" },
  { label: "Reports",   href: "/reports",         icon: BarChart3,     bg: "bg-teal-500/10",   fg: "text-teal-600 dark:text-teal-400" },
];

export default async function DashboardPage() {
  const user = await requireUser();
  const where = projectAccessWhere(user.id, user.role);

  const [{ projects, recentActivity }, { myTasks, overdueCount, completedThisWeek }, announcements] =
    await Promise.all([
      getDashboardData(user.id, JSON.stringify(where)),
      getUserStats(user.id),
      getAnnouncements(),
    ]);

  const firstName = user.name?.split(" ")[0] ?? "there";
  const todayStr = format(new Date(), "EEEE, dd MMM yyyy");
  const tasksDueToday = myTasks.filter((t) => t.dueDate && isToday(new Date(t.dueDate)));

  return (
    <div className="flex h-[calc(100vh-3.5rem-2rem)] lg:h-[calc(100vh-3.5rem-3rem)] flex-col gap-3 overflow-hidden">

      {/* ── Row 1: Header ── */}
      <div className="flex flex-shrink-0 items-center gap-4 rounded-xl border bg-card px-5 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold tracking-tight">{greeting(firstName)}</h1>
          <p className="text-xs text-muted-foreground">
            {todayStr}
            {user.department ? ` · ${user.department}` : ""}
            {" · "}
            <span className="capitalize">{user.role?.toLowerCase().replace("_", " ")}</span>
          </p>
        </div>

        {/* Inline stat pills */}
        <div className="hidden md:flex items-center gap-2">
          {[
            { v: projects.length, label: "Projects", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/8" },
            { v: myTasks.length,  label: "Tasks",    color: "text-foreground",                  bg: "bg-muted/60" },
            { v: overdueCount,    label: "Overdue",  color: "text-red-600 dark:text-red-400",   bg: "bg-red-500/8" },
            { v: completedThisWeek, label: "Done (7d)", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/8" },
          ].map(({ v, label, color, bg }) => (
            <div key={label} className={cn("flex items-baseline gap-1.5 rounded-lg px-3 py-1.5", bg)}>
              <span className={cn("text-xl font-bold leading-none", color)}>{v}</span>
              <span className="text-[11px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        <Button asChild variant="brand" size="sm" className="shrink-0">
          <Link href="/projects?new=1"><Plus className="h-3.5 w-3.5" />New Project</Link>
        </Button>
      </div>

      {/* ── Row 2: Quick access (8 icons, single row) ── */}
      <div className="flex flex-shrink-0 gap-2">
        {QUICK.map((item) => {
          const Icon = item.icon;
          const inner = (
            <div className="group flex flex-1 flex-col items-center gap-1.5 rounded-xl border bg-card px-2 py-2.5 transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/8 dark:hover:shadow-black/30">
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg transition-transform group-hover:scale-110", item.bg, item.fg)}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-medium text-foreground/70 leading-tight">{item.label}</span>
            </div>
          );
          return item.external
            ? <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" className="flex flex-1">{inner}</a>
            : <Link key={item.label} href={item.href} className="flex flex-1">{inner}</Link>;
        })}
      </div>

      {/* ── Row 3: Main (flex-1, no page scroll) ── */}
      <div className="grid min-h-0 flex-1 grid-cols-3 gap-3">

        {/* Left col: Projects */}
        <div className="col-span-2 flex min-h-0 flex-col gap-3">

          <div className="flex min-h-0 flex-1 flex-col rounded-xl border bg-card">
            <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-2.5">
              <p className="text-sm font-semibold">Recent Projects</p>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                <Link href="/projects">View all</Link>
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
              {projects.length === 0 ? (
                <EmptyState icon={FolderKanban} title="No projects yet" description="Create your first project." actionLabel="New Project" actionHref="/projects?new=1" compact />
              ) : (
                <div className="space-y-1.5">
                  {projects.map((p) => {
                    const tasks = p.tasks;
                    const pct = tasks.length === 0 ? 0 : Math.round(
                      tasks.reduce((s, t) => s + (t.status === "COMPLETED" ? 100 : t.progress), 0) / tasks.length,
                    );
                    const overdue = p.endDate && isPast(new Date(p.endDate));
                    return (
                      <Link key={p.id} href={`/projects/${p.id}`}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50">
                        <span className="h-7 w-1 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{p.name}</span>
                            <ProjectStatusBadge status={p.status} />
                            <HealthBadge health={projectHealth(tasks)} />
                            {overdue && <span className="text-[10px] font-bold text-destructive">LATE</span>}
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <Progress value={pct} className="h-1" />
                            <span className="text-[11px] text-muted-foreground shrink-0">{pct}%</span>
                          </div>
                        </div>
                        <AvatarStack
                          people={[p.owner, ...p.members.map((m) => m.user)].filter(Boolean)}
                          max={3} size="h-6 w-6"
                        />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* My Tasks */}
          <div className="flex min-h-0 flex-1 flex-col rounded-xl border bg-card">
            <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-2.5">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">My Tasks</p>
                {tasksDueToday.length > 0 && (
                  <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
                    {tasksDueToday.length} due today
                  </span>
                )}
              </div>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                <Link href="/my-tasks">View all</Link>
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
              {myTasks.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-muted-foreground">No open tasks. Enjoy the calm. ☕</p>
                </div>
              ) : (
                <div className="divide-y">
                  {myTasks.map((t) => {
                    const overdue = t.dueDate && isPast(new Date(t.dueDate));
                    return (
                      <Link key={t.id} href={`/projects/${t.project.id}?task=${t.id}`}
                        className="flex items-center gap-2.5 px-1 py-2 hover:bg-muted/40 transition-colors rounded">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: t.project.color }} />
                        <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                        <PriorityBadge priority={t.priority} />
                        {t.dueDate && (
                          <span className={cn("flex shrink-0 items-center gap-1 text-[11px]", overdue ? "text-destructive" : "text-muted-foreground")}>
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(t.dueDate), { addSuffix: true })}
                          </span>
                        )}
                        <TaskStatusBadge status={t.status} />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right col: Announcements + Activity */}
        <div className="flex min-h-0 flex-col gap-3">

          {/* Announcements (compact, only if exist) */}
          {announcements.length > 0 && (
            <div className="flex-shrink-0 rounded-xl border border-amber-500/30 bg-amber-500/6 px-4 py-3">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Announcements
              </p>
              {announcements.map((a) => (
                <p key={a.id} className="truncate text-xs text-foreground/80">{a.title}</p>
              ))}
              <Link href="/announcements" className="mt-1.5 block text-[10px] text-amber-700 dark:text-amber-400 hover:underline">
                View all →
              </Link>
            </div>
          )}

          {/* Activity */}
          <div className="flex min-h-0 flex-1 flex-col rounded-xl border bg-card">
            <div className="flex-shrink-0 border-b px-4 py-2.5">
              <p className="text-sm font-semibold">Activity</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((a) => (
                    <div key={a.id} className="flex gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <div className="min-w-0">
                        <p className="text-xs leading-snug">
                          <span className="font-medium">{a.user.name?.split(" ")[0] ?? "Someone"}</span>
                          {" "}<span className="text-muted-foreground">{actionLabel(a.action)}</span>
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                          {a.project?.name ? `${a.project.name} · ` : ""}
                          {formatDistanceToNow(a.createdAt, { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
