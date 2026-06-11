"use client";

import * as React from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BookingInfo, RoomInfo } from "./room-booking-client";

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
  rooms: RoomInfo[];
  bookings: BookingInfo[];
  currentMonth: Date;
  loading: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  /** Click a day → switch to timeline view on that date */
  onSelectDay: (date: Date) => void;
}

export function RoomMonthCalendar({
  rooms,
  bookings,
  currentMonth,
  loading,
  onPrevMonth,
  onNextMonth,
  onSelectDay,
}: Props) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  // Group bookings by UTC date key
  const bookingsByDay = React.useMemo(() => {
    const map = new Map<string, BookingInfo[]>();
    for (const b of bookings) {
      const key = new Date(b.startTime).toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    return map;
  }, [bookings]);

  // Chunk days into week rows
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  // Room legend
  const roomColors = rooms.map((r) => ({ name: r.name, color: r.color }));

  return (
    <div className="flex h-full flex-col min-h-0 select-none">

      {/* ── Month nav + legend ───────────────────────────────── */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0 gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onPrevMonth} disabled={loading}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-semibold">
            {format(currentMonth, "MMMM yyyy")}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNextMonth} disabled={loading}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-1" />}
        </div>

        {/* Room colour legend */}
        <div className="flex items-center gap-3">
          {roomColors.map((r) => (
            <div key={r.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: r.color }} />
              {r.name}
            </div>
          ))}
        </div>
      </div>

      {/* ── Day-of-week headers ──────────────────────────────── */}
      <div className="grid grid-cols-7 flex-shrink-0 border-l border-t rounded-tl-sm rounded-tr-sm overflow-hidden">
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            className="border-r border-b bg-muted/40 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      {/* ── Calendar grid — fills remaining height, no overflow ─ */}
      <div
        className={`grid grid-cols-7 flex-1 min-h-0 border-l overflow-hidden transition-opacity ${loading ? "opacity-50" : "opacity-100"}`}
        style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }}
      >
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayBookings = bookingsByDay.get(key) ?? [];
          const inMonth = isSameMonth(day, currentMonth);
          const isCurrentDay = isToday(day);
          const MAX_VISIBLE = 3;
          const visible = dayBookings.slice(0, MAX_VISIBLE);
          const extra = dayBookings.length - MAX_VISIBLE;

          return (
            <div
              key={key}
              onClick={() => inMonth && onSelectDay(day)}
              className={`border-r border-b flex flex-col gap-0.5 min-h-0 overflow-hidden p-1
                ${inMonth
                  ? "cursor-pointer hover:bg-primary/5 transition-colors"
                  : "bg-muted/10 opacity-40 cursor-default"
                }
              `}
            >
              {/* Day number */}
              <div className="flex-shrink-0 flex justify-end">
                <span
                  className={`text-[11px] font-semibold leading-none
                    ${isCurrentDay
                      ? "bg-primary text-primary-foreground rounded-full w-[18px] h-[18px] flex items-center justify-center"
                      : inMonth
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }
                  `}
                >
                  {format(day, "d")}
                </span>
              </div>

              {/* Booking chips — truncated to fit cell height */}
              <div className="flex flex-col gap-0.5 min-h-0 overflow-hidden flex-1">
                {visible.map((b) => (
                  <div
                    key={b.id}
                    className="text-[10px] leading-tight px-1 py-px rounded truncate text-white font-medium flex-shrink-0"
                    style={{ backgroundColor: b.room.color }}
                    title={`${b.room.name}: ${b.title}  ${format(new Date(b.startTime), "HH:mm")}–${format(new Date(b.endTime), "HH:mm")}`}
                  >
                    <span className="opacity-80 mr-0.5">{format(new Date(b.startTime), "HH:mm")}</span>
                    {b.title}
                  </div>
                ))}
                {extra > 0 && (
                  <div className="text-[10px] text-muted-foreground leading-tight flex-shrink-0 pl-0.5">
                    +{extra} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
