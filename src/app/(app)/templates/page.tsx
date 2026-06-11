import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { TemplatesClient } from "./templates-client";

export const metadata: Metadata = { title: "Project Templates" };

export default async function TemplatesPage() {
  const user = await requireUser();
  const isAdmin = can(user.role, "template:manage");

  const templates = await prisma.projectTemplate.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      department: true,
      isSystem: true,
      blueprint: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });

  // Count tasks in each blueprint
  const enriched = templates.map((t) => {
    let taskCount = 0;
    try {
      const bp = t.blueprint as { tasks?: unknown[] };
      taskCount = Array.isArray(bp?.tasks) ? bp.tasks.length : 0;
    } catch { /* noop */ }
    return {
      ...t,
      taskCount,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  });

  return <TemplatesClient templates={enriched} isAdmin={isAdmin} />;
}
