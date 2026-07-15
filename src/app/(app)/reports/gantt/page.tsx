import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { projectAccessWhere } from "@/lib/projects";
import { GanttReportView } from "./gantt-report-view";

export const metadata: Metadata = { title: "Gantt Chart Report" };

export default async function GanttReportPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const projects = await prisma.project.findMany({
    where: { ...projectAccessWhere(user.id, user.role), isArchived: false },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const initialProjectId = sp.projectId ?? projects[0]?.id ?? "";

  return (
    <GanttReportView
      projects={projects}
      initialProjectId={initialProjectId}
    />
  );
}
