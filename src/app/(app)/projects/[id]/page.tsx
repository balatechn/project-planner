import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/projects";
import { can } from "@/lib/rbac";
import { ProjectWorkspace } from "./project-workspace";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; task?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();

  if (!(await canAccessProject(id, user.id, user.role))) notFound();

  const [project, users] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, image: true, email: true } },
        members: {
          select: {
            user: {
              select: { id: true, name: true, image: true, email: true },
            },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, image: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!project) notFound();

  const memberPeople = [
    project.owner,
    ...project.members.map((m) => m.user),
  ].filter(
    (p, i, arr) => arr.findIndex((x) => x.id === p.id) === i,
  );

  return (
    <ProjectWorkspace
      defaultView={sp.view ?? "gantt"}
      initialTaskId={sp.task ?? null}
      project={{
        id: project.id,
        name: project.name,
        key: project.key,
        description: project.description,
        department: project.department,
        status: project.status,
        priority: project.priority,
        color: project.color,
        startDate: project.startDate?.toISOString() ?? null,
        endDate: project.endDate?.toISOString() ?? null,
        budget: project.budget?.toString() ?? null,
        currency: project.currency,
        isArchived: project.isArchived,
        owner: project.owner,
      }}
      members={memberPeople}
      allUsers={users}
      permissions={{
        canCreateTask: can(user.role, "task:create"),
        canEditTask: can(user.role, "task:edit"),
        canUpdateStatus: can(user.role, "task:updateStatus"),
        canEditProject: can(user.role, "project:edit"),
        canArchive: can(user.role, "project:archive"),
        canDelete: can(user.role, "project:delete"),
        canComment: can(user.role, "comment:create"),
      }}
      currentUserId={user.id}
    />
  );
}
