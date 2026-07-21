import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import {
  listFolder,
  batchGetItemPermissions,
  getPathPermissions,
  userHasPermission,
  userCanWrite,
} from "@/lib/drive-graph";

export async function GET(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path") ?? "/";
  const isRoot = path === "/" || path === "";

  // ADMIN: full access, no filtering
  if (user.role === "ADMIN") {
    try {
      const items = await listFolder(path);
      return NextResponse.json({ items, canWrite: true });
    } catch (err) {
      console.error("[drive/browse admin]", err);
      return NextResponse.json({ error: String(err) }, { status: 502 });
    }
  }

  const userEmail = user.email ?? "";

  if (isRoot) {
    try {
      // 1. List all root items
      const allItems = await listFolder("/");
      const folders = allItems.filter((i) => i.isFolder);

      // 2. Batch-fetch permissions for all folders in one Graph $batch call
      const permsMap = await batchGetItemPermissions(folders.map((f) => f.id));

      // 3. Filter to folders the user can access
      const accessible = folders.filter((f) =>
        userHasPermission(permsMap.get(f.id) ?? [], userEmail),
      );
      const canWrite = accessible.some((f) =>
        userCanWrite(permsMap.get(f.id) ?? [], userEmail),
      );

      return NextResponse.json({ items: accessible, canWrite });
    } catch (err) {
      console.error("[drive/browse root]", err);
      return NextResponse.json({ error: String(err) }, { status: 502 });
    }
  }

  // Sub-path: check permissions on this specific folder (includes inherited)
  try {
    const perms = await getPathPermissions(path);
    if (!userHasPermission(perms, userEmail)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    const write = userCanWrite(perms, userEmail);
    const items = await listFolder(path);
    return NextResponse.json({ items, canWrite: write });
  } catch (err) {
    console.error("[drive/browse path]", err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
