import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { projectAccessWhere } from "@/lib/projects";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProjectStatusBadge, PriorityBadge } from "@/components/badges";
import { NewProjectButton } from "./new-project-button";
import { format } from "date-fns";

export const metadata: Metadata = { title: "Projects" };

// The active-users list changes rarely — cache for 5 min
const getActiveUsers = unstable_cache(
  () =>
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, image: true },
      orderBy: { name: "asc" },
    }),
  ["active-users"],
  { revalidate: 300 },
);

export default async function ProjectsPage() {
  const user = await requireUser();
  const where = projectAccessWhere(user.id, user.role);

  const [projects, users] = await Promise.all([
    prisma.project.findMany({
      where: { ...where, isArchived: false },
      select: {
        id: true,
        name: true,
        key: true,
        entity: true,
        department: true,
        status: true,
        priority: true,
        color: true,
        startDate: true,
        endDate: true,
        owner: { select: { id: true, name: true, image: true } },
        projectManager: { select: { id: true, name: true, image: true } },
        tasks: { select: { status: true, progress: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    can(user.role, "project:create") ? getActiveUsers() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description={`${projects.length} active ${projects.length === 1 ? "project" : "projects"} in your workspace.`}
      >
        {can(user.role, "project:create") && (
          <NewProjectButton users={users} currentUserId={user.id} />
        )}
      </PageHeader>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="brand-gradient flex h-14 w-14 items-center justify-center rounded-2xl text-2xl text-white">
              ◆
            </div>
            <p className="text-lg font-semibold">No projects yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Create your first project to start planning tasks, tracking
              progress and collaborating with your team.
            </p>
            {can(user.role, "project:create") && (
              <NewProjectButton users={users} currentUserId={user.id} />
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Project</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground hidden md:table-cell">Entity / Dept</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground hidden lg:table-cell">Project Manager</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground hidden lg:table-cell">Timeline</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground hidden sm:table-cell">Progress</th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground hidden sm:table-cell">Tasks</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground hidden md:table-cell">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {projects.map((p) => {
                  const tasks = p.tasks;
                  const pct =
                    tasks.length === 0
                      ? 0
                      : Math.round(
                          tasks.reduce(
                            (s, t) =>
                              s + (t.status === "COMPLETED" ? 100 : t.progress),
                            0,
                          ) / tasks.length,
                        );
                  const pm = p.projectManager ?? p.owner;
                  const timeline =
                    p.startDate && p.endDate
                      ? `${format(p.startDate, "MMM yy")} – ${format(p.endDate, "MMM yy")}`
                      : p.endDate
                      ? `Due ${format(p.endDate, "MMM yy")}`
                      : "—";

                  return (
                    <tr
                      key={p.id}
                      className="group hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/projects/${p.id}?view=gantt`}
                          className="flex items-center gap-3 group-hover:text-primary transition-colors"
                        >
                          <span
                            className="h-8 w-1 rounded-full flex-shrink-0"
                            style={{ backgroundColor: p.color }}
                          />
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[180px] lg:max-w-[240px]">
                              {p.name}
                            </p>
                            <p className="text-xs text-muted-foreground">{p.key}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="text-sm">
                          {p.entity && (
                            <p className="font-medium text-foreground">{p.entity}</p>
                          )}
                          <p className="text-muted-foreground text-xs">
                            {p.department ?? "—"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-sm">{pm.name ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {timeline}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ProjectStatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <Progress value={pct} className="h-1.5 flex-1" />
                          <span className="text-xs text-muted-foreground w-8 text-right">
                            {pct}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        <span className="text-sm font-medium">{tasks.length}</span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <PriorityBadge priority={p.priority} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
