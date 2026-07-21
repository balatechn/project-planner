import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { searchDrive, listFolderWithPerms, userHasPermission } from "@/lib/drive-graph";

export async function GET(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ items: [] });

  try {
    let items = await searchDrive(q.trim());

    if (user.role !== "ADMIN") {
      const userEmail = user.email ?? "";
      // Get accessible root folders once, then filter search results
      const rootItems = await listFolderWithPerms("/");
      const accessibleRoots = new Set(
        rootItems
          .filter((item) => item.isFolder && userHasPermission(item.permissions, userEmail))
          .map((item) => item.name),
      );
      items = items.filter((item) => {
        const parentPath = item.parentPath ?? "/";
        const topFolder = parentPath.replace(/^\//, "").split("/")[0];
        return !topFolder || accessibleRoots.has(topFolder);
      });
    }

    return NextResponse.json({ items });
  } catch (err) {
    console.error("[drive/search]", err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
