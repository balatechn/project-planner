import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

// GET /api/drive/access — list all grants (admin only)
export async function GET() {
  const user = await requireUser();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const grants = await prisma.driveAccess.findMany({
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: [{ folderPath: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ grants });
}

// POST /api/drive/access — create grant (admin only)
export async function POST(req: Request) {
  const user = await requireUser();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as {
    folderPath: string;
    userId?: string;
    role?: Role;
    canWrite?: boolean;
  };

  if (!body.folderPath) return NextResponse.json({ error: "folderPath required" }, { status: 400 });
  if (!body.userId && !body.role) return NextResponse.json({ error: "userId or role required" }, { status: 400 });

  const grant = await prisma.driveAccess.create({
    data: {
      folderPath: body.folderPath,
      userId: body.userId ?? null,
      role: body.role ?? null,
      canWrite: body.canWrite ?? false,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json({ grant });
}
