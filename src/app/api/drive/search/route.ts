import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { searchDrive, listFolder, batchGetItemPermissions, userHasPermission } from "@/lib/drive-graph";

export async function GET(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ items: [] });

  try {
    let items = await searchDrive(q.trim());

    if (user.role !== "ADMIN") {
      const userEmail = user.email ?? "";
      // Get accessible root folders via batch permissions check
      const rootItems = await listFolder("/");
      const rootFolders = rootItems.filter((i) => i.isFolder);
      const permsMap = await batchGetItemPermissions(rootFolders.map((f) => f.id));
      const accessibleRoots = new Set(
        rootFolders
          .filter((f) => userHasPermission(permsMap.get(f.id) ?? [], userEmail))
          .map((f) => f.name),
      );
      items = items.filter((item) => {
        const topFolder = (item.parentPath ?? "/").replace(/^\//, "").split("/")[0];
        return !topFolder || accessibleRoots.has(topFolder);
      });
    }

    return NextResponse.json({ items });
  } catch (err) {
    console.error("[drive/search]", err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
