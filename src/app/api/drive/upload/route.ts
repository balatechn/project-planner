import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/drive-graph";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB (Graph simple upload limit)

export async function POST(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path") ?? "/";

  // Check write access
  if (user.role !== "ADMIN") {
    const grant = await prisma.driveAccess.findFirst({
      where: {
        canWrite: true,
        OR: [{ userId: user.id }, { role: user.role }],
        AND: [
          {
            OR: [
              { folderPath: "/" },
              { folderPath: path },
              { folderPath: { startsWith: path.split("/").slice(0, -1).join("/") || "/" } },
            ],
          },
        ],
      },
    });
    if (!grant) return NextResponse.json({ error: "Write access denied" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > MAX_BYTES) {
      return NextResponse.json({ error: "File exceeds 4 MB limit" }, { status: 413 });
    }

    const item = await uploadFile(path, file.name, bytes, file.type);
    return NextResponse.json({ item });
  } catch (err) {
    console.error("[drive/upload]", err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
