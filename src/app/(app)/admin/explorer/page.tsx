import type { Metadata } from "next";
import { requireUserWithPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ExplorerTree } from "./explorer-tree";

export const metadata: Metadata = { title: "Workspace Explorer" };

export default async function ExplorerPage() {
  await requireUserWithPermission("admin:users");

  const projects = await prisma.project.findMany({
    where: { isArchived: false },
    select: {
      id: true,
      name: true,
      key: true,
      color: true,
      status: true,
      department: true,
      owner: { select: { name: true } },
      tasks: {
        where: { deletedAt: null },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          progress: true,
          parentId: true,
          dueDate: true,
          assignees: {
            select: { user: { select: { id: true, name: true, image: true } } },
          },
        },
        orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  });

  const tree = projects.map((p) => ({
    id: p.id,
    name: p.name,
    key: p.key,
    color: p.color,
    status: p.status,
    department: p.department,
    ownerName: p.owner.name,
    tasks: p.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      progress: t.progress,
      parentId: t.parentId,
      dueDate: t.dueDate?.toISOString() ?? null,
      assignees: t.assignees.map((a) => a.user),
    })),
  }));

  const totalTasks = tree.reduce((s, p) => s + p.tasks.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace Explorer"
        description={`Full tree of ${tree.length} projects and ${totalTasks} tasks across the workspace.`}
      />
      <ExplorerTree projects={tree} />
    </div>
  );
}
