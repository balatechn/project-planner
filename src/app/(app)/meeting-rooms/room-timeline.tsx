"use client";

import * as React from "react";
import { format, parseISO, differenceInMinutes, addMinutes } from "date-fns";
import { Monitor, Video } from "lucide-react";
import type { RoomInfo, BookingInfo, TeamsEvent } from "./room-booking-client";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────
const LABEL_W   = 52;    // px — time-label column width
const START_HOUR = 7;
const END_HOUR   = 22;
const TOTAL_HRS  = END_HOUR - START_HOUR;  // 15
const TOTAL_MIN  = TOTAL_HRS * 60;

// ── Helpers (percentage-based — auto-scales to any container height) ──────────
function minutesFromStart(time: Date | string, baseDate: Date): number {
  const t = typeof time === "string" ? parseISO(time) : time;
  const base = new Date(baseDate);
  base.setHours(START_HOUR, 0, 0, 0);
  return differenceInMinutes(t, base);
}

function topPct(time: Date | string, baseDate: Date): number {
  return Math.max(0, Math.min(100, (minutesFromStart(time, baseDate) / TOTAL_MIN) * 100));
}

function heightPct(start: Date | string, end: Date | string): number {
  const s = typeof start === "string" ? parseISO(start) : start;
  const e = typeof end   === "string" ? parseISO(end)   : end;
  return Math.max(0.5, (Math.max(15, differenceInMinutes(e, s)) / TOTAL_MIN) * 100);
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

  const hours     = Array.from({ length: TOTAL_HRS }, (_, i) => START_HOUR + i);
  const showTeams = teamsEvents.length > 0;
  const nowPct    = currentMinute >= 0 ? (currentMinute / TOTAL_MIN) * 100 : -1;

  // Click on empty slot → snap to nearest 30 min
  function handleSlotClick(e: React.MouseEvent<HTMLDivElement>, roomId: string) {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = (e.clientY - rect.top) / rect.height;
    const mins = Math.round(pct * TOTAL_MIN / 30) * 30;
    const base = new Date(selectedDate);
    base.setHours(START_HOUR, 0, 0, 0);
    const startTime = addMinutes(base, Math.max(0, mins));
    const endTime   = addMinutes(startTime, 60);
    onBookSlot(roomId, startTime.toISOString(), endTime.toISOString());
  }

  return (
    // flex-1 + min-h-0 makes this fill whatever height the parent gives it
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-lg border bg-card">

      {/* ── Column headers (room names) ─────────────────────────────────── */}
      <div className="flex flex-shrink-0 border-b bg-card">
        {/* Spacer above time labels */}
        <div className="flex-shrink-0 border-r" style={{ width: LABEL_W }} />

        {/* Room columns */}
        {rooms.map((room) => (
          <div key={room.id} className="flex-1 min-w-0 border-r px-3 py-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: room.color }} />
              <span className="text-sm font-semibold truncate">{room.name}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
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

        {/* Teams header */}
        {showTeams && (
          <div className="w-36 flex-shrink-0 px-3 py-2 bg-blue-500/5 border-l">
            <div className="flex items-center gap-1.5">
              <Monitor className="h-3 w-3 text-blue-500" />
              <span className="text-xs font-semibold text-blue-600 truncate">My Schedule</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Grid body — fills remaining height, NO overflow ─────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Time-label column */}
        <div
          className="flex-shrink-0 flex flex-col border-r bg-card select-none z-10"
          style={{ width: LABEL_W }}
        >
          {hours.map((h, i) => (
            <div key={h} className="flex-1 relative border-b border-border/15">
              {/* Label sits at the top edge of each hour band */}
              <span
                className="absolute left-1 text-[10px] font-medium text-muted-foreground leading-none"
                style={{ top: i === 0 ? 2 : -6 }}
              >
                {fmtHour(h)}
              </span>
            </div>
          ))}
        </div>

        {/* All room columns + current-time line in one relative wrapper */}
        <div className="relative flex flex-1 min-w-0 overflow-hidden">

          {/* Room columns */}
          {rooms.map((room) => {
            const roomBookings = bookings.filter((b) => b.roomId === room.id);
            return (
              <div
                key={room.id}
                className="relative flex-1 min-w-0 h-full border-r cursor-crosshair"
                onClick={(e) => handleSlotClick(e, room.id)}
              >
                {/* Hour bands */}
                {hours.map((_, i) => (
                  <React.Fragment key={i}>
                    {/* Alternating background */}
                    {i % 2 === 0 && (
                      <div
                        className="absolute inset-x-0 bg-muted/10"
                        style={{
                          top:    `${(i / TOTAL_HRS) * 100}%`,
                          height: `${(1 / TOTAL_HRS) * 100}%`,
                        }}
                      />
                    )}
                    {/* Hour line */}
                    <div
                      className="absolute inset-x-0 border-b border-border/20"
                      style={{ top: `${(i / TOTAL_HRS) * 100}%` }}
                    />
                    {/* Half-hour dashed line */}
                    <div
                      className="absolute inset-x-0 border-b border-dashed border-border/10"
                      style={{ top: `${((i + 0.5) / TOTAL_HRS) * 100}%` }}
                    />
                  </React.Fragment>
                ))}

                {/* Booking blocks */}
                {roomBookings.map((b) => {
                  const isOwn = b.organizerId === currentUserId;
                  const startFmt   = format(parseISO(b.startTime), "h:mm");
                  const endFmt     = format(parseISO(b.endTime),   "h:mma");
                  const durationMin = differenceInMinutes(parseISO(b.endTime), parseISO(b.startTime));

                  return (
                    <button
                      key={b.id}
                      type="button"
                      title={`${b.title} · ${startFmt}–${endFmt}`}
                      onClick={(e) => { e.stopPropagation(); onOpenBooking(b); }}
                      className={cn(
                        "absolute left-0.5 right-0.5 rounded px-1.5 pt-0.5 overflow-hidden text-left transition-opacity hover:opacity-90 z-10",
                        isOwn ? "ring-1 ring-inset ring-white/30" : "opacity-80",
                      )}
                      style={{
                        top:    `calc(${topPct(b.startTime, selectedDate)}% + 1px)`,
                        height: `calc(${heightPct(b.startTime, b.endTime)}% - 2px)`,
                        backgroundColor: room.color + "cc",
                      }}
                    >
                      <span className="text-[11px] font-semibold text-white leading-tight block truncate">
                        {b.title}
                      </span>
                      {durationMin >= 30 && (
                        <span className="text-[10px] text-white/80 leading-tight block">
                          {startFmt}–{endFmt}
                          {b.teamsJoinUrl && (
                            <Video className="inline h-2 w-2 ml-0.5 opacity-70" />
                          )}
                        </span>
                      )}
                      {durationMin >= 45 && b.organizer?.name && (
                        <span className="text-[10px] text-white/70 leading-tight block truncate">
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
            <div className="relative w-36 flex-shrink-0 bg-blue-500/5 h-full border-l">
              {hours.map((_, i) => (
                <div
                  key={i}
                  className="absolute inset-x-0 border-b border-border/20"
                  style={{ top: `${(i / TOTAL_HRS) * 100}%` }}
                />
              ))}
              {teamsEvents.map((ev) => {
                const dMin = differenceInMinutes(parseISO(ev.end.dateTime), parseISO(ev.start.dateTime));
                return (
                  <div
                    key={ev.id}
                    title={ev.subject}
                    className="absolute left-0.5 right-0.5 rounded px-1.5 pt-0.5 overflow-hidden bg-blue-500/25 border border-blue-400/40 z-10"
                    style={{
                      top:    `calc(${topPct(ev.start.dateTime, selectedDate)}% + 1px)`,
                      height: `calc(${heightPct(ev.start.dateTime, ev.end.dateTime)}% - 2px)`,
                    }}
                  >
                    <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300 leading-tight block truncate">
                      {ev.subject}
                    </span>
                    {dMin >= 30 && (
                      <span className="text-[10px] text-blue-600/70 leading-tight block">
                        {format(parseISO(ev.start.dateTime), "h:mm")}–{format(parseISO(ev.end.dateTime), "h:mma")}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Current-time horizontal red line */}
          {nowPct >= 0 && nowPct <= 100 && (
            <div
              className="absolute inset-x-0 z-30 pointer-events-none"
              style={{ top: `${nowPct}%` }}
            >
              <div className="relative">
                <div className="absolute -top-1.5 -left-1 h-3 w-3 rounded-full bg-destructive" />
                <div className="h-0.5 bg-destructive/70" />
              </div>
            </div>
          )}

          {/* No rooms placeholder */}
          {rooms.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              No rooms configured. Ask an admin to add meeting rooms.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
