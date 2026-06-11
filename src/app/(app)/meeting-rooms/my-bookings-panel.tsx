"use client";

import * as React from "react";
import { format, isPast, parseISO } from "date-fns";
import { CalendarX2, Clock, Loader2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BookingInfo, RoomInfo } from "./room-booking-client";

export function MyBookingsPanel({
  currentUserId,
  allRooms,
  onCancel,
  onEdit,
}: {
  currentUserId: string;
  allRooms: RoomInfo[];
  onCancel: (id: string, cancelAll?: boolean) => void;
  onEdit: (booking: BookingInfo) => void;
}) {
  const [bookings, setBookings] = React.useState<BookingInfo[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<"upcoming" | "past">("upcoming");

  React.useEffect(() => {
    setLoading(true);
    // Fetch upcoming bookings for current user (next 30 days range)
    const today = new Date();
    const start = today.toISOString().slice(0, 10);
    const future = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    // We'll fetch day by day up to 30 days — instead load all via a different approach
    // For now fetch today + 7 days
    Promise.all(
      Array.from({ length: 30 }, (_, i) => {
        const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);
        return fetch(`/api/room-bookings?date=${d}`, { cache: "no-store" })
          .then((r) => r.json())
          .then((d) => d.bookings as BookingInfo[]);
      }),
    )
      .then((all) => {
        const flat = all.flat().filter((b) => b.organizerId === currentUserId || b.bookedForId === currentUserId);
        // Deduplicate
        const seen = new Set<string>();
        const unique = flat.filter((b) => {
          if (seen.has(b.id)) return false;
          seen.add(b.id);
          return true;
        });
        setBookings(unique);
      })
      .finally(() => setLoading(false));
  }, [currentUserId]);

  const upcoming = bookings.filter(
    (b) => !isPast(parseISO(b.endTime)) && b.status === "CONFIRMED",
  );
  const past = bookings.filter(
    (b) => isPast(parseISO(b.endTime)) || b.status !== "CONFIRMED",
  );

  const displayed = filter === "upcoming" ? upcoming : past;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["upcoming", "past"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            {f === "upcoming" ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
          </button>
        ))}
      </div>

      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CalendarX2 className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            {filter === "upcoming" ? "No upcoming bookings" : "No past bookings"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed
            .sort(
              (a, b) =>
                new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
            )
            .map((b) => {
              const room = allRooms.find((r) => r.id === b.roomId);
              const start = parseISO(b.startTime);
              const end = parseISO(b.endTime);
              const cancelled = b.status === "CANCELLED";
              return (
                <div
                  key={b.id}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                    cancelled ? "opacity-50" : "hover:bg-muted/30"
                  }`}
                >
                  {/* Color dot */}
                  <span
                    className="mt-1 h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: room?.color ?? "#64748b" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{b.title}</p>
                      {cancelled && (
                        <span className="text-xs text-destructive font-medium">Cancelled</span>
                      )}
                      {b.isRecurring && (
                        <span className="text-xs text-muted-foreground">🔁 Recurring</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {room?.name ?? b.room.name}
                      {room?.floor ? ` · Floor ${room.floor}` : ""}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3" />
                      {format(start, "EEE, MMM d")} · {format(start, "h:mm")}–{format(end, "h:mma")}
                    </div>
                    {b.teamsJoinUrl && (
                      <a
                        href={b.teamsJoinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
                      >
                        <Video className="h-3 w-3" /> Join Teams
                      </a>
                    )}
                  </div>
                  {!cancelled && !isPast(start) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs hover:text-destructive"
                      onClick={() => onEdit(b)}
                    >
                      Edit
                    </Button>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
