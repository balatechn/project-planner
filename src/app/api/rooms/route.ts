import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/rbac";

// GET /api/rooms — list all active rooms
export async function GET() {
  await requireUser();
  const rooms = await prisma.room.findMany({
    where: { isActive: true },
    orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ rooms });
}

// POST /api/rooms — create room (admin / PM only)
export async function POST(req: Request) {
  const user = await requireUser();
  if (!can(user.role, "admin:users")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const { name, floor, building, capacity, amenities, description, color, orderIndex } = body;
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const room = await prisma.room.create({
    data: {
      name,
      floor: floor ?? null,
      building: building ?? null,
      capacity: capacity ?? 4,
      amenities: amenities ?? [],
      description: description ?? null,
      color: color ?? "#3b82f6",
      orderIndex: orderIndex ?? 0,
    },
  });
  return NextResponse.json({ room }, { status: 201 });
}
