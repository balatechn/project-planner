"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import type { TaskStatus } from "@prisma/client";
import type { TaskListItem } from "@/types/app";
import { TASK_STATUS_LABELS, TASK_STATUS_ORDER } from "@/lib/constants";
import { TaskCard } from "@/components/tasks/task-card";
import { cn } from "@/lib/utils";

export function KanbanBoard({
  tasks,
  canDrag,
  canCreate,
  onOpenTask,
  onCreateInStatus,
  onMoveTask,
}: {
  tasks: TaskListItem[];
  canDrag: boolean;
  canCreate: boolean;
  onOpenTask: (task: TaskListItem) => void;
  onCreateInStatus: (status: TaskStatus) => void;
  onMoveTask: (taskId: string, status: TaskStatus) => void;
}) {
  const [dragOver, setDragOver] = React.useState<TaskStatus | null>(null);

  // Only top-level tasks appear on the board.
  const topLevel = tasks.filter((t) => !t.parentId);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 thin-scroll">
      {TASK_STATUS_ORDER.map((status) => {
        const columnTasks = topLevel.filter((t) => t.status === status);
        return (
          <div
            key={status}
            onDragOver={(e) => {
              if (!canDrag) return;
              e.preventDefault();
              setDragOver(status);
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              if (!canDrag) return;
              e.preventDefault();
              const taskId = e.dataTransfer.getData("text/task-id");
              if (taskId) onMoveTask(taskId, status);
              setDragOver(null);
            }}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors",
              dragOver === status && "border-primary bg-primary/5",
            )}
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: `hsl(var(--status-${status
                      .toLowerCase()
                      .replace("_", "")}))`,
                  }}
                />
                <span className="text-sm font-semibold">
                  {TASK_STATUS_LABELS[status]}
                </span>
                <span className="rounded-full bg-background px-1.5 text-xs text-muted-foreground">
                  {columnTasks.length}
                </span>
              </div>
              {canCreate && (
                <button
                  onClick={() => onCreateInStatus(status)}
                  className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                  aria-label="Add task"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 thin-scroll">
              {columnTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  draggable={canDrag}
                  onDragStart={(e) =>
                    e.dataTransfer.setData("text/task-id", task.id)
                  }
                  onClick={() => onOpenTask(task)}
                />
              ))}
              {columnTasks.length === 0 && (
                <div className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">
                  No tasks
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
