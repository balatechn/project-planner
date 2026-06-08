"use client";

import { format, isPast } from "date-fns";
import { ChevronRight } from "lucide-react";
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

  return (
    <div className="space-y-6">
      {TASK_STATUS_ORDER.map((status) => {
        const group = topLevel.filter((t) => t.status === status);
        if (group.length === 0) return null;
        return (
          <div key={status}>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-sm font-semibold">
                {TASK_STATUS_LABELS[status]}
              </h3>
              <span className="text-xs text-muted-foreground">
                {group.length}
              </span>
            </div>
            <div className="overflow-hidden rounded-lg border">
              {group.map((task, idx) => {
                const overdue =
                  task.dueDate &&
                  isPast(new Date(task.dueDate)) &&
                  task.status !== "COMPLETED";
                return (
                  <button
                    key={task.id}
                    onClick={() => onOpenTask(task)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                      idx > 0 && "border-t",
                    )}
                  >
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {task.title}
                    </span>
                    <PriorityBadge priority={task.priority} />
                    {task.dueDate && (
                      <span
                        className={cn(
                          "hidden w-20 text-right text-xs sm:block",
                          overdue
                            ? "font-medium text-destructive"
                            : "text-muted-foreground",
                        )}
                      >
                        {format(new Date(task.dueDate), "MMM d")}
                      </span>
                    )}
                    <div className="hidden sm:block">
                      <TaskStatusBadge status={task.status} />
                    </div>
                    <AvatarStack
                      people={task.assignees.map((a) => a.user)}
                      max={2}
                      size="h-6 w-6"
                    />
                  </button>
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
