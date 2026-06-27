import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { format, formatDistanceToNow, isPast, isToday } from "date-fns";
import {
  BarChart3, CalendarDays, CheckSquare, Circle, Cloud, Clock,
  FolderKanban, GraduationCap, Layers, Mail, Plus, Users, Video,
} from "lucide-react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { projectAccessWhere } from "@/lib/projects";
import { HealthBadge } from "@/components/health-badge";
import { projectHealth } from "@/lib/health";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { PriorityBadge, ProjectStatusBadge, TaskStatusBadge } from "@/components/badges";
import { AvatarStack } from "@/components/avatar-stack";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

const getProjects = unstable_cache(
  async (whereJson: string) => {
    const where = JSON.parse(whereJson);
    return prisma.project.findMany({
      where: { ...where, isArchived: false },
      select: {
        id: true, name: true, status: true, color: true, endDate: true,
        owner: { select: { id: true, name: true, image: true } },
        members: { select: { user: { select: { id: true, name: true, image: true } } } },
        tasks: { where: { deletedAt: null }, select: { status: true, progress: true, dueDate: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
    });
  },
  ["dash-projects"],
  { revalidate: 30 },
);

const getActivity = unstable_cache(
  async (whereJson: string) => {
    const where = JSON.parse(whereJson);
    return prisma.activity.findMany({
      where: { project: where },
      select: {
        id: true, action: true, entityType: true, createdAt: true,
        user: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    });
  },
  ["dash-activity"],
  { revalidate: 30 },
);

const getMyTasks = unstable_cache(
  async (userId: string) => {
    const now = new Date();
    const [tasks, overdue, done7d] = await Promise.all([
      prisma.task.findMany({
        where: { assignees: { some: { userId } }, status: { not: "COMPLETED" }, deletedAt: null },
        select: {
          id: true, title: true, priority: true, status: true, dueDate: true,
          project: { select: { id: true, name: true, color: true } },
        },
        orderBy: { dueDate: "asc" },
        take: 15,
      }),
      prisma.task.count({
        where: { assignees: { some: { userId } }, status: { notIn: ["COMPLETED"] }, dueDate: { lt: now }, deletedAt: null },
      }),
      prisma.task.count({
        where: { assignees: { some: { userId } }, status: "COMPLETED", completedAt: { gte: new Date(now.getTime() - 7 * 86400000) } },
      }),
    ]);
    return { tasks, overdue, done7d };
  },
  ["dash-mytasks"],
  { revalidate: 30 },
);

function timeGreeting(name: string) {
  const h = new Date().getHours();
  return `${h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"}, ${name} 👋`;
}

function actionLabel(a: string) {
  return ({
    "task.created":           "created a task",
    "task.completed":         "completed a task",
    "task.updated":           "updated a task",
    "task.assigned":          "assigned a task",
    "project.created":        "created a project",
    "comment.created":        "added a comment",
    "room_booking.created":   "booked a meeting room",
    "room_booking.updated":   "updated a room booking",
    "room_booking.cancelled": "cancelled a room booking",
  } as Record<string, string>)[a] ?? a.replace(/[._]/g, " ");
}

function isRoomActivity(entityType: string | null) {
  return entityType === "room_booking";
}

const SHORTCUTS = [
  { label: "Projects", href: "/projects",                                            icon: FolderKanban,  bg: "bg-blue-500",    external: false },
  { label: "Tasks",    href: "/my-tasks",                                            icon: CheckSquare,   bg: "bg-emerald-500", external: false },
  { label: "Calendar", href: "/calendar",                                            icon: CalendarDays,  bg: "bg-violet-500",  external: false },
  { label: "Training", href: "/training",                                            icon: GraduationCap, bg: "bg-amber-500",   external: false },
  { label: "Rooms",      href: "/meeting-rooms",                                                   icon: Video,   bg: "bg-indigo-500",  external: false },
  { label: "WorkSphere", href: "https://n6co0az1uzf7qcxxsmymtwiy.187.127.134.246.sslip.io",      icon: Layers,  bg: "bg-orange-500",  external: true  },
  { label: "Outlook",    href: "https://outlook.office365.com",                                   icon: Mail,    bg: "bg-sky-500",     external: true  },
  { label: "Team",     href: "/team",                                                icon: Users,         bg: "bg-pink-500",    external: false },
  { label: "OneDrive", href: "https://nationalconsultingindia-my.sharepoint.com/",   icon: Cloud,         bg: "bg-teal-500",    external: true  },
];

export default async function DashboardPage() {
  const user = await requireUser();
  const whereJson = JSON.stringify(projectAccessWhere(user.id, user.role));

  const [projects, activity, { tasks: myTasks, overdue, done7d }] = await Promise.all([
    getProjects(whereJson),
    getActivity(whereJson),
    getMyTasks(user.id),
  ]);

  const firstName = user.name?.split(" ")[0] ?? "there";
  const dueToday = myTasks.filter((t) => t.dueDate && isToday(new Date(t.dueDate)));

  return (
    <div className="flex h-[calc(100vh-3.5rem-2rem)] lg:h-[calc(100vh-3.5rem-3rem)] w-full flex-col gap-2 overflow-hidden">

      {/* ── 1. Header bar — Admin / PM only ────────────────────────── */}
      {user.role !== "TEAM_MEMBER" && user.role !== "VIEWER" && (
        <div className="flex flex-shrink-0 items-center gap-3 rounded-xl border bg-card px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold tracking-tight leading-tight">
              {timeGreeting(firstName)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {format(new Date(), "EEEE, dd MMM yyyy")}
              {user.department ? ` · ${user.department}` : ""}
              {" · "}<span className="capitalize">{user.role?.toLowerCase().replace("_", " ")}</span>
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {([
              { v: projects.length, l: "Projects", c: "text-blue-600",   b: "bg-blue-500/10" },
              { v: myTasks.length,  l: "Tasks",    c: "text-foreground", b: "bg-muted/60" },
              { v: overdue,         l: "Overdue",  c: "text-red-600",    b: "bg-red-500/10" },
              { v: done7d,          l: "Done (7d)",c: "text-emerald-600",b: "bg-emerald-500/10" },
            ] as const).map(({ v, l, c, b }) => (
              <div key={l} className={cn("flex items-baseline gap-1 rounded-lg px-2.5 py-1", b)}>
                <span className={cn("text-lg font-bold leading-none", c)}>{v}</span>
                <span className="text-[10px] text-muted-foreground hidden sm:inline">{l}</span>
              </div>
            ))}
          </div>

          <Button asChild variant="brand" size="sm" className="shrink-0 h-8 text-xs px-3">
            <Link href="/projects?new=1"><Plus className="h-3 w-3 mr-1" />New Project</Link>
          </Button>
        </div>
      )}

      {/* ── 2. Shortcuts row ───────────────────────────────────────── */}
      <div className="grid flex-shrink-0 grid-cols-9 gap-2">
        {SHORTCUTS.map(({ label, href, icon: Icon, bg, external }) => (
          <Link
            key={label}
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="group flex flex-col items-center gap-1.5 rounded-xl py-3 neu-card transition-all hover:-translate-y-0.5"
          >
            <div className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl shadow-md transition-transform group-hover:scale-110",
              bg,
            )}>
              <Icon className="h-4.5 w-4.5 text-white" strokeWidth={2} />
            </div>
            <span className="text-[10px] font-semibold text-foreground/75 tracking-wide">{label}</span>
          </Link>
        ))}
      </div>

      {/* ── 3. Main grid ───────────────────────────────────────────── */}
      {user.role === "TEAM_MEMBER" || user.role === "VIEWER" ? (

        /* ── Team Member layout: Projects left | My Tasks right ──── */
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-2">

          {/* Left 2/3: Recent Projects */}
          <div className="col-span-2 flex min-h-0 flex-col rounded-xl border bg-card">
            <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-2">
              <p className="text-sm font-semibold">Recent Projects</p>
              <Button asChild variant="ghost" size="sm" className="h-6 text-xs px-2">
                <Link href="/projects">View all</Link>
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1.5 thin-scroll">
              {projects.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-muted-foreground">No projects yet.</p>
                </div>
              ) : projects.map((p) => {
                const pct = p.tasks.length === 0 ? 0 : Math.round(
                  p.tasks.reduce((s, t) => s + (t.status === "COMPLETED" ? 100 : t.progress), 0) / p.tasks.length,
                );
                return (
                  <Link key={p.id} href={`/projects/${p.id}`}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50">
                    <span className="h-6 w-1 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="truncate text-sm font-medium">{p.name}</span>
                        <ProjectStatusBadge status={p.status} />
                        <HealthBadge health={projectHealth(p.tasks)} />
                        {p.endDate && isPast(new Date(p.endDate)) && (
                          <span className="text-[10px] font-bold text-destructive">LATE</span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Progress value={pct} className="h-1" />
                        <span className="text-[10px] text-muted-foreground shrink-0">{pct}%</span>
                      </div>
                    </div>
                    <AvatarStack
                      people={[p.owner, ...p.members.map((m) => m.user)].filter(Boolean)}
                      max={3} size="h-5 w-5"
                    />
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right 1/3: My Tasks */}
          <div className="flex min-h-0 flex-col rounded-xl border bg-card">
            <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">My Tasks</p>
                {dueToday.length > 0 && (
                  <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                    {dueToday.length} due today
                  </span>
                )}
              </div>
              <Button asChild variant="ghost" size="sm" className="h-6 text-xs px-2">
                <Link href="/my-tasks">View all</Link>
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1.5 thin-scroll">
              {myTasks.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-muted-foreground">No open tasks. Enjoy the calm. ☕</p>
                </div>
              ) : myTasks.map((t) => {
                const late = t.dueDate && isPast(new Date(t.dueDate));
                return (
                  <Link key={t.id} href={`/projects/${t.project.id}?task=${t.id}`}
                    className="flex items-center gap-2 rounded px-1 py-1.5 transition-colors hover:bg-muted/40">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: t.project.color }} />
                    <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                    <PriorityBadge priority={t.priority} />
                    {t.dueDate && (
                      <span className={cn("flex shrink-0 items-center gap-1 text-[10px]", late ? "text-destructive" : "text-muted-foreground")}>
                        <Clock className="h-2.5 w-2.5" />
                        {formatDistanceToNow(new Date(t.dueDate), { addSuffix: true })}
                      </span>
                    )}
                    <TaskStatusBadge status={t.status} />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

      ) : (

        /* ── Admin / PM layout: Projects+Tasks left | Activity right  */
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-2">

          {/* Left 2/3: projects + tasks */}
          <div className="col-span-2 flex min-h-0 flex-col gap-2">

            {/* Projects */}
            <div className="flex min-h-0 flex-1 flex-col rounded-xl border bg-card">
              <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-2">
                <p className="text-sm font-semibold">Recent Projects</p>
                <Button asChild variant="ghost" size="sm" className="h-6 text-xs px-2">
                  <Link href="/projects">View all</Link>
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1.5 thin-scroll">
                {projects.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-sm text-muted-foreground">No projects yet.</p>
                  </div>
                ) : projects.map((p) => {
                  const pct = p.tasks.length === 0 ? 0 : Math.round(
                    p.tasks.reduce((s, t) => s + (t.status === "COMPLETED" ? 100 : t.progress), 0) / p.tasks.length,
                  );
                  return (
                    <Link key={p.id} href={`/projects/${p.id}`}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50">
                      <span className="h-6 w-1 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="truncate text-sm font-medium">{p.name}</span>
                          <ProjectStatusBadge status={p.status} />
                          <HealthBadge health={projectHealth(p.tasks)} />
                          {p.endDate && isPast(new Date(p.endDate)) && (
                            <span className="text-[10px] font-bold text-destructive">LATE</span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <Progress value={pct} className="h-1" />
                          <span className="text-[10px] text-muted-foreground shrink-0">{pct}%</span>
                        </div>
                      </div>
                      <AvatarStack
                        people={[p.owner, ...p.members.map((m) => m.user)].filter(Boolean)}
                        max={3} size="h-5 w-5"
                      />
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Tasks */}
            <div className="flex min-h-0 flex-1 flex-col rounded-xl border bg-card">
              <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">My Tasks</p>
                  {dueToday.length > 0 && (
                    <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                      {dueToday.length} due today
                    </span>
                  )}
                </div>
                <Button asChild variant="ghost" size="sm" className="h-6 text-xs px-2">
                  <Link href="/my-tasks">View all</Link>
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1.5 thin-scroll">
                {myTasks.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-sm text-muted-foreground">No open tasks. Enjoy the calm. ☕</p>
                  </div>
                ) : myTasks.map((t) => {
                  const late = t.dueDate && isPast(new Date(t.dueDate));
                  return (
                    <Link key={t.id} href={`/projects/${t.project.id}?task=${t.id}`}
                      className="flex items-center gap-2 rounded px-1 py-1.5 transition-colors hover:bg-muted/40">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: t.project.color }} />
                      <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                      <PriorityBadge priority={t.priority} />
                      {t.dueDate && (
                        <span className={cn("flex shrink-0 items-center gap-1 text-[10px]", late ? "text-destructive" : "text-muted-foreground")}>
                          <Clock className="h-2.5 w-2.5" />
                          {formatDistanceToNow(new Date(t.dueDate), { addSuffix: true })}
                        </span>
                      )}
                      <TaskStatusBadge status={t.status} />
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right 1/3: Activity */}
          <div className="flex min-h-0 flex-col rounded-xl border bg-card">
            <div className="flex-shrink-0 border-b px-4 py-2">
              <p className="text-sm font-semibold">Activity</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 thin-scroll">
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : activity.map((a) => {
                const isRoom = isRoomActivity(a.entityType ?? null);
                return (
                  <div key={a.id} className={cn(
                    "flex gap-2 py-1.5 border-b border-border/40 last:border-0",
                    isRoom && "rounded-lg px-2 -mx-2 bg-indigo-500/5",
                  )}>
                    {isRoom ? (
                      <Video className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
                    ) : (
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs leading-snug">
                        <span className="font-medium">{a.user.name?.split(" ")[0] ?? "Someone"}</span>
                        {" "}<span className={isRoom ? "text-indigo-600" : "text-muted-foreground"}>{actionLabel(a.action)}</span>
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                        {a.project?.name ? `${a.project.name} · ` : ""}
                        {formatDistanceToNow(a.createdAt, { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
