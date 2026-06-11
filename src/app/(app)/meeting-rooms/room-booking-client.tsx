"use client";

import * as React from "react";
import { addDays, subDays, format, isSameDay } from "date-fns";
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
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { RoomTimeline } from "./room-timeline";
import { BookRoomDialog } from "./book-room-dialog";
import { MyBookingsPanel } from "./my-bookings-panel";
import { QuickBookPanel } from "./quick-book-panel";

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
  teamsJoinUrl: string | null;
  teamsMeetingId: string | null;
  isRecurring: boolean;
  recurringGroupId: string | null;
  status: "CONFIRMED" | "CANCELLED" | "COMPLETED";
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

type PanelView = "timeline" | "my-bookings" | "quick-book";

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

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  // Load bookings + Teams calendar
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

  React.useEffect(() => {
    load();
  }, [load]);

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
    } else {
      toast({ title: "Failed to cancel", variant: "error" });
    }
  }

  const isToday = isSameDay(selectedDate, new Date());

  return (
    <div className="flex h-full flex-col gap-0">
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
            {(["timeline", "my-bookings", "quick-book"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setPanel(v)}
                className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${
                  panel === v ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {v === "timeline" ? "Timeline" : v === "my-bookings" ? "My Bookings" : "Quick Book"}
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
      )}

      {panel === "my-bookings" && (
        <MyBookingsPanel
          currentUserId={currentUserId}
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
          }}
          onCancel={cancelBooking}
        />
      )}
    </div>
  );
}
