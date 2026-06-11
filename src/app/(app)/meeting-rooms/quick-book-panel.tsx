"use client";

import * as React from "react";
import { addMinutes, format } from "date-fns";
import { CheckCircle2, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RoomInfo } from "./room-booking-client";

const DURATIONS = [30, 60, 90, 120] as const;

type AvailableRoom = RoomInfo & { nextFree?: string };

export function QuickBookPanel({
  rooms,
  currentUserId,
  onBook,
}: {
  rooms: RoomInfo[];
  currentUserId: string;
  onBook: (roomId: string, startTime: string, endTime: string) => void;
}) {
  const [duration, setDuration] = React.useState<(typeof DURATIONS)[number]>(60);
  const [checking, setChecking] = React.useState(false);
  const [available, setAvailable] = React.useState<AvailableRoom[]>([]);
  const [checked, setChecked] = React.useState(false);

  const now = new Date();
  const start = new Date(Math.ceil(now.getTime() / (15 * 60 * 1000)) * (15 * 60 * 1000)); // round to 15 min
  const end = addMinutes(start, duration);

  async function checkAvailability() {
    setChecking(true);
    setChecked(false);
    const date = format(start, "yyyy-MM-dd");
    try {
      const res = await fetch(`/api/room-bookings?date=${date}`, { cache: "no-store" });
      if (!res.ok) return;
      const { bookings } = await res.json();

      const availableRooms = rooms.filter((room) => {
        const conflicts = bookings.filter(
          (b: { roomId: string; status: string; startTime: string; endTime: string }) =>
            b.roomId === room.id &&
            b.status !== "CANCELLED" &&
            new Date(b.startTime) < end &&
            new Date(b.endTime) > start,
        );
        return conflicts.length === 0;
      });
      setAvailable(availableRooms);
      setChecked(true);
    } finally {
      setChecking(false);
    }
  }

  React.useEffect(() => {
    checkAvailability();
  }, [duration]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-lg space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Zap className="h-5 w-5 text-amber-500" />
        <h2 className="text-base font-semibold">Quick Book Now</h2>
      </div>

      {/* Time info */}
      <div className="rounded-lg border bg-muted/20 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Booking for <strong className="text-foreground">right now</strong>
        </p>
        <p className="text-lg font-bold mt-0.5">
          {format(start, "h:mm a")} – {format(end, "h:mm a")}
        </p>
        <p className="text-xs text-muted-foreground">Today, {format(start, "EEEE, MMMM d")}</p>
      </div>

      {/* Duration selector */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Duration</p>
        <div className="flex gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDuration(d)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-1 ${
                duration === d
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {d < 60 ? `${d}m` : `${d / 60}h`}
            </button>
          ))}
        </div>
      </div>

      {/* Available rooms */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            {checking
              ? "Checking availability…"
              : checked
              ? `${available.length} room${available.length !== 1 ? "s" : ""} available`
              : "Available rooms"}
          </p>
          <Button variant="ghost" size="sm" onClick={checkAvailability} disabled={checking}>
            {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Refresh"}
          </Button>
        </div>

        {checking ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : available.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No rooms free for this duration right now.
            <br />
            Try a shorter duration.
          </div>
        ) : (
          <div className="space-y-2">
            {available.map((room) => (
              <div
                key={room.id}
                className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors"
              >
                <span
                  className="h-3 w-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: room.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{room.name}</p>
                  <p className="text-xs text-muted-foreground">
                    👥 {room.capacity}
                    {room.floor ? ` · Floor ${room.floor}` : ""}
                    {room.amenities.length > 0
                      ? ` · ${room.amenities.slice(0, 2).join(", ")}`
                      : ""}
                  </p>
                </div>
                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                <Button
                  variant="brand"
                  size="sm"
                  onClick={() =>
                    onBook(room.id, start.toISOString(), end.toISOString())
                  }
                >
                  Book
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
