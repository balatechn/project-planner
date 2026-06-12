"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  CornerDownRight,
  ExternalLink,
  FolderKanban,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TASK_STATUS_LABELS } from "@/lib/constants";

type Person = { id: string; name: string | null; image: string | null };
type TaskNode = {
  id: string;
  title: string;
  status: string;
  priority: string;
  progress: number;
  parentId: string | null;
  dueDate: string | null;
  assignees: Person[];
};
type ProjectNode = {
  id: string;
  name: string;
  key: string;
  color: string;
  status: string;
  department: string | null;
  ownerName: string | null;
  tasks: TaskNode[];
};

const STATUS_DOT: Record<string, string> = {
  NOT_STARTED: "bg-zinc-400",
  IN_PROGRESS: "bg-blue-500",
  COMPLETED: "bg-emerald-500",
  ON_HOLD: "bg-amber-500",
  DELAYED: "bg-red-500",
};

export function ExplorerTree({ projects }: { projects: ProjectNode[] }) {
  const [open, setOpen] = React.useState<Set<string>>(new Set());
  const [filter, setFilter] = React.useState("");

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const expandAll = () => {
    const all = new Set<string>();
    projects.forEach((p) => {
      all.add(p.id);
      p.tasks.forEach((t) => all.add(t.id));
    });
    setOpen(all);
  };
  const collapseAll = () => setOpen(new Set());

  const q = filter.trim().toLowerCase();
  const visible = q
    ? projects
        .map((p) => ({
          ...p,
          tasks: p.tasks.filter((t) => t.title.toLowerCase().includes(q)),
        }))
        .filter(
          (p) => p.name.toLowerCase().includes(q) || p.tasks.length > 0,
        )
    : projects;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter projects and tasks…"
          className="h-8 max-w-xs text-sm"
        />
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            <ChevronsUpDown className="h-3.5 w-3.5" /> Expand all
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            <ChevronsDownUp className="h-3.5 w-3.5" /> Collapse all
          </Button>
        </div>
      </div>

      {/* Tree */}
      <div className="rounded-xl border bg-card">
        {visible.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nothing matches &quot;{filter}&quot;
          </p>
        )}
        {visible.map((project) => {
          const isOpen = open.has(project.id) || !!q;
          const topLevel = project.tasks.filter((t) => !t.parentId);
          const done = project.tasks.filter((t) => t.status === "COMPLETED").length;
          return (
            <div key={project.id} className="border-b last:border-b-0">
              {/* Project row */}
              <div
                className="flex cursor-pointer items-center gap-2 px-3 py-2.5 hover:bg-muted/50 transition-colors"
                onClick={() => toggle(project.id)}
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span
                  className="h-5 w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: project.color }}
                />
                <FolderKanban className="h-4 w-4 shrink-0 text-primary" />
                <span className="font-medium text-sm">{project.name}</span>
                <span className="text-xs text-muted-foreground">{project.key}</span>
                {project.department && (
                  <span className="hidden sm:inline text-xs text-muted-foreground">
                    · {project.department}
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                  {done}/{project.tasks.length} done
                </span>
                <Link
                  href={`/projects/${project.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded p-1 text-muted-foreground hover:text-primary transition-colors"
                  title="Open project"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>

              {/* Task rows */}
              {isOpen && (
                <div className="pb-1">
                  {topLevel.length === 0 && (
                    <p className="py-2 pl-12 text-xs text-muted-foreground">No tasks</p>
                  )}
                  {topLevel.map((task) => {
                    const subtasks = project.tasks.filter((t) => t.parentId === task.id);
                    const taskOpen = open.has(task.id) || !!q;
                    return (
                      <div key={task.id}>
                        <TaskRow
                          task={task}
                          projectId={project.id}
                          depth={1}
                          hasChildren={subtasks.length > 0}
                          isOpen={taskOpen}
                          onToggle={() => toggle(task.id)}
                        />
                        {taskOpen &&
                          subtasks.map((sub) => (
                            <TaskRow
                              key={sub.id}
                              task={sub}
                              projectId={project.id}
                              depth={2}
                              hasChildren={false}
                              isOpen={false}
                              onToggle={() => undefined}
                            />
                          ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  projectId,
  depth,
  hasChildren,
  isOpen,
  onToggle,
}: {
  task: TaskNode;
  projectId: string;
  depth: number;
  hasChildren: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const overdue =
    task.dueDate &&
    task.status !== "COMPLETED" &&
    new Date(task.dueDate).getTime() < Date.now();

  return (
    <div
      className={cn(
        "flex items-center gap-2 py-1.5 pr-3 hover:bg-muted/40 transition-colors",
        depth === 1 ? "pl-10" : "pl-16",
      )}
    >
      {hasChildren ? (
        <button onClick={onToggle} className="shrink-0 text-muted-foreground hover:text-foreground">
          {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      ) : depth === 2 ? (
        <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
      ) : (
        <span className="w-3.5 shrink-0" />
      )}
      <span
        className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[task.status] ?? "bg-zinc-400")}
        title={TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS] ?? task.status}
      />
      <Link
        href={`/projects/${projectId}?task=${task.id}`}
        className={cn(
          "truncate text-sm hover:text-primary transition-colors",
          task.status === "COMPLETED" && "text-muted-foreground line-through",
        )}
      >
        {task.title}
      </Link>
      {overdue && (
        <span className="shrink-0 rounded-full bg-red-500/10 px-1.5 text-[10px] font-medium text-red-500">
          overdue
        </span>
      )}
      <span className="ml-auto hidden sm:inline text-xs text-muted-foreground">
        {task.progress}%
      </span>
      <div className="flex shrink-0 -space-x-1.5">
        {task.assignees.slice(0, 3).map((a) => (
          <Avatar key={a.id} className="h-5 w-5 ring-1 ring-background">
            {a.image && <AvatarImage src={a.image} alt="" />}
            <AvatarFallback className="text-[8px]">{initials(a.name)}</AvatarFallback>
          </Avatar>
        ))}
      </div>
    </div>
  );
}
