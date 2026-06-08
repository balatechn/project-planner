import type {
  Priority,
  ProjectStatus,
  Role,
  TaskStatus,
} from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  TEAM_MEMBER: "Team Member",
  VIEWER: "Viewer",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  DELAYED: "Delayed",
};

/** Ordered columns for the Kanban board. */
export const TASK_STATUS_ORDER: TaskStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "ON_HOLD",
  "DELAYED",
  "COMPLETED",
];

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  NOT_STARTED: "var(--status-notstarted)",
  IN_PROGRESS: "var(--status-inprogress)",
  ON_HOLD: "var(--status-onhold)",
  COMPLETED: "var(--status-completed)",
  DELAYED: "var(--status-delayed)",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
  CANCELLED: "Cancelled",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  LOW: "#64748b",
  MEDIUM: "#2563eb",
  HIGH: "#f59e0b",
  CRITICAL: "#dc2626",
};

export const DEPARTMENTS = [
  "Engineering",
  "Marketing",
  "Sales",
  "Operations",
  "Finance",
  "Human Resources",
  "Product",
  "Design",
  "Customer Success",
  "IT",
] as const;
