import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import {
  listFolder,
  listFolderWithPerms,
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
    // Fetch root children with permissions and filter to what the user can access
    try {
      const itemsWithPerms = await listFolderWithPerms("/");
      const accessible = itemsWithPerms.filter(
        (item) => item.isFolder && userHasPermission(item.permissions, userEmail),
      );
      const canWrite = accessible.some((item) => userCanWrite(item.permissions, userEmail));
      // Strip permissions from response
      const items = accessible.map(({ permissions: _p, ...item }) => item);
      return NextResponse.json({ items, canWrite });
    } catch (err) {
      console.error("[drive/browse root]", err);
      return NextResponse.json({ error: String(err) }, { status: 502 });
    }
  }

  // Sub-path: verify user has permission on this folder (includes inherited)
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
