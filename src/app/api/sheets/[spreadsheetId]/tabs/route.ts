import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";

// POST /api/sheets/[spreadsheetId]/tabs — add a tab to a workbook
export async function POST(
  req: Request,
  { params }: { params: Promise<{ spreadsheetId: string }> },
) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { spreadsheetId } = await params;

    const sheet = await prisma.spreadsheet.findFirst({
      where: { id: spreadsheetId, ownerId: user.id },
    });
    if (!sheet) throw Object.assign(new Error("Not found"), { status: 404 });

    const { name, orderIndex } = await req.json();
    const tab = await prisma.spreadsheetTab.create({
      data: {
        spreadsheetId,
        name: name ?? "Sheet",
        orderIndex: orderIndex ?? 0,
      },
    });

    return json(tab);
  });
}
