import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { listFolder } from "@/lib/drive-graph";
import type { DriveItem } from "@/lib/drive-graph";

function hasAccess(
  userId: string,
  role: string,
  path: string,
  grants: { folderPath: string; userId: string | null; role: string | null; canWrite: boolean }[],
): { read: boolean; write: boolean } {
  if (role === "ADMIN") return { read: true, write: true };

  const norm = path === "/" ? "/" : path.replace(/\/+$/, "");

  for (const g of grants) {
    const userMatch = g.userId === userId || g.role === role;
    if (!userMatch) continue;
    // Root grant or path is same as or under granted folder
    const pathMatch =
      g.folderPath === "/" ||
      norm === g.folderPath ||
      norm.startsWith(g.folderPath + "/");
    if (pathMatch) return { read: true, write: g.canWrite };
  }
  return { read: false, write: false };
}

export async function GET(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path") ?? "/";

  const grants = await prisma.driveAccess.findMany({
    where: { OR: [{ userId: user.id }, { role: user.role }, { userId: null, role: null }] },
    select: { folderPath: true, userId: true, role: true, canWrite: true },
  });

  const access = hasAccess(user.id, user.role, path, grants);
  if (!access.read) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    let items: DriveItem[] = await listFolder(path);

    // At root, filter to only folders the user has any access grant for
    if ((path === "/" || path === "") && user.role !== "ADMIN") {
      const grantedPaths = new Set(
        grants
          .filter((g) => g.userId === user.id || g.role === user.role)
          .map((g) => g.folderPath.replace(/^\//, "").split("/")[0]),
      );
      // Also show files at root if they have "/" grant
      const hasRootGrant = grants.some(
        (g) =>
          (g.userId === user.id || g.role === user.role) && g.folderPath === "/",
      );
      items = items.filter(
        (item) => !item.isFolder || grantedPaths.has(item.name) || hasRootGrant,
      );
    }

    return NextResponse.json({ items, canWrite: access.write });
  } catch (err) {
    console.error("[drive/browse]", err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
