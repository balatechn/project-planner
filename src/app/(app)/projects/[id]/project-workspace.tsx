"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  CalendarDays,
  GanttChartSquare,
  KanbanSquare,
  LayoutList,
  MoreVertical,
  Plus,
  Trash2,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import {
  PriorityBadge,
  ProjectStatusBadge,
} from "@/components/badges";
import { AvatarStack } from "@/components/avatar-stack";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { TaskListView } from "@/components/tasks/task-list-view";
import { GanttView } from "@/components/tasks/gantt-view";
import { CalendarView } from "@/components/tasks/calendar-view";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { ProjectOverview } from "./project-overview";
import { formatCurrency } from "@/lib/utils";

export function ProjectWorkspace({
  project,
  members,
  allUsers,
  permissions,
  currentUserId,
}: {
  project: ProjectSummary;
  members: Person[];
  allUsers: Person[];
  permissions: WorkspacePermissions;
  currentUserId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [tasks, setTasks] = React.useState<TaskListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [activeTask, setActiveTask] = React.useState<TaskListItem | null>(null);
  const [createStatus, setCreateStatus] = React.useState<TaskStatus>(
    "NOT_STARTED",
  );

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

  // Open a task automatically if ?task=ID is present.
  React.useEffect(() => {
    const taskId = searchParams.get("task");
    if (taskId && tasks.length > 0) {
      const t = tasks.find((x) => x.id === taskId);
      if (t) {
        setActiveTask(t);
        setDialogOpen(true);
      }
    }
  }, [searchParams, tasks]);

  function openCreate(status: TaskStatus) {
    setActiveTask(null);
    setCreateStatus(status);
    setDialogOpen(true);
  }

  function openTask(task: TaskListItem) {
    setActiveTask(task);
    setDialogOpen(true);
  }

  async function moveTask(taskId: string, status: TaskStatus) {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status } : t)),
    );
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadTasks();
  }

  async function archive() {
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
  }

  async function remove() {
    if (!confirm(`Delete project "${project.name}" and all its tasks?`)) return;
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast({ title: "Project deleted", variant: "success" });
      router.push("/projects");
      router.refresh();
    } else {
      toast({ title: "Delete failed", variant: "error" });
    }
  }

  const completed = tasks.filter((t) => t.status === "COMPLETED").length;
  const pct =
    tasks.length === 0
      ? 0
      : Math.round(
          tasks.reduce(
            (s, t) => s + (t.status === "COMPLETED" ? 100 : t.progress),
            0,
          ) / tasks.length,
        );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <span
            className="mt-1 h-12 w-1.5 rounded-full"
            style={{ backgroundColor: project.color }}
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {project.name}
              </h1>
              <ProjectStatusBadge status={project.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {project.key} · {project.department ?? "No department"} ·{" "}
              {formatCurrency(project.budget, project.currency)}
            </p>
            {project.description && (
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {project.description}
              </p>
            )}
            <div className="mt-3 flex items-center gap-4">
              <PriorityBadge priority={project.priority} />
              <AvatarStack people={members} max={6} size="h-7 w-7" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden w-44 sm:block">
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{pct}%</span>
            </div>
            <Progress value={pct} className="h-1.5" />
            <p className="mt-1 text-xs text-muted-foreground">
              {completed}/{tasks.length} tasks done
            </p>
          </div>
          {permissions.canCreateTask && (
            <Button variant="brand" onClick={() => openCreate("NOT_STARTED")}>
              <Plus /> Add Task
            </Button>
          )}
          {(permissions.canArchive || permissions.canDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {permissions.canArchive && (
                  <DropdownMenuItem onClick={archive}>
                    <Archive className="h-4 w-4" />
                    {project.isArchived ? "Restore project" : "Archive project"}
                  </DropdownMenuItem>
                )}
                {permissions.canDelete && (
                  <DropdownMenuItem
                    onClick={remove}
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
      <Tabs defaultValue="board">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="board">
            <KanbanSquare /> Board
          </TabsTrigger>
          <TabsTrigger value="list">
            <LayoutList /> List
          </TabsTrigger>
          <TabsTrigger value="gantt">
            <GanttChartSquare /> Gantt
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <CalendarDays /> Calendar
          </TabsTrigger>
        </TabsList>

        {loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Loading tasks…
          </p>
        ) : (
          <>
            <TabsContent value="overview">
              <ProjectOverview project={project} tasks={tasks} members={members} />
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
            <TabsContent value="gantt">
              <GanttView tasks={tasks} onOpenTask={openTask} />
            </TabsContent>
            <TabsContent value="calendar">
              <CalendarView tasks={tasks} onOpenTask={openTask} />
            </TabsContent>
          </>
        )}
      </Tabs>

      <TaskDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          if (searchParams.get("task"))
            router.replace(`/projects/${project.id}`);
        }}
        task={activeTask}
        defaultStatus={createStatus}
        projectId={project.id}
        users={allUsers}
        siblingTasks={tasks}
        permissions={permissions}
        onSaved={loadTasks}
      />
    </div>
  );
}
