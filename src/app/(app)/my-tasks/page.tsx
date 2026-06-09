import type { Metadata } from "next";
import Link from "next/link";
import { format, isPast } from "date-fns";
import { Clock } from "lucide-react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { PriorityBadge, TaskStatusBadge } from "@/components/badges";
import { TASK_STATUS_LABELS, TASK_STATUS_ORDER } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My Tasks" };

export default async function MyTasksPage() {
  const user = await requireUser();
  // select only the columns rendered in the UI — smaller payload & faster scan
  const tasks = await prisma.task.findMany({
    where: { assignees: { some: { userId: user.id } } },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      project: { select: { id: true, name: true, color: true } },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Tasks"
        description="Everything assigned to you across all projects."
      />

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            You have no assigned tasks.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {TASK_STATUS_ORDER.map((status) => {
            const group = tasks.filter((t) => t.status === status);
            if (group.length === 0) return null;
            return (
              <div key={status}>
                <h3 className="mb-2 text-sm font-semibold">
                  {TASK_STATUS_LABELS[status]}{" "}
                  <span className="text-muted-foreground">{group.length}</span>
                </h3>
                <div className="overflow-hidden rounded-lg border">
                  {group.map((t, i) => {
                    const overdue =
                      t.dueDate &&
                      isPast(t.dueDate) &&
                      t.status !== "COMPLETED";
                    return (
                      <Link
                        key={t.id}
                        href={`/projects/${t.project.id}?task=${t.id}`}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 hover:bg-muted/50",
                          i > 0 && "border-t",
                        )}
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: t.project.color }}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {t.title}
                        </span>
                        <span className="hidden text-xs text-muted-foreground sm:block">
                          {t.project.name}
                        </span>
                        <PriorityBadge priority={t.priority} />
                        {t.dueDate && (
                          <span
                            className={cn(
                              "flex items-center gap-1 text-xs",
                              overdue
                                ? "font-medium text-destructive"
                                : "text-muted-foreground",
                            )}
                          >
                            <Clock className="h-3 w-3" />
                            {format(t.dueDate, "MMM d")}
                          </span>
                        )}
                        <TaskStatusBadge status={t.status} />
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
