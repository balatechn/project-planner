import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { cancelTeamsMeeting } from "@/lib/teams-graph";
import { logActivity } from "@/lib/activity";

// PATCH /api/room-bookings/[id] — update title/description/meetingNotes
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const booking = await prisma.roomBooking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // meetingNotes can be edited by organizer, admin, or PM
  const isOwner = booking.organizerId === user.id;
  const isAdmin = user.role === "ADMIN" || user.role === "PROJECT_MANAGER";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const updated = await prisma.roomBooking.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.meetingNotes !== undefined && { meetingNotes: body.meetingNotes }),
    },
    include: {
      room: { select: { id: true, name: true, color: true, capacity: true } },
      organizer: { select: { id: true, name: true, image: true, email: true } },
    },
  });
  logActivity({
    userId: user.id,
    action: body.status === "CANCELLED" ? "room_booking.cancelled" : "room_booking.updated",
    entityType: "room_booking",
    entityId: id,
    metadata: { title: updated.title, roomName: updated.room?.name },
  });

  return NextResponse.json({ booking: updated });
}

// DELETE /api/room-bookings/[id] — cancel booking
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const cancelAll = searchParams.get("cancelAll") === "true";

  const booking = await prisma.roomBooking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (booking.organizerId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (cancelAll && booking.recurringGroupId) {
    // Cancel all future instances in the recurring series
    await prisma.roomBooking.updateMany({
      where: {
        recurringGroupId: booking.recurringGroupId,
        startTime: { gte: booking.startTime },
      },
      data: { status: "CANCELLED" },
    });
  } else {
    await prisma.roomBooking.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
  }

  // Cancel Teams meeting if present
  if (booking.teamsMeetingId) {
    cancelTeamsMeeting(user.id, booking.teamsMeetingId).catch(() => undefined);
  }

  logActivity({
    userId: user.id,
    action: "room_booking.cancelled",
    entityType: "room_booking",
    entityId: id,
    metadata: { title: booking.title },
  });

  return NextResponse.json({ ok: true });
}
