"use client";

import * as React from "react";
import { format, parseISO, differenceInMinutes, addMinutes } from "date-fns";
import { Monitor, Video } from "lucide-react";
import type { RoomInfo, BookingInfo, TeamsEvent } from "./room-booking-client";
import { cn } from "@/lib/utils";

// ── Layout constants ──────────────────────────────────────────────────────────
const HOUR_HEIGHT  = 64;   // px per hour slot
const LABEL_WIDTH  = 56;   // px for the time-label column on the left
const COL_MIN_W    = 160;  // minimum px per room column
const START_HOUR   = 7;
const END_HOUR     = 22;
const TOTAL_HOURS  = END_HOUR - START_HOUR;
const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT;

// ── Helpers ───────────────────────────────────────────────────────────────────
function minuteOffset(time: Date | string, baseDate: Date): number {
  const t = typeof time === "string" ? parseISO(time) : time;
  const base = new Date(baseDate);
  base.setHours(START_HOUR, 0, 0, 0);
  return differenceInMinutes(t, base);
}

function topPx(time: Date | string, baseDate: Date): number {
  return Math.max(0, (minuteOffset(time, baseDate) / 60) * HOUR_HEIGHT);
}

function blockHeight(start: Date | string, end: Date | string): number {
  const s = typeof start === "string" ? parseISO(start) : start;
  const e = typeof end   === "string" ? parseISO(end)   : end;
  return Math.max(20, (differenceInMinutes(e, s) / 60) * HOUR_HEIGHT);
}

function fmtHour(h: number): string {
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

const AMENITY_ICONS: Record<string, string> = {
  projector: "📽", whiteboard: "📋", videoConf: "📹", ac: "❄", phone: "📞",
};

// ── Component ─────────────────────────────────────────────────────────────────
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

  // Scroll so current time is near the top of the visible area
  React.useEffect(() => {
    if (containerRef.current && currentMinute > 0) {
      containerRef.current.scrollTop = Math.max(0, (currentMinute / 60) * HOUR_HEIGHT - 120);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i);
  const showTeams = teamsEvents.length > 0;

  function handleSlotClick(e: React.MouseEvent<HTMLDivElement>, roomId: string) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutes = Math.round((y / HOUR_HEIGHT) * 60 / 30) * 30; // snap 30 min
    const base = new Date(selectedDate);
    base.setHours(START_HOUR, 0, 0, 0);
    const startTime = addMinutes(base, minutes);
    const endTime   = addMinutes(startTime, 60);
    onBookSlot(roomId, startTime.toISOString(), endTime.toISOString());
  }

  return (
    <div className="flex-1 overflow-auto rounded-lg border bg-card" ref={containerRef}>

      {/* ── Sticky column-header row ─────────────────────────────────────── */}
      <div className="sticky top-0 z-20 flex border-b bg-card/95 backdrop-blur">
        {/* Time-label spacer */}
        <div className="flex-shrink-0 border-r bg-card/95" style={{ width: LABEL_WIDTH }} />

        {/* Room headers */}
        {rooms.map((room) => (
          <div
            key={room.id}
            className="flex-1 border-r px-3 py-2.5"
            style={{ minWidth: COL_MIN_W }}
          >
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: room.color }} />
              <span className="text-sm font-semibold truncate">{room.name}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-muted-foreground">👥 {room.capacity}</span>
              {room.floor && (
                <span className="text-[10px] text-muted-foreground">Floor {room.floor}</span>
              )}
              {room.amenities.slice(0, 3).map((a) => (
                <span key={a} className="text-[10px]" title={a}>{AMENITY_ICONS[a] ?? a}</span>
              ))}
            </div>
          </div>
        ))}

        {/* Teams calendar header */}
        {showTeams && (
          <div className="w-40 shrink-0 px-3 py-2.5 bg-blue-500/5">
            <div className="flex items-center gap-1.5">
              <Monitor className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-semibold text-blue-600">My Schedule</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Teams calendar</p>
          </div>
        )}
      </div>

      {/* ── Grid body ────────────────────────────────────────────────────── */}
      <div className="relative flex" style={{ minHeight: TOTAL_HEIGHT }}>

        {/* Time-label column (sticky left) */}
        <div
          className="sticky left-0 z-10 shrink-0 bg-card border-r select-none"
          style={{ width: LABEL_WIDTH }}
        >
          {hours.map((h, i) => (
            <div key={h} className="relative border-b border-border/20" style={{ height: HOUR_HEIGHT }}>
              <span className="absolute -top-2 left-1.5 text-[10px] font-medium text-muted-foreground">
                {fmtHour(h)}
              </span>
            </div>
          ))}
        </div>

        {/* Room columns */}
        {rooms.map((room) => {
          const roomBookings = bookings.filter((b) => b.roomId === room.id);
          return (
            <div
              key={room.id}
              className="relative flex-1 border-r cursor-crosshair"
              style={{ minWidth: COL_MIN_W, height: TOTAL_HEIGHT }}
              onClick={(e) => handleSlotClick(e, room.id)}
            >
              {/* Hour bands */}
              {hours.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "absolute w-full border-b border-border/20",
                    i % 2 === 0 ? "bg-muted/10" : "",
                  )}
                  style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                />
              ))}
              {/* Half-hour dashed lines */}
              {hours.map((_, i) => (
                <div
                  key={`h${i}`}
                  className="absolute w-full border-b border-dashed border-border/10"
                  style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                />
              ))}

              {/* Booking blocks */}
              {roomBookings.map((b) => {
                const top    = topPx(b.startTime, selectedDate);
                const height = blockHeight(b.startTime, b.endTime);
                const isOwn  = b.organizerId === currentUserId;
                const startFmt = format(parseISO(b.startTime), "h:mm");
                const endFmt   = format(parseISO(b.endTime),   "h:mma");

                return (
                  <button
                    key={b.id}
                    type="button"
                    title={`${b.title} · ${startFmt}–${endFmt}`}
                    onClick={(e) => { e.stopPropagation(); onOpenBooking(b); }}
                    className={cn(
                      "absolute left-1 right-1 rounded-md px-2 py-1 overflow-hidden text-left transition-opacity hover:opacity-90 z-10",
                      isOwn ? "ring-1 ring-inset ring-white/30" : "opacity-80",
                    )}
                    style={{
                      top: top + 2,
                      height: Math.max(height - 4, 20),
                      backgroundColor: room.color + "cc",
                    }}
                  >
                    {height > 20 && (
                      <span className="text-[11px] font-semibold text-white leading-tight block truncate">
                        {b.title}
                      </span>
                    )}
                    {height > 36 && (
                      <span className="text-[10px] text-white/80 block">
                        {startFmt}–{endFmt}
                        {b.teamsJoinUrl && <Video className="inline h-2.5 w-2.5 ml-1 opacity-70" />}
                      </span>
                    )}
                    {height > 54 && b.organizer?.name && (
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

        {/* Teams calendar column */}
        {showTeams && (
          <div
            className="relative w-40 shrink-0 bg-blue-500/5"
            style={{ height: TOTAL_HEIGHT }}
          >
            {hours.map((_, i) => (
              <div
                key={i}
                className="absolute w-full border-b border-border/20"
                style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
              />
            ))}
            {teamsEvents.map((ev) => {
              const top    = topPx(ev.start.dateTime, selectedDate);
              const height = blockHeight(ev.start.dateTime, ev.end.dateTime);
              return (
                <div
                  key={ev.id}
                  title={`${ev.subject} · ${format(parseISO(ev.start.dateTime), "h:mm")}–${format(parseISO(ev.end.dateTime), "h:mma")}`}
                  className="absolute left-1 right-1 rounded-md px-2 py-1 overflow-hidden bg-blue-500/25 border border-blue-400/40 z-10"
                  style={{ top: top + 2, height: Math.max(height - 4, 20) }}
                >
                  {height > 20 && (
                    <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300 leading-tight block truncate">
                      {ev.subject}
                    </span>
                  )}
                  {height > 36 && (
                    <span className="text-[10px] text-blue-600/70 block">
                      {format(parseISO(ev.start.dateTime), "h:mm")}–{format(parseISO(ev.end.dateTime), "h:mma")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Current-time red line (horizontal) ────────────────────────── */}
        {currentMinute >= 0 && currentMinute <= TOTAL_HOURS * 60 && (
          <div
            className="absolute z-30 pointer-events-none"
            style={{ top: (currentMinute / 60) * HOUR_HEIGHT, left: LABEL_WIDTH, right: 0 }}
          >
            <div className="relative">
              <div className="absolute -top-1.5 -left-1.5 h-3 w-3 rounded-full bg-destructive" />
              <div className="h-0.5 bg-destructive/70" />
            </div>
          </div>
        )}

        {/* No rooms placeholder */}
        {rooms.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-16 text-sm text-muted-foreground">
            No rooms configured. Ask an admin to add meeting rooms.
          </div>
        )}
      </div>
    </div>
  );
}
