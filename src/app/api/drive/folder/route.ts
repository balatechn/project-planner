import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createFolder } from "@/lib/drive-graph";

export async function POST(req: Request) {
  const user = await requireUser();
  const { path, name } = await req.json() as { path: string; name: string };

  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  if (user.role !== "ADMIN") {
    const grant = await prisma.driveAccess.findFirst({
      where: {
        canWrite: true,
        OR: [{ userId: user.id }, { role: user.role }],
      },
    });
    if (!grant) return NextResponse.json({ error: "Write access denied" }, { status: 403 });
  }

  try {
    const item = await createFolder(path ?? "/", name.trim());
    return NextResponse.json({ item });
  } catch (err) {
    console.error("[drive/folder]", err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
