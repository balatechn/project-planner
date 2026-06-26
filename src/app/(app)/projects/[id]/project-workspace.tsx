"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  CalendarDays,
  ClipboardList,
  Flag,
  GanttChartSquare,
  KanbanSquare,
  LayoutList,
  MoreVertical,
  Pencil,
  Plus,
  Timer,
  TrendingDown,
  Trash2,
  UserPlus,
  Zap,
} from "lucide-react";
import type { TaskStatus } from "@prisma/client";
import type {
  Person,
  ProjectSummary,
  TaskListItem,
  WorkspacePermissions,
} from "@/types/app";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ManageMembersDialog } from "./manage-members-dialog";
import { EditProjectDialog } from "./edit-project-dialog";
import { PriorityBadge, ProjectStatusBadge } from "@/components/badges";
import { AvatarStack } from "@/components/avatar-stack";
import { formatCurrency } from "@/lib/utils";

// ── Heavy views loaded lazily so the initial JS bundle stays small ─────────
const TabSkeleton = () => (
  <div className="mt-4 space-y-3">
    {Array.from({ length: 6 }).map((_, i) => (
      <Skeleton key={i} className="h-10 w-full rounded-lg" />
    ))}
  </div>
);

const GanttView = dynamic(
  () => import("@/components/tasks/gantt-view").then((m) => ({ default: m.GanttView })),
  { loading: () => <TabSkeleton />, ssr: false },
);
const KanbanBoard = dynamic(
  () => import("@/components/tasks/kanban-board").then((m) => ({ default: m.KanbanBoard })),
  { loading: () => <TabSkeleton />, ssr: false },
);
const TaskListView = dynamic(
  () => import("@/components/tasks/task-list-view").then((m) => ({ default: m.TaskListView })),
  { loading: () => <TabSkeleton />, ssr: false },
);
const CalendarView = dynamic(
  () => import("@/components/tasks/calendar-view").then((m) => ({ default: m.CalendarView })),
  { loading: () => <TabSkeleton />, ssr: false },
);
const TaskDialog = dynamic(
  () => import("@/components/tasks/task-dialog").then((m) => ({ default: m.TaskDialog })),
  { ssr: false },
);
const ProjectOverview = dynamic(
  () => import("./project-overview").then((m) => ({ default: m.ProjectOverview })),
  { loading: () => <TabSkeleton />, ssr: false },
);
const SprintView = dynamic(
  () => import("./sprint-view").then((m) => ({ default: m.SprintView })),
  { loading: () => <TabSkeleton />, ssr: false },
);
const RiskRegister = dynamic(
  () => import("./risk-register").then((m) => ({ default: m.RiskRegister })),
  { loading: () => <TabSkeleton />, ssr: false },
);
const MeetingNotes = dynamic(
  () => import("./meeting-notes").then((m) => ({ default: m.MeetingNotes })),
  { loading: () => <TabSkeleton />, ssr: false },
);
const BurndownChart = dynamic(
  () => import("@/components/tasks/burndown-chart").then((m) => ({ default: m.BurndownChart })),
  { loading: () => <TabSkeleton />, ssr: false },
);

// ── Task loading skeleton (shown while fetch is in-flight) ─────────────────
function WorkspaceSkeleton() {
  return (
    <div className="mt-4 space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border px-4 py-3">
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-4 flex-1 max-w-[320px]" />
          <Skeleton className="ml-auto h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────
export function ProjectWorkspace({
  project,
  members,
  memberOnlyIds = [],
  allUsers,
  canManageMembers = false,
  projectManagerId = null,
  masters = { entities: [], departments: [], locations: [] },
  permissions,
  currentUserId,
  defaultView = "gantt",
  initialTaskId = null,
}: {
  project: ProjectSummary;
  members: Person[];
  /** Explicit ProjectMember ids (without owner/PM) for the manage dialog */
  memberOnlyIds?: string[];
  allUsers: Person[];
  canManageMembers?: boolean;
  projectManagerId?: string | null;
  masters?: { entities: string[]; departments: string[]; locations: string[] };
  permissions: WorkspacePermissions;
  currentUserId: string;
  defaultView?: string;
  initialTaskId?: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [tasks, setTasks] = React.useState<TaskListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [activeTask, setActiveTask] = React.useState<TaskListItem | null>(null);
  const [createStatus, setCreateStatus] = React.useState<TaskStatus>("NOT_STARTED");
  const [membersOpen, setMembersOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);

  // ── Memoised derived stats ────────────────────────────────────────────────
  const { completed, pct } = React.useMemo(() => {
    const done = tasks.filter((t) => t.status === "COMPLETED").length;
    const p =
      tasks.length === 0
        ? 0
        : Math.round(
            tasks.reduce(
              (s, t) => s + (t.status === "COMPLETED" ? 100 : t.progress),
              0,
            ) / tasks.length,
          );
    return { completed: done, pct: p };
  }, [tasks]);

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadTasks = React.useCallback(async () => {
    const res = await fetch(`/api/tasks?projectId=${project.id}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const { tasks } = await res.json();
      setTasks(tasks);
    }
    setLoading(false);
  }, [project.id]);

  React.useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Open a task automatically if initialTaskId prop is set (from ?task= URL param).
  const didAutoOpen = React.useRef(false);
  React.useEffect(() => {
    if (didAutoOpen.current) return;
    if (initialTaskId && tasks.length > 0) {
      const t = tasks.find((x) => x.id === initialTaskId);
      if (t) {
        setActiveTask(t);
        setDialogOpen(true);
        didAutoOpen.current = true;
      }
    }
  }, [initialTaskId, tasks]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openCreate = React.useCallback((status: TaskStatus) => {
    setActiveTask(null);
    setCreateStatus(status);
    setDialogOpen(true);
  }, []);

  const openTask = React.useCallback((task: TaskListItem) => {
    setActiveTask(task);
    setDialogOpen(true);
  }, []);

  // Optimistic move with silent background sync
  const moveTask = React.useCallback(
    async (taskId: string, status: TaskStatus) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status } : t)),
      );
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      // Silent refresh — no spinner, just reconcile
      const res = await fetch(`/api/tasks?projectId=${project.id}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const { tasks: fresh } = await res.json();
        setTasks(fresh);
      }
    },
    [project.id],
  );

  const archive = React.useCallback(async () => {
    const res = await fetch(`/api/projects/${project.id}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !project.isArchived }),
    });
    if (res.ok) {
      toast({
        title: project.isArchived ? "Project restored" : "Project archived",
        variant: "success",
      });
      router.refresh();
    }
  }, [project.id, project.isArchived, router, toast]);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);

  const remove = React.useCallback(async () => {
    const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Project deleted", variant: "success" });
      router.push("/projects");
      router.refresh();
    } else {
      toast({ title: "Delete failed", variant: "error" });
    }
  }, [project.id, router, toast]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Compact single-row header */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b pb-3">
        <span
          className="h-7 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: project.color }}
        />
        <h1 className="text-base font-bold tracking-tight">{project.name}</h1>
        <ProjectStatusBadge status={project.status} />
        <span className="hidden text-xs text-muted-foreground sm:inline">{project.key}</span>
        {project.department && (
          <span className="hidden text-xs text-muted-foreground sm:inline">
            · {project.department}
          </span>
        )}
        {project.location && (
          <span className="hidden text-xs text-muted-foreground sm:inline">
            · 📍 {project.location}
          </span>
        )}
        <PriorityBadge priority={project.priority} />
        <AvatarStack people={members} max={5} size="h-6 w-6" />
        {canManageMembers && (
          <button
            type="button"
            onClick={() => setMembersOpen(true)}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            title="Manage members"
          >
            <UserPlus className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Right side: progress + actions */}
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-2 md:flex">
            <Progress value={pct} className="h-1.5 w-24" />
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {pct}% · {completed}/{tasks.length} tasks
            </span>
          </div>
          {permissions.canCreateTask && (
            <Button variant="brand" size="sm" onClick={() => openCreate("NOT_STARTED")}>
              <Plus className="h-4 w-4" /> Add Task
            </Button>
          )}
          {(permissions.canEditProject || permissions.canArchive || permissions.canDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {permissions.canEditProject && (
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>
                    <Pencil className="h-4 w-4" /> Edit project
                  </DropdownMenuItem>
                )}
                {permissions.canArchive && (
                  <DropdownMenuItem onClick={archive}>
                    <Archive className="h-4 w-4" />
                    {project.isArchived ? "Restore project" : "Archive project"}
                  </DropdownMenuItem>
                )}
                {permissions.canDelete && (
                  <DropdownMenuItem
                    onClick={() => setConfirmDeleteOpen(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" /> Delete project
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Views */}
      <Tabs defaultValue={defaultView}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="gantt">
            <GanttChartSquare className="h-3.5 w-3.5" /> Gantt
          </TabsTrigger>
          <TabsTrigger value="board">
            <KanbanSquare className="h-3.5 w-3.5" /> Board
          </TabsTrigger>
          <TabsTrigger value="list">
            <LayoutList className="h-3.5 w-3.5" /> List
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <CalendarDays className="h-3.5 w-3.5" /> Calendar
          </TabsTrigger>
          <TabsTrigger value="sprints">
            <Zap className="h-3.5 w-3.5" /> Sprints
          </TabsTrigger>
          <TabsTrigger value="risks">
            <AlertTriangle className="h-3.5 w-3.5" /> Risks
          </TabsTrigger>
          <TabsTrigger value="meetings">
            <ClipboardList className="h-3.5 w-3.5" /> Meetings
          </TabsTrigger>
          <TabsTrigger value="burndown">
            <TrendingDown className="h-3.5 w-3.5" /> Burndown
          </TabsTrigger>
        </TabsList>

        {loading ? (
          <WorkspaceSkeleton />
        ) : (
          <>
            <TabsContent value="overview">
              <ProjectOverview project={project} tasks={tasks} members={members} />
            </TabsContent>
            <TabsContent value="gantt">
              <GanttView
                tasks={tasks}
                onOpenTask={openTask}
                canCreate={permissions.canCreateTask}
                projectId={project.id}
                allUsers={allUsers}
                onSaved={loadTasks}
              />
            </TabsContent>
            <TabsContent value="board">
              <KanbanBoard
                tasks={tasks}
                canDrag={permissions.canUpdateStatus}
                canCreate={permissions.canCreateTask}
                onOpenTask={openTask}
                onCreateInStatus={openCreate}
                onMoveTask={moveTask}
              />
            </TabsContent>
            <TabsContent value="list">
              <TaskListView tasks={tasks} onOpenTask={openTask} />
            </TabsContent>
            <TabsContent value="calendar">
              <CalendarView tasks={tasks} onOpenTask={openTask} />
            </TabsContent>
            <TabsContent value="sprints">
              <SprintView
                projectId={project.id}
                tasks={tasks}
                allUsers={allUsers}
                permissions={permissions}
                onOpenTask={openTask}
                onSaved={loadTasks}
              />
            </TabsContent>
            <TabsContent value="risks">
              <RiskRegister projectId={project.id} permissions={permissions} />
            </TabsContent>
            <TabsContent value="meetings">
              <MeetingNotes
                projectId={project.id}
                allUsers={allUsers}
                permissions={permissions}
              />
            </TabsContent>
            <TabsContent value="burndown">
              <div className="py-2">
                <BurndownChart project={project} tasks={tasks} />
              </div>
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Task dialog — only mounted when open to keep DOM lean */}
      {dialogOpen && (
        <TaskDialog
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false);
            if (initialTaskId)
              router.replace(`/projects/${project.id}?view=${defaultView}`);
          }}
          task={activeTask}
          defaultStatus={createStatus}
          projectId={project.id}
          users={members}
          siblingTasks={tasks}
          permissions={permissions}
          currentUserId={currentUserId}
          onSaved={loadTasks}
          onOpenSubtask={(id) => {
            const t = tasks.find((x) => x.id === id);
            if (t) {
              setActiveTask(t);
            }
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={`Delete "${project.name}"?`}
        description="The project and all of its tasks, comments and files will be permanently removed. This cannot be undone."
        confirmLabel="Delete project"
        onConfirm={remove}
      />

      {canManageMembers && (
        <ManageMembersDialog
          open={membersOpen}
          onClose={() => setMembersOpen(false)}
          projectId={project.id}
          ownerId={project.owner.id}
          projectManagerId={projectManagerId}
          memberIds={memberOnlyIds}
          allUsers={allUsers}
        />
      )}

      {permissions.canEditProject && (
        <EditProjectDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          project={project}
          projectManagerId={projectManagerId}
          allUsers={allUsers}
          masters={masters}
        />
      )}
    </div>
  );
}
