"use client";

import * as React from "react";
import { addDays, subDays, format, isSameDay, startOfMonth, endOfMonth, addMonths, subMonths, parseISO } from "date-fns";
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Zap,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { RoomTimeline } from "./room-timeline";
import { BookRoomDialog } from "./book-room-dialog";
import { MyBookingsPanel } from "./my-bookings-panel";
import { QuickBookPanel } from "./quick-book-panel";
import { RoomMonthCalendar } from "./room-month-calendar";

export type RoomInfo = {
  id: string;
  name: string;
  floor: string | null;
  building: string | null;
  capacity: number;
  amenities: string[];
  description: string | null;
  color: string;
};

export type UserInfo = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  department: string | null;
};

export type BookingInfo = {
  id: string;
  roomId: string;
  organizerId: string;
  bookedForId: string | null;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  attendeeIds: string[];
  guestEmails: string[];
  teamsJoinUrl: string | null;
  teamsMeetingId: string | null;
  isRecurring: boolean;
  recurringGroupId: string | null;
  status: "CONFIRMED" | "CANCELLED" | "COMPLETED";
  meetingNotes: string | null;
  room: { id: string; name: string; color: string; capacity: number };
  organizer: { id: string; name: string | null; image: string | null; email: string | null };
  bookedFor: { id: string; name: string | null; image: string | null } | null;
};

export type TeamsEvent = {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: { displayName: string };
  isOnlineMeeting?: boolean;
};

type DialogState =
  | { mode: "closed" }
  | { mode: "create"; prefill?: { roomId?: string; startTime?: string; endTime?: string } }
  | { mode: "edit"; booking: BookingInfo };

type PanelView = "timeline" | "my-bookings" | "quick-book" | "month";

// ── Sidebar: mini month calendar ──────────────────────────────────────────────
function MiniCalendar({
  month, selectedDate, bookedDates, onSelectDay, onPrev, onNext,
}: {
  month: Date;
  selectedDate: Date;
  bookedDates: Set<string>;
  onSelectDay: (d: Date) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const DOW = ["S", "M", "T", "W", "T", "F", "S"];
  const firstDow = startOfMonth(month).getDay();
  const daysInMonth = endOfMonth(month).getDate();
  const today = new Date();

  const cells: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <button onClick={onPrev} className="p-0.5 rounded hover:bg-muted transition-colors">
          <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <span className="text-[11px] font-semibold">{format(month, "MMMM yyyy")}</span>
        <button onClick={onNext} className="p-0.5 rounded hover:bg-muted transition-colors">
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="grid grid-cols-7">
        {DOW.map((d, i) => (
          <div key={i} className="text-center text-[9px] font-medium text-muted-foreground py-0.5">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const date = new Date(month.getFullYear(), month.getMonth(), day);
          const ds   = format(date, "yyyy-MM-dd");
          const isSel = isSameDay(date, selectedDate);
          const isNow = isSameDay(date, today);
          const hasBkg = bookedDates.has(ds);
          return (
            <button
              key={i}
              onClick={() => onSelectDay(date)}
              className={cn(
                "relative text-[11px] py-0.5 rounded leading-5 text-center transition-colors",
                isSel ? "bg-primary text-primary-foreground font-semibold" :
                isNow ? "text-primary font-bold" :
                "hover:bg-muted/70 text-foreground",
              )}
            >
              {day}
              {hasBkg && !isSel && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary/50" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Sidebar: today's booking list ─────────────────────────────────────────────
function TodayList({
  bookings, rooms, selectedDate, onOpen,
}: {
  bookings: BookingInfo[];
  rooms: RoomInfo[];
  selectedDate: Date;
  onOpen: (b: BookingInfo) => void;
}) {
  const sorted = [...bookings]
    .filter((b) => b.status === "CONFIRMED")
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return sorted.length === 0 ? (
    <p className="text-xs text-muted-foreground text-center py-3">
      No bookings {isSameDay(selectedDate, new Date()) ? "today" : format(selectedDate, "d MMM")}
    </p>
  ) : (
    <div className="space-y-1">
      {sorted.map((b) => {
        const room = rooms.find((r) => r.id === b.roomId);
        return (
          <button
            key={b.id}
            onClick={() => onOpen(b)}
            className="flex w-full items-start gap-2 rounded-lg p-1.5 text-left transition-colors hover:bg-muted/50"
          >
            <span
              className="mt-0.5 h-2 w-1 shrink-0 rounded-full"
              style={{ backgroundColor: room?.color ?? "#888" }}
            />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium leading-tight">{b.title}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {format(parseISO(b.startTime), "h:mm")}–{format(parseISO(b.endTime), "h:mma")}
                {" · "}{room?.name ?? ""}
              </p>
              {b.meetingNotes && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-tight truncate">
                  📝 Notes added
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function RoomBookingClient({
  rooms,
  allUsers,
  currentUserId,
  currentUserRole,
}: {
  rooms: RoomInfo[];
  allUsers: UserInfo[];
  currentUserId: string;
  currentUserRole: Role;
}) {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());
  const [bookings, setBookings] = React.useState<BookingInfo[]>([]);
  const [teamsEvents, setTeamsEvents] = React.useState<TeamsEvent[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [dialog, setDialog] = React.useState<DialogState>({ mode: "closed" });
  const [panel, setPanel] = React.useState<PanelView>("timeline");

  // Month calendar state
  const [monthDate, setMonthDate] = React.useState<Date>(() => startOfMonth(new Date()));
  const [monthBookings, setMonthBookings] = React.useState<BookingInfo[]>([]);
  const [monthLoading, setMonthLoading] = React.useState(false);

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  // Load bookings + Teams calendar (single day — used by timeline)
  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, tRes] = await Promise.all([
        fetch(`/api/room-bookings?date=${dateStr}`, { cache: "no-store" }),
        fetch(`/api/teams/calendar?date=${dateStr}`, { cache: "no-store" }),
      ]);
      if (bRes.ok) {
        const { bookings } = await bRes.json();
        setBookings(bookings);
      }
      if (tRes.ok) {
        const { events } = await tRes.json();
        setTeamsEvents(events);
      }
    } finally {
      setLoading(false);
    }
  }, [dateStr]);

  // Load all bookings for the current month (used by month calendar)
  const loadMonth = React.useCallback(async () => {
    setMonthLoading(true);
    try {
      const start = format(startOfMonth(monthDate), "yyyy-MM-dd");
      const end = format(endOfMonth(monthDate), "yyyy-MM-dd");
      const res = await fetch(`/api/room-bookings?startDate=${start}&endDate=${end}`, { cache: "no-store" });
      if (res.ok) {
        const { bookings } = await res.json();
        setMonthBookings(bookings);
      }
    } finally {
      setMonthLoading(false);
    }
  }, [monthDate]);

  React.useEffect(() => {
    load();
  }, [load]);

  // Always keep month bookings fresh — needed for sidebar mini calendar dots too
  React.useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  // When selected date jumps to a different month, sync the month calendar
  React.useEffect(() => {
    const sm = startOfMonth(selectedDate);
    if (format(sm, "yyyy-MM") !== format(monthDate, "yyyy-MM")) {
      setMonthDate(sm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  function prevDay() { setSelectedDate((d) => subDays(d, 1)); }
  function nextDay() { setSelectedDate((d) => addDays(d, 1)); }
  function today() { setSelectedDate(new Date()); }

  function openCreate(prefill?: { roomId?: string; startTime?: string; endTime?: string }) {
    setDialog({ mode: "create", prefill });
  }

  function openEdit(booking: BookingInfo) {
    setDialog({ mode: "edit", booking });
  }

  async function cancelBooking(id: string, cancelAll = false) {
    const res = await fetch(
      `/api/room-bookings/${id}${cancelAll ? "?cancelAll=true" : ""}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      toast({ title: cancelAll ? "Series cancelled" : "Booking cancelled", variant: "success" });
      load();
      loadMonth();
    } else {
      toast({ title: "Failed to cancel", variant: "error" });
    }
  }

  const isToday = isSameDay(selectedDate, new Date());

  // Build set of dates that have bookings (for mini calendar dots)
  const bookedDates = React.useMemo(() => {
    const s = new Set<string>();
    monthBookings.forEach((b) => s.add(format(parseISO(b.startTime), "yyyy-MM-dd")));
    return s;
  }, [monthBookings]);

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-3 mb-3">
        <Building2 className="h-5 w-5 text-primary" />
        <h1 className="text-base font-bold tracking-tight">Meeting Rooms</h1>
        <span className="text-xs text-muted-foreground hidden sm:inline">
          {rooms.length} room{rooms.length !== 1 ? "s" : ""}
        </span>

        {/* Date navigation */}
        <div className="flex items-center gap-1 ml-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <button
            onClick={today}
            className="px-3 py-1 rounded-md text-sm font-medium hover:bg-muted transition-colors min-w-[120px] text-center"
          >
            {isToday ? "Today" : format(selectedDate, "EEE, MMM d")}
          </button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={today}>
              <CalendarDays className="h-3.5 w-3.5" /> Today
            </Button>
          )}
        </div>

        {/* View tabs */}
        <div className="flex items-center gap-1 ml-auto">
          <div className="flex rounded-lg border p-0.5 text-xs">
            {(["timeline", "month", "my-bookings", "quick-book"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setPanel(v)}
                className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${
                  panel === v ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {v === "timeline" ? "Timeline"
                  : v === "month" ? "Month"
                  : v === "my-bookings" ? "My Bookings"
                  : "Quick Book"}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="brand" size="sm" onClick={() => openCreate()}>
            <Plus className="h-4 w-4" /> Book Room
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPanel("quick-book")}
            className="hidden sm:flex"
          >
            <Zap className="h-4 w-4 text-amber-500" /> Quick Book
          </Button>
        </div>
      </div>

      {/* Content */}
      {panel === "timeline" && (
        <div className="flex flex-1 min-h-0 gap-3">
          {/* Main timeline */}
          <RoomTimeline
            rooms={rooms}
            bookings={bookings}
            teamsEvents={teamsEvents}
            selectedDate={selectedDate}
            currentUserId={currentUserId}
            onBookSlot={(roomId, startTime, endTime) =>
              openCreate({ roomId, startTime, endTime })
            }
            onOpenBooking={openEdit}
          />

          {/* Right sidebar — today's meetings + mini calendar */}
          <div className="w-56 flex-shrink-0 flex flex-col gap-3 overflow-y-auto overflow-x-hidden thin-scroll">
            {/* Today's meetings */}
            <div className="rounded-xl border bg-card p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {isToday ? "Today" : format(selectedDate, "EEE, d MMM")}
              </p>
              <TodayList
                bookings={bookings}
                rooms={rooms}
                selectedDate={selectedDate}
                onOpen={openEdit}
              />
            </div>

            {/* Mini month calendar */}
            <div className="rounded-xl border bg-card p-3">
              <MiniCalendar
                month={monthDate}
                selectedDate={selectedDate}
                bookedDates={bookedDates}
                onSelectDay={(d) => setSelectedDate(d)}
                onPrev={() => setMonthDate((m) => subMonths(m, 1))}
                onNext={() => setMonthDate((m) => addMonths(m, 1))}
              />
            </div>
          </div>
        </div>
      )}

      {panel === "month" && (
        <RoomMonthCalendar
          rooms={rooms}
          bookings={monthBookings}
          currentMonth={monthDate}
          loading={monthLoading}
          onPrevMonth={() => setMonthDate((d) => subMonths(d, 1))}
          onNextMonth={() => setMonthDate((d) => addMonths(d, 1))}
          onSelectDay={(date) => {
            setSelectedDate(date);
            setPanel("timeline");
          }}
        />
      )}

      {panel === "my-bookings" && (
        <MyBookingsPanel
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          allRooms={rooms}
          onCancel={cancelBooking}
          onEdit={openEdit}
        />
      )}

      {panel === "quick-book" && (
        <QuickBookPanel
          rooms={rooms}
          currentUserId={currentUserId}
          onBook={(roomId, start, end) => {
            openCreate({ roomId, startTime: start, endTime: end });
            setPanel("timeline");
          }}
        />
      )}

      {/* Booking dialog */}
      {dialog.mode !== "closed" && (
        <BookRoomDialog
          open
          rooms={rooms}
          allUsers={allUsers}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          prefill={dialog.mode === "create" ? dialog.prefill : undefined}
          editBooking={dialog.mode === "edit" ? dialog.booking : undefined}
          selectedDate={selectedDate}
          onClose={() => setDialog({ mode: "closed" })}
          onSaved={() => {
            setDialog({ mode: "closed" });
            load();
            loadMonth();
          }}
          onCancel={cancelBooking}
        />
      )}
    </div>
  );
}
