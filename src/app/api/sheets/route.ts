import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";

// GET /api/sheets — list all workbooks for the current user
export async function GET() {
  return handle(async () => {
    const user = await getAuthedUser();
    const sheets = await prisma.spreadsheet.findMany({
      where: { ownerId: user.id },
      include: { _count: { select: { tabs: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return json(sheets);
  });
}

// POST /api/sheets — create a new workbook
export async function POST(req: Request) {
  return handle(async () => {
    const user = await getAuthedUser();
    const body = await req.json().catch(() => ({}));
    const name = (body.name as string | undefined)?.trim() || "Untitled Spreadsheet";

    const sheet = await prisma.spreadsheet.create({
      data: {
        ownerId: user.id,
        name,
        tabs: { create: { name: "Sheet1", orderIndex: 0 } },
      },
      include: {
        tabs: { orderBy: { orderIndex: "asc" } },
        _count: { select: { tabs: true } },
      },
    });

    return json(sheet);
  });
}
