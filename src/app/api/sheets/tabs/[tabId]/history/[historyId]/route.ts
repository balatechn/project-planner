import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";

async function ownedEntry(historyId: string, userId: string) {
  const entry = await prisma.spreadsheetHistory.findFirst({
    where: { id: historyId, tab: { spreadsheet: { ownerId: userId } } },
  });
  if (!entry) throw Object.assign(new Error("Not found"), { status: 404 });
  return entry;
}

// GET /api/sheets/tabs/[tabId]/history/[historyId] — fetch a snapshot's cells
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tabId: string; historyId: string }> },
) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { historyId } = await params;
    const entry = await ownedEntry(historyId, user.id);
    return json({ id: entry.id, cells: entry.cells, colWidths: entry.colWidths, createdAt: entry.createdAt, label: entry.label });
  });
}

// DELETE /api/sheets/tabs/[tabId]/history/[historyId] — remove a single snapshot
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ tabId: string; historyId: string }> },
) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { historyId } = await params;
    await ownedEntry(historyId, user.id);
    await prisma.spreadsheetHistory.delete({ where: { id: historyId } });
    return json({ ok: true });
  });
}
