import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { searchDrive } from "@/lib/drive-graph";

export async function GET(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ items: [] });

  try {
    let items = await searchDrive(q.trim());

    // Non-admins: filter results to only paths they have access to
    if (user.role !== "ADMIN") {
      const grants = await prisma.driveAccess.findMany({
        where: { OR: [{ userId: user.id }, { role: user.role }] },
        select: { folderPath: true },
      });
      const grantedPaths = grants.map((g) => g.folderPath);
      items = items.filter((item) => {
        const itemPath = item.parentPath ?? "/";
        return grantedPaths.some(
          (gp) => gp === "/" || itemPath === gp || itemPath.startsWith(gp + "/"),
        );
      });
    }

    return NextResponse.json({ items });
  } catch (err) {
    console.error("[drive/search]", err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
