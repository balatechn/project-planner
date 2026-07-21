import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { uploadFile, getPathPermissions, userHasPermission, userCanWrite } from "@/lib/drive-graph";

const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path") ?? "/";

  if (user.role !== "ADMIN") {
    const perms = await getPathPermissions(path);
    if (!userHasPermission(perms, user.email ?? "")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    if (!userCanWrite(perms, user.email ?? "")) {
      return NextResponse.json({ error: "Write access denied" }, { status: 403 });
    }
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
