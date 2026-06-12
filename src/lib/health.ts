// Project health derived from overdue ratio among open tasks.

export type ProjectHealth = "on-track" | "at-risk" | "off-track";

export function projectHealth(
  tasks: { status: string; dueDate: Date | string | null }[],
): ProjectHealth {
  const open = tasks.filter((t) => t.status !== "COMPLETED");
  if (open.length === 0) return "on-track";

  const now = Date.now();
  const overdue = open.filter(
    (t) => t.dueDate && new Date(t.dueDate).getTime() < now,
  ).length;

  if (overdue === 0) return "on-track";
  if (overdue / open.length < 0.25) return "at-risk";
  return "off-track";
}

export const HEALTH_META: Record<
  ProjectHealth,
  { label: string; dot: string; badge: string }
> = {
  "on-track": {
    label: "On track",
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  "at-risk": {
    label: "At risk",
    dot: "bg-amber-500",
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  "off-track": {
    label: "Off track",
    dot: "bg-red-500",
    badge: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
};
