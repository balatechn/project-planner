import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";

// DELETE /api/sheets/[spreadsheetId]/shares/[shareId] — remove a share
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ spreadsheetId: string; shareId: string }> },
) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { spreadsheetId, shareId } = await params;

    // Must be the owner to remove a share
    const sheet = await prisma.spreadsheet.findFirst({
      where: { id: spreadsheetId, ownerId: user.id },
    });
    if (!sheet) throw Object.assign(new Error("Not found"), { status: 404 });

    await prisma.spreadsheetShare.delete({ where: { id: shareId } });
    return json({ ok: true });
  });
}
