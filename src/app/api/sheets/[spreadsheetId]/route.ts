import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";

async function ownedSheet(spreadsheetId: string, userId: string) {
  const sheet = await prisma.spreadsheet.findFirst({
    where: { id: spreadsheetId, ownerId: userId },
  });
  if (!sheet) throw Object.assign(new Error("Not found"), { status: 404 });
  return sheet;
}

// PATCH /api/sheets/[spreadsheetId] — rename workbook
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ spreadsheetId: string }> },
) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { spreadsheetId } = await params;
    await ownedSheet(spreadsheetId, user.id);
    const { name } = await req.json();
    const updated = await prisma.spreadsheet.update({
      where: { id: spreadsheetId },
      data: { name: name?.trim() || undefined },
    });
    return json({ id: updated.id, name: updated.name });
  });
}

// DELETE /api/sheets/[spreadsheetId] — delete workbook
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ spreadsheetId: string }> },
) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { spreadsheetId } = await params;
    await ownedSheet(spreadsheetId, user.id);
    await prisma.spreadsheet.delete({ where: { id: spreadsheetId } });
    return json({ ok: true });
  });
}
