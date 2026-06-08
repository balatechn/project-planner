import type { Priority, ProjectStatus, TaskStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_STATUS_LABELS,
} from "@/lib/constants";

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `hsl(${TASK_STATUS_COLORS[status]} / 0.14)`,
        color: `hsl(${TASK_STATUS_COLORS[status]})`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: `hsl(${TASK_STATUS_COLORS[status]})` }}
      />
      {TASK_STATUS_LABELS[status]}
    </span>
  );
}

const PROJECT_STATUS_VARIANT: Record<
  ProjectStatus,
  "default" | "success" | "warning" | "secondary" | "destructive"
> = {
  PLANNING: "secondary",
  ACTIVE: "default",
  ON_HOLD: "warning",
  COMPLETED: "success",
  ARCHIVED: "secondary",
  CANCELLED: "destructive",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge variant={PROJECT_STATUS_VARIANT[status]}>
      {PROJECT_STATUS_LABELS[status]}
    </Badge>
  );
}

export function PriorityBadge({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        className,
      )}
      style={{ color: PRIORITY_COLORS[priority] }}
    >
      <span
        className="h-2 w-2 rounded-sm"
        style={{ backgroundColor: PRIORITY_COLORS[priority] }}
      />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
