import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function CalendarLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 pb-1">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-64" />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          {/* Month navigation */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
          <Skeleton className="h-8 w-20 rounded-lg" />
        </CardHeader>
        <CardContent className="p-0">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-2 text-center">
                <Skeleton className="mx-auto h-3 w-7" />
              </div>
            ))}
          </div>
          {/* Calendar grid — 5 weeks */}
          {Array.from({ length: 5 }).map((_, week) => (
            <div key={week} className="grid grid-cols-7 border-b last:border-0">
              {Array.from({ length: 7 }).map((_, day) => (
                <div
                  key={day}
                  className="min-h-[80px] border-r p-2 last:border-0 space-y-1"
                >
                  <Skeleton className="h-5 w-5 rounded-full" />
                  {Math.random() > 0.65 && (
                    <Skeleton className="h-5 w-full rounded" />
                  )}
                  {Math.random() > 0.8 && (
                    <Skeleton className="h-5 w-4/5 rounded" />
                  )}
                </div>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
