import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const SHEET_SELECT = {
  id: true, name: true, createdAt: true, updatedAt: true,
  _count: { select: { tabs: true } },
} as const;

// GET /api/sheets — list owned workbooks + workbooks shared with me
export async function GET() {
  return handle(async () => {
    const user = await getAuthedUser();

    const [owned, sharedRows] = await Promise.all([
      prisma.spreadsheet.findMany({
        where: { ownerId: user.id },
        select: {
          ...SHEET_SELECT,
          shares: {
            select: {
              id: true, permission: true,
              sharedWith: { select: { id: true, name: true, email: true, image: true } },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.spreadsheetShare.findMany({
        where: { sharedWithId: user.id },
        select: {
          id: true, permission: true,
          sharedBy: { select: { id: true, name: true, email: true, image: true } },
          spreadsheet: { select: { ...SHEET_SELECT } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return json({ owned, shared: sharedRows });
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
      select: { ...SHEET_SELECT, shares: true },
    });

    return json(sheet);
  });
}
