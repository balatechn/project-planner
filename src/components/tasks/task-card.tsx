"use client";

import { CalendarClock, GitBranch, MessageSquare, Paperclip } from "lucide-react";
import { format, isPast } from "date-fns";
import type { TaskListItem } from "@/types/app";
import { PriorityBadge } from "@/components/badges";
import { AvatarStack } from "@/components/avatar-stack";
import { cn } from "@/lib/utils";

export function TaskCard({
  task,
  onClick,
  draggable,
  onDragStart,
}: {
  task: TaskListItem;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}) {
  const overdue =
    task.dueDate && isPast(new Date(task.dueDate)) && task.status !== "COMPLETED";

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className="group cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col min-w-0">
          {task.wbsNumber && (
            <span className="mb-0.5 text-[10px] font-mono font-medium text-muted-foreground">
              {task.wbsNumber}
            </span>
          )}
          <p className="text-sm font-medium leading-snug">{task.title}</p>
        </div>
        <PriorityBadge priority={task.priority} className="shrink-0" />
      </div>

      {task.progress > 0 && task.status !== "COMPLETED" && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full brand-gradient"
            style={{ width: `${task.progress}%` }}
          />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
          {task.dueDate && (
            <span
              className={cn(
                "flex items-center gap-1",
                overdue && "font-medium text-destructive",
              )}
            >
              <CalendarClock className="h-3.5 w-3.5" />
              {format(new Date(task.dueDate), "MMM d")}
            </span>
          )}
          {task._count.comments > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {task._count.comments}
            </span>
          )}
          {task._count.attachments > 0 && (
            <span className="flex items-center gap-1">
              <Paperclip className="h-3.5 w-3.5" />
              {task._count.attachments}
            </span>
          )}
          {task._count.subtasks > 0 && (
            <span className="flex items-center gap-1">
              <GitBranch className="h-3.5 w-3.5" />
              {task._count.subtasks}
            </span>
          )}
        </div>
        <AvatarStack
          people={task.assignees.map((a) => a.user)}
          max={3}
          size="h-6 w-6"
        />
      </div>
    </div>
  );
}
