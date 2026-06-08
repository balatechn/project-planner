import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { projectAccessWhere } from "@/lib/projects";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectStatusBadge, TaskStatusBadge } from "@/components/badges";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const where = projectAccessWhere(user.id, user.role);

  const [projects, tasks] = query
    ? await Promise.all([
        prisma.project.findMany({
          where: {
            ...where,
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
              { key: { contains: query, mode: "insensitive" } },
            ],
          },
          take: 20,
        }),
        prisma.task.findMany({
          where: {
            project: where,
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
            ],
          },
          include: { project: { select: { id: true, name: true } } },
          take: 30,
        }),
      ])
    : [[], []];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Search"
        description={
          query
            ? `${projects.length + tasks.length} results for "${query}"`
            : "Type a query in the top bar to search projects and tasks."
        }
      />

      {query && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Projects</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {projects.length === 0 && (
                <p className="text-sm text-muted-foreground">No projects found.</p>
              )}
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                >
                  <span className="font-medium">{p.name}</span>
                  <ProjectStatusBadge status={p.status} />
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {tasks.length === 0 && (
                <p className="text-sm text-muted-foreground">No tasks found.</p>
              )}
              {tasks.map((t) => (
                <Link
                  key={t.id}
                  href={`/projects/${t.project.id}?task=${t.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.project.name}
                    </p>
                  </div>
                  <TaskStatusBadge status={t.status} />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
