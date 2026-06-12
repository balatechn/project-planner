import type {
  Priority,
  ProjectStatus,
  TaskStatus,
} from "@prisma/client";

export type Person = {
  id: string;
  name: string | null;
  email?: string | null;
  image: string | null;
};

export type TaskListItem = {
  id: string;
  projectId: string;
  parentId: string | null;
  sprintId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  startDate: string | null;
  dueDate: string | null;
  progress: number;
  estimatedHours: number | null;
  orderIndex: number;
  isMilestone: boolean;
  wbsNumber: string | null;
  baselineStart?: string | null;
  baselineEnd?: string | null;
  createdById: string;
  assignees: { user: Person }[];
  dependsOn: { prerequisiteId: string }[];
  _count: { subtasks: number; comments: number; attachments: number; checklistItems: number };
};

export type ProjectSummary = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  entity: string | null;
  department: string | null;
  location: string | null;
  status: ProjectStatus;
  priority: Priority;
  color: string;
  startDate: string | null;
  endDate: string | null;
  budget: string | null;
  currency: string;
  isArchived: boolean;
  owner: Person;
};

export type WorkspacePermissions = {
  canCreateTask: boolean;
  canEditTask: boolean;
  canUpdateStatus: boolean;
  canEditProject: boolean;
  canArchive: boolean;
  canDelete: boolean;
  canComment: boolean;
};
