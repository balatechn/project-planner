import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";

// GET /api/sheets — load or auto-create the user's spreadsheet
export async function GET() {
  return handle(async () => {
    const user = await getAuthedUser();

    let sheet = await prisma.spreadsheet.findUnique({
      where: { ownerId: user.id },
      include: { tabs: { orderBy: { orderIndex: "asc" } } },
    });

    if (!sheet) {
      sheet = await prisma.spreadsheet.create({
        data: {
          ownerId: user.id,
          tabs: { create: { name: "Sheet1", orderIndex: 0 } },
        },
        include: { tabs: { orderBy: { orderIndex: "asc" } } },
      });
    }

    return json(sheet);
  });
}

// POST /api/sheets — add a new tab
export async function POST(req: Request) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { name, orderIndex } = await req.json();

    const sheet = await prisma.spreadsheet.findUnique({
      where: { ownerId: user.id },
    });
    if (!sheet) throw new Error("Spreadsheet not found");

    const tab = await prisma.spreadsheetTab.create({
      data: {
        spreadsheetId: sheet.id,
        name: name ?? "Sheet",
        orderIndex: orderIndex ?? 0,
      },
    });

    return json(tab);
  });
}
