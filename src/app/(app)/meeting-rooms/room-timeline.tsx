"use client";

import * as React from "react";
import { format, parseISO, differenceInMinutes, addMinutes } from "date-fns";
import { Monitor, Video } from "lucide-react";
import type { RoomInfo, BookingInfo, TeamsEvent } from "./room-booking-client";
import { cn } from "@/lib/utils";

// ── Layout constants ──────────────────────────────────────────────────────────
const HOUR_WIDTH = 72;      // px per hour
const ROW_HEIGHT = 52;      // px per room row
const LABEL_WIDTH = 200;    // px for room label column
const START_HOUR = 7;       // 07:00
const END_HOUR = 22;        // 22:00
const TOTAL_HOURS = END_HOUR - START_HOUR;

function minuteOffset(time: Date | string, baseDate: Date): number {
  const t = typeof time === "string" ? parseISO(time) : time;
  const base = new Date(baseDate);
  base.setHours(START_HOUR, 0, 0, 0);
  return differenceInMinutes(t, base);
}

function leftPx(time: Date | string, baseDate: Date): number {
  return Math.max(0, (minuteOffset(time, baseDate) / 60) * HOUR_WIDTH) + LABEL_WIDTH;
}

function widthPx(startTime: Date | string, endTime: Date | string): number {
  const start = typeof startTime === "string" ? parseISO(startTime) : startTime;
  const end = typeof endTime === "string" ? parseISO(endTime) : endTime;
  return Math.max(4, (differenceInMinutes(end, start) / 60) * HOUR_WIDTH);
}

// ── Amenity icons ─────────────────────────────────────────────────────────────
const AMENITY_LABELS: Record<string, string> = {
  projector: "📽",
  whiteboard: "📋",
  videoConf: "📹",
  ac: "❄",
  phone: "📞",
};

export function RoomTimeline({
  rooms,
  bookings,
  teamsEvents,
  selectedDate,
  currentUserId,
  onBookSlot,
  onOpenBooking,
}: {
  rooms: RoomInfo[];
  bookings: BookingInfo[];
  teamsEvents: TeamsEvent[];
  selectedDate: Date;
  currentUserId: string;
  onBookSlot: (roomId: string, startTime: string, endTime: string) => void;
  onOpenBooking: (booking: BookingInfo) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [currentMinute, setCurrentMinute] = React.useState<number>(() => {
    const now = new Date();
    if (format(now, "yyyy-MM-dd") !== format(selectedDate, "yyyy-MM-dd")) return -1;
    return (now.getHours() - START_HOUR) * 60 + now.getMinutes();
  });

  // Update current time indicator every minute
  React.useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      if (format(now, "yyyy-MM-dd") !== format(selectedDate, "yyyy-MM-dd")) {
        setCurrentMinute(-1);
        return;
      }
      setCurrentMinute((now.getHours() - START_HOUR) * 60 + now.getMinutes());
    }, 60_000);
    return () => clearInterval(timer);
  }, [selectedDate]);

  // Scroll to current time on mount
  React.useEffect(() => {
    if (containerRef.current && currentMinute > 0) {
      const scrollLeft = Math.max(0, (currentMinute / 60) * HOUR_WIDTH - 200);
      containerRef.current.scrollLeft = scrollLeft;
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_HOUR + i);
  const totalWidth = TOTAL_HOURS * HOUR_WIDTH + LABEL_WIDTH;

  function handleSlotClick(e: React.MouseEvent, roomId: string) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left - LABEL_WIDTH;
    if (x < 0) return;
    const minutes = Math.round((x / HOUR_WIDTH) * 60 / 30) * 30; // snap to 30 min
    const base = new Date(selectedDate);
    base.setHours(START_HOUR, 0, 0, 0);
    const startTime = addMinutes(base, minutes);
    const endTime = addMinutes(startTime, 60);
    onBookSlot(
      roomId,
      startTime.toISOString(),
      endTime.toISOString(),
    );
  }

  return (
    <div className="flex-1 overflow-auto rounded-lg border bg-card" ref={containerRef}>
      <div style={{ minWidth: totalWidth }} className="relative select-none">
        {/* ── Header: hour labels ─────────────────────────────────────────── */}
        <div
          className="sticky top-0 z-20 flex border-b bg-card/95 backdrop-blur"
          style={{ height: 36 }}
        >
          {/* Room label spacer */}
          <div
            className="sticky left-0 z-30 bg-card border-r flex-shrink-0"
            style={{ width: LABEL_WIDTH }}
          />
          {/* Hour cells */}
          {hours.map((h) => (
            <div
              key={h}
              className="flex-shrink-0 border-r border-border/30 flex items-end pb-1 px-1"
              style={{ width: HOUR_WIDTH }}
            >
              <span className="text-[10px] text-muted-foreground font-medium">
                {h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h - 12}pm`}
              </span>
            </div>
          ))}
        </div>

        {/* ── Room rows ───────────────────────────────────────────────────── */}
        {rooms.map((room, idx) => {
          const roomBookings = bookings.filter((b) => b.roomId === room.id);

          return (
            <div
              key={room.id}
              className={cn(
                "flex relative cursor-crosshair",
                idx > 0 && "border-t",
              )}
              style={{ height: ROW_HEIGHT }}
              onClick={(e) => handleSlotClick(e, room.id)}
            >
              {/* Room label */}
              <div
                className="sticky left-0 z-10 flex flex-col justify-center px-3 bg-card border-r flex-shrink-0 cursor-default"
                style={{ width: LABEL_WIDTH }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: room.color }}
                  />
                  <span className="text-sm font-medium truncate">{room.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {room.floor && (
                    <span className="text-[10px] text-muted-foreground">Floor {room.floor}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    👥 {room.capacity}
                  </span>
                  {room.amenities.slice(0, 3).map((a) => (
                    <span key={a} className="text-[10px]" title={a}>
                      {AMENITY_LABELS[a] ?? a}
                    </span>
                  ))}
                </div>
              </div>

              {/* Hour grid background */}
              <div className="absolute inset-0" style={{ left: LABEL_WIDTH }}>
                <div className="flex h-full">
                  {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex-shrink-0 border-r border-border/20 h-full",
                        i % 2 === 0 ? "bg-muted/10" : "",
                      )}
                      style={{ width: HOUR_WIDTH }}
                    />
                  ))}
                </div>
              </div>

              {/* Booking blocks */}
              {roomBookings.map((b) => {
                const left = leftPx(b.startTime, selectedDate);
                const width = widthPx(b.startTime, b.endTime);
                const isOwn = b.organizerId === currentUserId;
                const startFmt = format(parseISO(b.startTime), "h:mm");
                const endFmt = format(parseISO(b.endTime), "h:mma");

                return (
                  <button
                    key={b.id}
                    type="button"
                    title={`${b.title} · ${startFmt}–${endFmt}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenBooking(b);
                    }}
                    className={cn(
                      "absolute top-1.5 bottom-1.5 rounded-md px-1.5 overflow-hidden text-left transition-opacity hover:opacity-90 z-10 group",
                      isOwn ? "ring-1 ring-inset ring-white/30" : "opacity-80",
                    )}
                    style={{
                      left,
                      width: Math.max(width, 4),
                      backgroundColor: room.color + "cc",
                    }}
                  >
                    {width > 40 && (
                      <span className="text-[11px] font-medium text-white leading-tight block truncate">
                        {b.title}
                      </span>
                    )}
                    {width > 80 && (
                      <span className="text-[10px] text-white/80 block truncate">
                        {startFmt}–{endFmt}
                        {b.teamsJoinUrl && <Video className="inline h-2.5 w-2.5 ml-1 opacity-70" />}
                      </span>
                    )}
                    {width > 80 && b.organizer?.name && (
                      <span className="text-[10px] text-white/70 block truncate">
                        {b.organizer.name.split(" ")[0]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}

        {/* ── Teams calendar overlay row ──────────────────────────────────── */}
        {teamsEvents.length > 0 && (
          <div
            className="flex border-t bg-blue-500/5 relative"
            style={{ height: ROW_HEIGHT }}
          >
            <div
              className="sticky left-0 z-10 flex flex-col justify-center px-3 bg-blue-500/5 border-r flex-shrink-0"
              style={{ width: LABEL_WIDTH }}
            >
              <div className="flex items-center gap-1.5">
                <Monitor className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-xs font-medium text-blue-600">My Teams Calendar</span>
              </div>
            </div>

            {/* Hour grid */}
            <div className="absolute inset-0" style={{ left: LABEL_WIDTH }}>
              <div className="flex h-full">
                {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 border-r border-border/20 h-full"
                    style={{ width: HOUR_WIDTH }}
                  />
                ))}
              </div>
            </div>

            {/* Teams event blocks */}
            {teamsEvents.map((ev) => {
              const left = leftPx(ev.start.dateTime, selectedDate);
              const width = widthPx(ev.start.dateTime, ev.end.dateTime);
              return (
                <div
                  key={ev.id}
                  title={`${ev.subject} · ${format(parseISO(ev.start.dateTime), "h:mm")}–${format(parseISO(ev.end.dateTime), "h:mma")}`}
                  className="absolute top-1.5 bottom-1.5 rounded-md px-1.5 overflow-hidden bg-blue-500/25 border border-blue-400/40 z-10"
                  style={{ left, width: Math.max(width, 4) }}
                >
                  {width > 40 && (
                    <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300 leading-tight block truncate">
                      {ev.subject}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── "No rooms" placeholder ─────────────────────────────────────── */}
        {rooms.length === 0 && (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            No rooms configured. Ask an admin to add meeting rooms.
          </div>
        )}

        {/* ── Current time indicator ─────────────────────────────────────── */}
        {currentMinute >= 0 && currentMinute <= TOTAL_HOURS * 60 && (
          <div
            className="absolute top-9 bottom-0 z-30 pointer-events-none"
            style={{
              left: LABEL_WIDTH + (currentMinute / 60) * HOUR_WIDTH,
              width: 2,
            }}
          >
            <div className="w-full h-full bg-destructive/70 rounded-full" />
            <div
              className="absolute -top-1 -left-1 h-3 w-3 rounded-full bg-destructive"
              style={{ transform: "translateX(-25%)" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
