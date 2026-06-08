import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { projectAccessWhere } from "@/lib/projects";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProjectStatusBadge, PriorityBadge } from "@/components/badges";
import { AvatarStack } from "@/components/avatar-stack";
import { formatCurrency } from "@/lib/utils";
import { NewProjectButton } from "./new-project-button";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const user = await requireUser();
  const where = projectAccessWhere(user.id, user.role);

  const [projects, users] = await Promise.all([
    prisma.project.findMany({
      where: { ...where, isArchived: false },
      include: {
        owner: { select: { id: true, name: true, image: true } },
        members: {
          select: { user: { select: { id: true, name: true, image: true } } },
        },
        tasks: { select: { status: true, progress: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    can(user.role, "project:create")
      ? prisma.user.findMany({
          where: { isActive: true },
          select: { id: true, name: true, email: true, image: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
            return (
              <Link key={p.id} href={`/projects/${p.id}`}>
                <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div
                    className="h-1.5 rounded-t-xl"
                    style={{ backgroundColor: p.color }}
                  />
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.key} · {p.department ?? "No department"}
                        </p>
                      </div>
                      <ProjectStatusBadge status={p.status} />
                    </div>

                    {p.description && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {p.description}
                      </p>
                    )}

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{pct}%</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <AvatarStack
                        people={[p.owner, ...p.members.map((m) => m.user)]}
                        max={4}
                        size="h-7 w-7"
                      />
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <PriorityBadge priority={p.priority} />
                        <span>{formatCurrency(p.budget?.toString(), p.currency)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
