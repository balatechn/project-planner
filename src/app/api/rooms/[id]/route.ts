import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/rbac";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ room });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user.role, "admin:users")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const room = await prisma.room.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.floor !== undefined && { floor: body.floor }),
      ...(body.building !== undefined && { building: body.building }),
      ...(body.capacity !== undefined && { capacity: body.capacity }),
      ...(body.amenities !== undefined && { amenities: body.amenities }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.color !== undefined && { color: body.color }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.orderIndex !== undefined && { orderIndex: body.orderIndex }),
    },
  });
  return NextResponse.json({ room });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user.role, "admin:users")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  await prisma.room.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
