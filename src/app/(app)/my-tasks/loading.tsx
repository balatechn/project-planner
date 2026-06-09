import { Skeleton } from "@/components/ui/skeleton";

export default function MyTasksLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2 pb-1">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Task groups */}
      {Array.from({ length: 3 }).map((_, g) => (
        <div key={g} className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-6" />
          </div>
          <div className="overflow-hidden rounded-lg border divide-y">
            {Array.from({ length: g === 0 ? 4 : 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-2 w-2 rounded-full flex-shrink-0" />
                <Skeleton className="h-4 flex-1 max-w-[280px]" />
                <Skeleton className="hidden sm:block h-3 w-28" />
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-22 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
