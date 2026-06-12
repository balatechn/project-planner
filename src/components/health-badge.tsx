import { cn } from "@/lib/utils";
import { HEALTH_META, type ProjectHealth } from "@/lib/health";

export function HealthBadge({
  health,
  className,
}: {
  health: ProjectHealth;
  className?: string;
}) {
  const meta = HEALTH_META[health];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        meta.badge,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}
