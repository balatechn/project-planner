import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { projectAccessWhere } from "@/lib/projects";
import { PageHeader } from "@/components/page-header";
import { PortfolioTimeline } from "./portfolio-timeline";

export const metadata: Metadata = { title: "Portfolio" };

export default async function PortfolioPage() {
  const user = await requireUser();
  const where = projectAccessWhere(user.id, user.role);

  const projects = await prisma.project.findMany({
    where: { ...where, isArchived: false },
    select: {
      id: true,
      name: true,
      key: true,
      color: true,
      status: true,
      priority: true,
      startDate: true,
      endDate: true,
      entity: true,
      department: true,
      projectManager: { select: { name: true } },
      tasks: { where: { deletedAt: null }, select: { status: true, progress: true } },
    },
    orderBy: [{ startDate: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolio"
        description="Cross-project timeline view — track all projects at a glance."
      />
      <PortfolioTimeline projects={projects} />
    </div>
  );
}
