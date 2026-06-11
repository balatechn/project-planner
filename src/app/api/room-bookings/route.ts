import { NextResponse } from "next/server";
import { addDays, addWeeks, addMonths, parseISO, formatISO, isAfter } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { createTeamsMeeting, sendBookingEmail, buildBookingEmailHtml } from "@/lib/teams-graph";

// GET /api/room-bookings?date=YYYY-MM-DD[&roomId=]
// Returns all bookings for the given date (default = today)
export async function GET(req: Request) {
  await requireUser();
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const roomId = searchParams.get("roomId");

  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);

  const bookings = await prisma.roomBooking.findMany({
    where: {
      status: { not: "CANCELLED" },
      startTime: { gte: dayStart },
      endTime: { lte: dayEnd },
      ...(roomId ? { roomId } : {}),
    },
    include: {
      room: { select: { id: true, name: true, color: true, capacity: true } },
      organizer: { select: { id: true, name: true, image: true, email: true } },
      bookedFor: { select: { id: true, name: true, image: true } },
    },
    orderBy: { startTime: "asc" },
  });
  return NextResponse.json({ bookings });
}

// POST /api/room-bookings — create booking (+ Teams meeting + notification)
export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json();

  const {
    roomId,
    bookedForId,
    title,
    description,
    startTime,
    endTime,
    attendeeIds = [],
    isRecurring = false,
    recurringType,
    recurringDays,
    recurringEnd,
  } = body;

  if (!roomId || !title || !startTime || !endTime) {
    return NextResponse.json({ error: "roomId, title, startTime, endTime required" }, { status: 400 });
  }

  // Check for conflicts on this room/time
  const conflict = await prisma.roomBooking.findFirst({
    where: {
      roomId,
      status: { not: "CANCELLED" },
      AND: [
        { startTime: { lt: new Date(endTime) } },
        { endTime: { gt: new Date(startTime) } },
      ],
    },
  });
  if (conflict) {
    return NextResponse.json({ error: "Room is already booked for this time slot" }, { status: 409 });
  }

  // Create Teams meeting
  const teamsMeeting = await createTeamsMeeting(user.id, title, startTime, endTime);

  // Build recurring instances if needed
  const instances: { startTime: Date; endTime: Date }[] = [];
  if (isRecurring && recurringType) {
    const start = parseISO(startTime);
    const end = parseISO(endTime);
    const recurEnd = recurringEnd ? parseISO(recurringEnd) : addMonths(start, 3);
    const MAX_INSTANCES = 52;
    let cursor = start;
    let count = 0;
    while (!isAfter(cursor, recurEnd) && count < MAX_INSTANCES) {
      if (count > 0) {
        instances.push({ startTime: cursor, endTime: new Date(cursor.getTime() + (end.getTime() - start.getTime())) });
      }
      count++;
      if (recurringType === "daily") cursor = addDays(cursor, 1);
      else if (recurringType === "weekly") cursor = addWeeks(cursor, 1);
      else if (recurringType === "monthly") cursor = addMonths(cursor, 1);
      else break;
    }
  }

  const groupId = isRecurring && instances.length > 0 ? crypto.randomUUID() : undefined;

  // Create the first (or only) booking
  const booking = await prisma.roomBooking.create({
    data: {
      roomId,
      organizerId: user.id,
      bookedForId: bookedForId ?? null,
      title,
      description: description ?? null,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      attendeeIds: attendeeIds ?? [],
      teamsJoinUrl: teamsMeeting?.joinUrl ?? null,
      teamsMeetingId: teamsMeeting?.meetingId ?? null,
      isRecurring: isRecurring && instances.length > 0,
      recurringType: recurringType ?? null,
      recurringDays: recurringDays ?? null,
      recurringEnd: recurringEnd ? new Date(recurringEnd) : null,
      recurringGroupId: groupId ?? null,
    },
    include: {
      room: { select: { id: true, name: true, color: true, capacity: true, floor: true } },
      organizer: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  // Create recurring instances (no separate Teams meetings for recurring)
  if (instances.length > 0 && groupId) {
    await prisma.roomBooking.createMany({
      data: instances.map((inst) => ({
        roomId,
        organizerId: user.id,
        bookedForId: bookedForId ?? null,
        title,
        description: description ?? null,
        startTime: inst.startTime,
        endTime: inst.endTime,
        attendeeIds: attendeeIds ?? [],
        teamsJoinUrl: teamsMeeting?.joinUrl ?? null,
        teamsMeetingId: teamsMeeting?.meetingId ?? null,
        isRecurring: true,
        recurringType: recurringType ?? null,
        recurringDays: recurringDays ?? null,
        recurringEnd: recurringEnd ? new Date(recurringEnd) : null,
        recurringGroupId: groupId,
      })),
      skipDuplicates: true,
    });
  }

  // Send confirmation email (non-blocking)
  if (booking.organizer.email) {
    const html = buildBookingEmailHtml({
      title,
      roomName: booking.room.name,
      startTime,
      endTime,
      teamsJoinUrl: teamsMeeting?.joinUrl,
      organizerName: booking.organizer.name ?? "You",
    });
    sendBookingEmail(user.id, booking.organizer.email, `Room Booked: ${title}`, html).catch(
      () => undefined,
    );
  }

  return NextResponse.json({ booking }, { status: 201 });
}
