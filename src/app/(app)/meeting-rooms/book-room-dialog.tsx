"use client";

import * as React from "react";
import { format, parseISO, addHours } from "date-fns";
import {
  AlertTriangle,
  Calendar,
  ClipboardList,
  Clock,
  Loader2,
  MailPlus,
  RefreshCw,
  Repeat2,
  Search,
  Trash2,
  User,
  Users,
  Video,
  X,
} from "lucide-react";
import type { Role } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { can } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import type { RoomInfo, UserInfo, BookingInfo } from "./room-booking-client";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toLocalDateTimeString(iso: string): string {
  const d = parseISO(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localToISO(localStr: string): string {
  return new Date(localStr).toISOString();
}

function roundToNearest30(date: Date): Date {
  const ms = 30 * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

export function BookRoomDialog({
  open,
  rooms,
  allUsers,
  currentUserId,
  currentUserRole,
  prefill,
  editBooking,
  selectedDate,
  onClose,
  onSaved,
  onCancel,
}: {
  open: boolean;
  rooms: RoomInfo[];
  allUsers: UserInfo[];
  currentUserId: string;
  currentUserRole: Role;
  prefill?: { roomId?: string; startTime?: string; endTime?: string };
  editBooking?: BookingInfo;
  selectedDate: Date;
  onClose: () => void;
  onSaved: () => void;
  onCancel: (id: string, cancelAll?: boolean) => void;
}) {
  const { toast } = useToast();
  const isEdit = !!editBooking;
  const canBookOnBehalf = can(currentUserRole, "admin:users") || currentUserRole === "PROJECT_MANAGER";
  const canManage = can(currentUserRole, "admin:users") || currentUserRole === "PROJECT_MANAGER";
  // Only the organizer or an admin/PM can edit or cancel an existing booking
  const canEdit = !isEdit || editBooking?.organizerId === currentUserId || canManage;

  // Default start/end times
  const defaultStart = React.useMemo(() => {
    if (prefill?.startTime) return toLocalDateTimeString(prefill.startTime);
    const d = roundToNearest30(new Date());
    d.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    return toLocalDateTimeString(d.toISOString());
  }, [prefill?.startTime, selectedDate]);

  const defaultEnd = React.useMemo(() => {
    if (prefill?.endTime) return toLocalDateTimeString(prefill.endTime);
    return toLocalDateTimeString(addHours(parseISO(defaultStart + ":00.000Z"), 1).toISOString());
  }, [prefill?.endTime, defaultStart]);

  const [title, setTitle] = React.useState(editBooking?.title ?? "");
  const [description, setDescription] = React.useState(editBooking?.description ?? "");
  const [meetingNotes, setMeetingNotes] = React.useState(editBooking?.meetingNotes ?? "");

  // Meeting has ended if edit mode and end time is in the past
  const meetingEnded = isEdit && editBooking
    ? new Date(editBooking.endTime) < new Date()
    : false;
  const [roomId, setRoomId] = React.useState(
    editBooking?.roomId ?? prefill?.roomId ?? rooms[0]?.id ?? "",
  );
  const [startTime, setStartTime] = React.useState(
    editBooking ? toLocalDateTimeString(editBooking.startTime) : defaultStart,
  );
  const [endTime, setEndTime] = React.useState(
    editBooking ? toLocalDateTimeString(editBooking.endTime) : defaultEnd,
  );
  const [attendeeIds, setAttendeeIds] = React.useState<string[]>(
    editBooking?.attendeeIds ?? [],
  );
  const [bookedForId, setBookedForId] = React.useState<string>(
    editBooking?.bookedForId ?? "",
  );
  // Guest / external invite emails (newline or comma separated)
  const [guestEmailsRaw, setGuestEmailsRaw] = React.useState(
    editBooking?.guestEmails?.join("\n") ?? "",
  );

  // Directory search — declared after guestEmailsRaw so setters are in scope
  type DirUser = { azureId: string | null; name: string; email: string; jobTitle: string | null; department: string | null; localId: string | null };
  const [dirQuery, setDirQuery]       = React.useState("");
  const [dirResults, setDirResults]   = React.useState<DirUser[]>([]);
  const [dirLoading, setDirLoading]   = React.useState(false);
  const [dirOpen, setDirOpen]         = React.useState(false);
  const [selectedDir, setSelectedDir] = React.useState<DirUser[]>([]);
  const dirDebounce = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (dirQuery.length < 2) { setDirResults([]); setDirOpen(false); return; }
    if (dirDebounce.current) clearTimeout(dirDebounce.current);
    dirDebounce.current = setTimeout(async () => {
      setDirLoading(true);
      try {
        const res = await fetch(`/api/users/directory-search?q=${encodeURIComponent(dirQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setDirResults(data.users ?? []);
          setDirOpen(true);
        }
      } finally {
        setDirLoading(false);
      }
    }, 300);
    return () => { if (dirDebounce.current) clearTimeout(dirDebounce.current); };
  }, [dirQuery]);

  function selectDirUser(u: DirUser) {
    if (selectedDir.some((s) => s.email === u.email)) return;
    setSelectedDir((prev) => [...prev, u]);
    if (u.localId && !attendeeIds.includes(u.localId)) {
      setAttendeeIds((prev) => [...prev, u.localId!]);
    }
    if (!u.localId) {
      setGuestEmailsRaw((prev) => {
        const existing = prev.trim();
        return existing ? `${existing}\n${u.email}` : u.email;
      });
    }
    setDirQuery("");
    setDirOpen(false);
  }

  function removeDirUser(u: DirUser) {
    setSelectedDir((prev) => prev.filter((s) => s.email !== u.email));
    if (u.localId) setAttendeeIds((prev) => prev.filter((id) => id !== u.localId));
    if (!u.localId) {
      setGuestEmailsRaw((prev) =>
        prev.split(/[\n,]/).map((e) => e.trim()).filter((e) => e !== u.email).join("\n"),
      );
    }
  }

  // Recurrence
  const [recurring, setRecurring] = React.useState(editBooking?.isRecurring ?? false);
  const [recurringType, setRecurringType] = React.useState<"daily" | "weekly" | "monthly">("weekly");
  const [recurringDays, setRecurringDays] = React.useState<string[]>(["1"]);
  const [recurringEnd, setRecurringEnd] = React.useState("");

  const [saving, setSaving] = React.useState(false);
  const [conflict, setConflict] = React.useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = React.useState(false);

  // Company holidays — warn (but don't block) when booking on one
  const [holidays, setHolidays] = React.useState<{ date: string; name: string }[]>([]);
  React.useEffect(() => {
    if (!open) return;
    fetch("/api/holidays")
      .then((r) => (r.ok ? r.json() : { holidays: [] }))
      .then((d) => setHolidays(d.holidays ?? []))
      .catch(() => undefined);
  }, [open]);
  const holidayName = React.useMemo(() => {
    if (!startTime) return null;
    const day = startTime.slice(0, 10);
    return holidays.find((h) => h.date.slice(0, 10) === day)?.name ?? null;
  }, [holidays, startTime]);
  const [teamsCreating, setTeamsCreating] = React.useState(false);

  const selectedRoom = rooms.find((r) => r.id === roomId);

  async function save() {
    if (!title.trim()) { toast({ title: "Title required", variant: "error" }); return; }
    if (!roomId) { toast({ title: "Room required", variant: "error" }); return; }
    if (!startTime || !endTime) { toast({ title: "Time required", variant: "error" }); return; }
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (end <= start) { toast({ title: "End must be after start", variant: "error" }); return; }

    setSaving(true);
    setTeamsCreating(true);
    setConflict(null);
    try {
      if (isEdit) {
        const res = await fetch(`/api/room-bookings/${editBooking.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), description, meetingNotes }),
        });
        if (!res.ok) throw new Error("Update failed");
        toast({ title: "Booking updated", variant: "success" });
        onSaved();
      } else {
        // Parse guest emails from the textarea (comma or newline separated)
        const guestEmails = guestEmailsRaw
          .split(/[\n,]+/)
          .map((e) => e.trim())
          .filter((e) => e.includes("@"));

        const res = await fetch("/api/room-bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId,
            title: title.trim(),
            description,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            attendeeIds,
            guestEmails,
            bookedForId: bookedForId || null,
            isRecurring: recurring,
            recurringType: recurring ? recurringType : undefined,
            recurringDays: recurring && recurringType === "weekly" ? recurringDays.join(",") : undefined,
            recurringEnd: recurring && recurringEnd ? new Date(recurringEnd).toISOString() : undefined,
          }),
        });
        const data = await res.json();
        if (res.status === 409) {
          setConflict(data.error ?? "Room already booked");
          return;
        }
        if (!res.ok) throw new Error(data.error ?? "Booking failed");
        toast({
          title: "Room booked! 🎉",
          description: data.booking?.teamsJoinUrl ? "Teams meeting link created." : undefined,
          variant: "success",
        });
        onSaved();
      }
    } catch (err) {
      toast({ title: String(err), variant: "error" });
    } finally {
      setSaving(false);
      setTeamsCreating(false);
    }
  }

  function toggleAttendee(uid: string) {
    setAttendeeIds((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid],
    );
  }

  function toggleRecurringDay(day: string) {
    setRecurringDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {isEdit ? "Edit Booking" : "Book a Meeting Room"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">

          {/* Booked-by info (edit mode only) */}
          {isEdit && editBooking?.organizer && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Booked by</span>
                <span className="font-medium">{editBooking.organizer.name ?? editBooking.organizer.email}</span>
              </div>
              {!canEdit && (
                <span className="text-[11px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                  View only
                </span>
              )}
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Meeting title *</Label>
            <Input
              id="title"
              placeholder="e.g. Sprint Planning, Client Call…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              readOnly={!canEdit}
              className={!canEdit ? "bg-muted/40 cursor-default" : ""}
            />
          </div>

          {/* Room selection */}
          {!isEdit && (
            <div className="space-y-1.5">
              <Label>Room *</Label>
              <Select value={roomId} onValueChange={setRoomId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: r.color }}
                        />
                        <span>{r.name}</span>
                        <span className="text-muted-foreground text-xs">
                          👥 {r.capacity}
                          {r.floor ? ` · Floor ${r.floor}` : ""}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedRoom && selectedRoom.amenities.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Amenities: {selectedRoom.amenities.join(", ")}
                </p>
              )}
            </div>
          )}

          {/* Date + Time */}
          {!isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Start
                </Label>
                <Input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => {
                    setStartTime(e.target.value);
                    setConflict(null);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> End
                </Label>
                <Input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => {
                    setEndTime(e.target.value);
                    setConflict(null);
                  }}
                />
              </div>
            </div>
          )}

          {/* Conflict alert */}
          {conflict && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-sm text-destructive">{conflict}</p>
            </div>
          )}

          {/* Holiday warning (informational, booking still allowed) */}
          {holidayName && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                This date is a company holiday — <strong>{holidayName}</strong>.
              </p>
            </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description / Agenda</Label>
            <Textarea
              placeholder="Meeting agenda, topics to cover…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              readOnly={!canEdit}
              className={!canEdit ? "bg-muted/40 cursor-default" : ""}
            />
          </div>

          {/* Meeting Notes — shown only after meeting has ended */}
          {meetingEnded && (
            <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20 p-3">
              <Label className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                <ClipboardList className="h-3.5 w-3.5" />
                Post-Meeting Notes
              </Label>
              <Textarea
                placeholder="Summary, decisions made, follow-up actions…"
                value={meetingNotes}
                onChange={(e) => setMeetingNotes(e.target.value)}
                rows={3}
                readOnly={!canEdit}
                className={`text-sm ${!canEdit ? "bg-muted/40 cursor-default" : "border-amber-200 dark:border-amber-900/40 focus-visible:ring-amber-500/30"}`}
              />
              {!canEdit && (
                <p className="text-[10px] text-muted-foreground">Only the organizer or admin can edit notes.</p>
              )}
            </div>
          )}

          {/* Book on behalf (admin/PM only) */}
          {canBookOnBehalf && !isEdit && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> Book on behalf of
              </Label>
              <Select value={bookedForId || "__self"} onValueChange={(v) => setBookedForId(v === "__self" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__self">Myself</SelectItem>
                  {allUsers
                    .filter((u) => u.id !== currentUserId)
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name ?? u.email}
                        {u.department ? ` · ${u.department}` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Attendees */}
          {!isEdit && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> Invite attendees
              </Label>

              {/* Selected chips */}
              {selectedDir.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedDir.map((u) => (
                    <span key={u.email} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      {u.name}
                      {!u.localId && <span className="text-[10px] opacity-60">(guest)</span>}
                      <button type="button" onClick={() => removeDirUser(u)} className="ml-0.5 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Directory search input */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={dirQuery}
                  onChange={(e) => setDirQuery(e.target.value)}
                  onFocus={() => dirResults.length > 0 && setDirOpen(true)}
                  onBlur={() => setTimeout(() => setDirOpen(false), 150)}
                  placeholder="Search Microsoft directory…"
                  className="w-full rounded-lg py-2 pl-8 pr-3 text-sm neu-inset placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                />
                {dirLoading && (
                  <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}

                {/* Dropdown results */}
                {dirOpen && dirResults.length > 0 && (
                  <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl neu-card py-1 overflow-hidden">
                    {dirResults.map((u) => {
                      const alreadyAdded = selectedDir.some((s) => s.email === u.email);
                      return (
                        <button
                          key={u.email}
                          type="button"
                          onMouseDown={() => !alreadyAdded && selectDirUser(u)}
                          className={cn(
                            "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                            alreadyAdded ? "opacity-40 cursor-default" : "hover:bg-muted/60",
                          )}
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                            {(u.name ?? "?")[0].toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{u.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {u.email}{u.jobTitle ? ` · ${u.jobTitle}` : ""}
                            </p>
                          </div>
                          {!u.localId && (
                            <span className="text-[10px] text-amber-600 font-medium shrink-0">guest</span>
                          )}
                          {alreadyAdded && (
                            <span className="text-[10px] text-muted-foreground shrink-0">added</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Local users quick-pick */}
              {allUsers.filter((u) => u.id !== currentUserId).length > 0 && (
                <div className="max-h-28 overflow-y-auto rounded-lg neu-inset-sm p-2 space-y-0.5 thin-scroll">
                  <p className="text-[10px] text-muted-foreground px-1 pb-0.5 font-medium uppercase tracking-wide">Quick pick</p>
                  {allUsers
                    .filter((u) => u.id !== currentUserId)
                    .map((u) => (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 px-1 py-0.5 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={attendeeIds.includes(u.id)}
                          onChange={() => toggleAttendee(u.id)}
                          className="rounded"
                        />
                        <span className="truncate">
                          {u.name ?? u.email}
                          {u.department ? (
                            <span className="text-muted-foreground text-xs"> · {u.department}</span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* External / Guest email invites */}
          {!isEdit && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <MailPlus className="h-3.5 w-3.5" /> External guests
                <span className="ml-1 text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                placeholder={"vendor@example.com\nclient@company.com"}
                value={guestEmailsRaw}
                onChange={(e) => setGuestEmailsRaw(e.target.value)}
                rows={2}
                className="text-sm font-mono"
              />
              <p className="text-xs text-muted-foreground">
                One email per line (or comma-separated). Each guest receives a calendar invite (.ics) with the Teams meeting link.
              </p>
            </div>
          )}

          {/* Recurring */}
          {!isEdit && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recurring}
                  onChange={(e) => setRecurring(e.target.checked)}
                  className="rounded"
                />
                <Repeat2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Recurring booking</span>
              </label>

              {recurring && (
                <div className="ml-6 space-y-3 rounded-md border p-3 bg-muted/20">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Repeat</Label>
                      <Select
                        value={recurringType}
                        onValueChange={(v) => setRecurringType(v as typeof recurringType)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">End date</Label>
                      <Input
                        type="date"
                        value={recurringEnd}
                        onChange={(e) => setRecurringEnd(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  {recurringType === "weekly" && (
                    <div className="space-y-1">
                      <Label className="text-xs">Repeat on</Label>
                      <div className="flex gap-1">
                        {WEEKDAYS.map((d, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => toggleRecurringDay(String(i))}
                            className={`h-7 w-7 rounded-full text-[11px] font-medium transition-colors ${
                              recurringDays.includes(String(i))
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted hover:bg-muted/80"
                            }`}
                          >
                            {d[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Teams note */}
          {!isEdit && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-blue-500/5 border border-blue-200/30 rounded-md px-3 py-2">
              <Video className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
              A Teams meeting link will be auto-created and sent by email.
            </div>
          )}

          {/* Edit: existing Teams link */}
          {isEdit && editBooking?.teamsJoinUrl && (
            <a
              href={editBooking.teamsJoinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
            >
              <Video className="h-4 w-4" /> Join Teams Meeting
            </a>
          )}

          {/* Edit: cancel booking — owner / admin / PM only */}
          {isEdit && canEdit && (
            <div className="flex items-center gap-2 pt-1">
              {!cancelConfirm ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setCancelConfirm(true)}
                >
                  <Trash2 className="h-4 w-4" /> Cancel booking
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-destructive">
                    {editBooking?.isRecurring ? "Cancel just this or all?" : "Confirm cancel?"}
                  </span>
                  {editBooking?.isRecurring && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onCancel(editBooking!.id, false)}
                    >
                      This only
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onCancel(editBooking!.id, editBooking?.isRecurring)}
                  >
                    {editBooking?.isRecurring ? "All future" : "Cancel"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setCancelConfirm(false)}>
                    Keep
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-2">
          {isEdit && !canEdit && (
            <span className="mr-auto text-xs text-muted-foreground">
              You can only edit bookings you created.
            </span>
          )}
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Close
          </Button>
          {canEdit && (
            <Button variant="brand" onClick={save} disabled={saving}>
              {saving ? (
                <>
                  {teamsCreating ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {teamsCreating ? "Creating Teams link…" : "Saving…"}
                </>
              ) : isEdit ? (
                "Save changes"
              ) : (
                "Book Room"
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
