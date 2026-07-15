import { z } from "zod";

const priority = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const projectStatus = z.enum([
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "ARCHIVED",
  "CANCELLED",
]);
const taskStatus = z.enum([
  "NOT_STARTED",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "DELAYED",
]);

const optionalDate = z
  .string()
  .datetime()
  .or(z.string().length(0))
  .nullish()
  .transform((v) => (v ? new Date(v) : null));

export const createProjectSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(5000).optional().nullable(),
  entity: z.string().max(120).optional().nullable(),
  department: z.string().max(80).optional().nullable(),
  location: z.string().max(80).optional().nullable(),
  programType: z.string().max(80).optional().nullable(),
  priority: priority.default("MEDIUM"),
  status: projectStatus.default("PLANNING"),
  startDate: optionalDate,
  endDate: optionalDate,
  budget: z.coerce.number().nonnegative().optional().nullable(),
  budgetActual: z.coerce.number().nonnegative().optional().nullable(),
  currency: z.string().length(3).default("USD"),
  color: z.string().regex(/^#([0-9a-fA-F]{6})$/).default("#f59e0b"),
  ownerId: z.string().min(1).optional(),
  projectManagerId: z.string().min(1).optional().nullable(),
  memberIds: z.array(z.string()).optional(),
  published: z.boolean().optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const createTaskSchema = z.object({
  projectId: z.string().min(1),
  parentId: z.string().optional().nullable(),
  sprintId: z.string().optional().nullable(),
  title: z.string().min(2).max(200),
  description: z.string().max(10000).optional().nullable(),
  status: taskStatus.default("NOT_STARTED"),
  priority: priority.default("MEDIUM"),
  startDate: optionalDate,
  dueDate: optionalDate,
  estimatedHours: z.coerce.number().nonnegative().optional().nullable(),
  progress: z.coerce.number().min(0).max(100).default(0),
  isMilestone: z.boolean().optional().default(false),
  color: z.string().regex(/^#([0-9a-fA-F]{6})$/).optional().nullable(),
  wbsNumber: z.string().max(20).optional().nullable(),
  baselineStart: optionalDate,
  baselineEnd: optionalDate,
  assigneeIds: z.array(z.string()).optional(),
  dependsOnIds: z.array(z.string()).optional(),
  labelIds: z.array(z.string()).optional(),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  orderIndex: z.coerce.number().int().optional(),
  actualHours: z.coerce.number().nonnegative().optional().nullable(),
});

export const createCommentSchema = z.object({
  body: z.string().min(1).max(10000),
  mentions: z.array(z.string()).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
