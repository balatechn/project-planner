import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { projectAccessWhere } from "@/lib/projects";
import { PageHeader } from "@/components/page-header";
import { GlobalCalendar } from "./global-calendar";
import type { TaskListItem } from "@/types/app";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const user = await requireUser();
  const tasks = await prisma.task.findMany({
    where: {
      dueDate: { not: null },
      project: projectAccessWhere(user.id, user.role),
    },
    include: {
      assignees: {
        select: { user: { select: { id: true, name: true, image: true } } },
      },
      _count: { select: { subtasks: true, comments: true, attachments: true } },
      dependsOn: { select: { prerequisiteId: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  const serialized: TaskListItem[] = tasks.map((t) => ({
    id: t.id,
    projectId: t.projectId,
    parentId: t.parentId,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    startDate: t.startDate?.toISOString() ?? null,
    dueDate: t.dueDate?.toISOString() ?? null,
    progress: t.progress,
    estimatedHours: t.estimatedHours,
    orderIndex: t.orderIndex,
    assignees: t.assignees,
    dependsOn: t.dependsOn,
    _count: t._count,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Task due dates across all your projects."
      />
      <GlobalCalendar tasks={serialized} />
    </div>
  );
}
