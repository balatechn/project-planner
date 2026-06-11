import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { RoomBookingClient } from "./room-booking-client";

export const metadata: Metadata = { title: "Meeting Rooms" };

export default async function MeetingRoomsPage() {
  const user = await requireUser();

  // Load rooms + all users (for attendee picker / book on behalf)
  const [rooms, allUsers] = await Promise.all([
    prisma.room.findMany({
      where: { isActive: true },
      orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, image: true, department: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <RoomBookingClient
      rooms={rooms.map((r) => ({
        id: r.id,
        name: r.name,
        floor: r.floor,
        building: r.building,
        capacity: r.capacity,
        amenities: r.amenities,
        description: r.description,
        color: r.color,
      }))}
      allUsers={allUsers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        image: u.image,
        department: u.department,
      }))}
      currentUserId={user.id}
      currentUserRole={user.role}
    />
  );
}
