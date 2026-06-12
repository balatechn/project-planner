import type { Metadata } from "next";
import { requireUserWithPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { RecycleBinClient } from "./recycle-bin-client";

export const metadata: Metadata = { title: "Recycle Bin" };

export default async function RecycleBinPage() {
  await requireUserWithPermission("admin:users");

  const [projects, tasks] = await Promise.all([
    prisma.project.findMany({
      where: { deletedAt: { not: null } },
      select: {
        id: true,
        name: true,
        key: true,
        color: true,
        deletedAt: true,
        owner: { select: { name: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { deletedAt: "desc" },
    }),
    prisma.task.findMany({
      // Only top-level binned tasks whose project is still live —
      // tasks inside a binned project restore together with it
      where: {
        deletedAt: { not: null },
        parentId: null,
        project: { deletedAt: null },
      },
      select: {
        id: true,
        title: true,
        status: true,
        deletedAt: true,
        project: { select: { id: true, name: true, color: true } },
      },
      orderBy: { deletedAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recycle Bin"
        description="Deleted projects and tasks are kept for 30 days, then removed permanently."
      />
      <RecycleBinClient
        projects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          key: p.key,
          color: p.color,
          deletedAt: p.deletedAt!.toISOString(),
          ownerName: p.owner.name,
          taskCount: p._count.tasks,
        }))}
        tasks={tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          deletedAt: t.deletedAt!.toISOString(),
          projectName: t.project.name,
          projectColor: t.project.color,
        }))}
      />
    </div>
  );
}
