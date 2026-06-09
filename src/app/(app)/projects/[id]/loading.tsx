import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function ProjectDetailLoading() {
  return (
    <div className="space-y-5">
      {/* Project header */}
      <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <Skeleton className="mt-1 h-12 w-1.5 rounded-full" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-64" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-96 max-w-full" />
            <div className="flex items-center gap-2 mt-1">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-8" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20 rounded-t-lg rounded-b-none" />
        ))}
      </div>

      {/* Gantt skeleton (default view) */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {/* Gantt header */}
          <div className="flex gap-4 pb-2 border-b">
            <Skeleton className="h-4 w-48" />
            <div className="flex-1 flex gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-4 flex-1" />
              ))}
            </div>
          </div>
          {/* Gantt rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-4 items-center">
              <div className="w-48 flex items-center gap-2">
                <Skeleton className="h-2 w-2 rounded-full" />
                <Skeleton className="h-3 flex-1" />
              </div>
              <div className="flex-1 relative h-7">
                <Skeleton
                  className="absolute h-5 rounded-md"
                  style={{
                    left: `${(i * 13) % 40}%`,
                    width: `${15 + (i * 7) % 35}%`,
                    top: "4px",
                  }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
