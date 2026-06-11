import { cn } from "@/lib/utils";

type Accent = "blue" | "green" | "amber" | "red" | "gray";

const accentIcon: Record<Accent, string> = {
  blue:  "bg-blue-500/10 text-blue-500 dark:bg-blue-400/10 dark:text-blue-400",
  green: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400",
  red:   "bg-red-500/10 text-red-600 dark:bg-red-400/10 dark:text-red-400",
  gray:  "bg-muted text-muted-foreground",
};

const accentLine: Record<Accent, string> = {
  blue:  "accent-blue",
  green: "accent-green",
  amber: "accent-amber",
  red:   "accent-red",
  gray:  "accent-gray",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = "blue",
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  accent?: Accent;
}) {
  return (
    <div
      className={cn(
        "stat-accent-line group relative rounded-xl border bg-card p-5",
        "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/8",
        "dark:hover:shadow-black/30",
        accentLine[accent],
      )}
    >
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
            "transition-transform duration-200 group-hover:scale-110",
            accentIcon[accent],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-0.5 text-3xl font-bold tracking-tight text-foreground">
            {value}
          </p>
          {hint && (
            <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
          )}
        </div>
      </div>
    </div>
  );
}
