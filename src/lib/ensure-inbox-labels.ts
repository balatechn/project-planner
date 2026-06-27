import { prisma } from "@/lib/prisma";

export const INBOX_LABEL_DEFS = [
  { name: "Follow-up",   color: "#3b82f6" },
  { name: "Approval",    color: "#f59e0b" },
  { name: "Call",        color: "#10b981" },
  { name: "Procurement", color: "#8b5cf6" },
  { name: "Note",        color: "#6b7280" },
] as const;

export type InboxLabelName = (typeof INBOX_LABEL_DEFS)[number]["name"];

export async function ensureInboxLabels(): Promise<Record<InboxLabelName, string>> {
  const names = INBOX_LABEL_DEFS.map((l) => l.name);
  const existing = await prisma.taskLabel.findMany({
    where: { projectId: null, name: { in: names } },
    select: { id: true, name: true },
  });

  const map = new Map(existing.map((l) => [l.name, l.id]));
  const result: Record<string, string> = {};

  for (const def of INBOX_LABEL_DEFS) {
    if (map.has(def.name)) {
      result[def.name] = map.get(def.name)!;
    } else {
      const created = await prisma.taskLabel.create({
        data: { name: def.name, color: def.color, projectId: null },
      });
      result[def.name] = created.id;
    }
  }

  return result as Record<InboxLabelName, string>;
}
