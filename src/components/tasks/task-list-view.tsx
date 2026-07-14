"use client";

import * as React from "react";
import { format, isPast } from "date-fns";
import { CheckSquare, ChevronDown, ChevronRight } from "lucide-react";
import type { TaskListItem } from "@/types/app";
import { PriorityBadge, TaskStatusBadge } from "@/components/badges";
import { AvatarStack } from "@/components/avatar-stack";
import { TASK_STATUS_LABELS, TASK_STATUS_ORDER } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function TaskListView({
  tasks,
  onOpenTask,
}: {
  tasks: TaskListItem[];
  onOpenTask: (task: TaskListItem) => void;
}) {
  const topLevel = tasks.filter((t) => !t.parentId);

  // Build a map: parentId → children[]
  const childMap = React.useMemo(() => {
    const map = new Map<string, TaskListItem[]>();
    for (const t of tasks) {
      if (t.parentId) {
        if (!map.has(t.parentId)) map.set(t.parentId, []);
        map.get(t.parentId)!.push(t);
      }
    }
    return map;
  }, [tasks]);

  // Track which parents are expanded (default: all collapsed)
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {TASK_STATUS_ORDER.map((status) => {
        const group = topLevel.filter((t) => t.status === status);
        if (group.length === 0) return null;

        return (
          <div key={status}>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-sm font-semibold">{TASK_STATUS_LABELS[status]}</h3>
              <span className="text-xs text-muted-foreground">{group.length}</span>
            </div>
            <div className="overflow-hidden rounded-lg border">
              {group.map((task, idx) => {
                const overdue =
                  task.dueDate &&
                  isPast(new Date(task.dueDate)) &&
                  task.status !== "COMPLETED";
                const children = childMap.get(task.id) ?? [];
                const hasChildren = children.length > 0;
                const isExpanded = expanded.has(task.id);

                return (
                  <React.Fragment key={task.id}>
                    {/* Parent task row */}
                    <div
                      className={cn(
                        "flex w-full items-center gap-2 px-4 py-3 transition-colors hover:bg-muted/50",
                        idx > 0 && "border-t",
                      )}
                    >
                      {/* Expand/collapse toggle */}
                      <button
                        type="button"
                        onClick={() => hasChildren && toggle(task.id)}
                        className={cn(
                          "flex-shrink-0 rounded p-0.5 transition-colors",
                          hasChildren
                            ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                            : "invisible",
                        )}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </button>

                      {/* Task info — clickable */}
                      <button
                        type="button"
                        onClick={() => onOpenTask(task)}
                        className="flex flex-1 items-center gap-3 text-left min-w-0"
                      >
                        {task.wbsNumber && (
                          <span className="flex-shrink-0 text-[10px] font-mono font-medium text-muted-foreground">
                            {task.wbsNumber}
                          </span>
                        )}
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {task.title}
                        </span>
                        {/* Subtask count badge */}
                        {hasChildren && (
                          <span className="flex-shrink-0 flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-medium">
                            <ChevronRight className="h-2.5 w-2.5" />
                            {children.length}
                          </span>
                        )}
                        {/* Checklist badge */}
                        {task._count.checklistItems > 0 && (
                          <span className="flex-shrink-0 flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <CheckSquare className="h-3 w-3" />
                            {task._count.checklistItems}
                          </span>
                        )}
                        <PriorityBadge priority={task.priority} />
                        {task.dueDate && (
                          <span
                            className={cn(
                              "hidden w-20 flex-shrink-0 text-right text-xs sm:block",
                              overdue
                                ? "font-medium text-destructive"
                                : "text-muted-foreground",
                            )}
                          >
                            {format(new Date(task.dueDate), "MMM d")}
                          </span>
                        )}
                        <div className="hidden sm:block flex-shrink-0">
                          <TaskStatusBadge status={task.status} />
                        </div>
                        <AvatarStack
                          people={task.assignees.map((a) => a.user)}
                          max={2}
                          size="h-6 w-6"
                        />
                      </button>
                    </div>

                    {/* Subtask rows — indented, shown when expanded */}
                    {isExpanded &&
                      children.map((sub, si) => {
                        const subOverdue =
                          sub.dueDate &&
                          isPast(new Date(sub.dueDate)) &&
                          sub.status !== "COMPLETED";
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => onOpenTask(sub)}
                            className={cn(
                              "flex w-full items-center gap-3 border-t bg-muted/20 px-4 py-2.5 text-left transition-colors hover:bg-muted/50",
                            )}
                          >
                            {/* Indent + tree line */}
                            <span className="flex-shrink-0 flex items-center pl-6">
                              <span className="mr-2 text-border">└</span>
                            </span>
                            {sub.wbsNumber && (
                              <span className="flex-shrink-0 text-[10px] font-mono font-medium text-muted-foreground">
                                {sub.wbsNumber}
                              </span>
                            )}
                            <span className="min-w-0 flex-1 truncate text-sm">
                              {sub.title}
                            </span>
                            {/* Checklist badge on subtask */}
                            {sub._count.checklistItems > 0 && (
                              <span className="flex-shrink-0 flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                <CheckSquare className="h-3 w-3" />
                                {sub._count.checklistItems}
                              </span>
                            )}
                            <PriorityBadge priority={sub.priority} />
                            {sub.dueDate && (
                              <span
                                className={cn(
                                  "hidden w-20 flex-shrink-0 text-right text-xs sm:block",
                                  subOverdue
                                    ? "font-medium text-destructive"
                                    : "text-muted-foreground",
                                )}
                              >
                                {format(new Date(sub.dueDate), "MMM d")}
                              </span>
                            )}
                            <div className="hidden sm:block flex-shrink-0">
                              <TaskStatusBadge status={sub.status} />
                            </div>
                            <AvatarStack
                              people={sub.assignees.map((a) => a.user)}
                              max={2}
                              size="h-5 w-5"
                            />
                          </button>
                        );
                      })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        );
      })}

      {topLevel.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No tasks yet.
        </p>
      )}
    </div>
  );
}
