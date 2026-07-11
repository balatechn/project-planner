import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";

// Verify the tab belongs to the requesting user
async function ownedTab(tabId: string, userId: string) {
  const tab = await prisma.spreadsheetTab.findFirst({
    where: { id: tabId, spreadsheet: { ownerId: userId } },
  });
  if (!tab) throw Object.assign(new Error("Not found"), { status: 404 });
  return tab;
}

// PATCH /api/sheets/tabs/[tabId] — save cells, colWidths, or rename
export async function PATCH(req: Request, { params }: { params: Promise<{ tabId: string }> }) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { tabId } = await params;
    await ownedTab(tabId, user.id);

    const body = await req.json();
    const updated = await prisma.spreadsheetTab.update({
      where: { id: tabId },
      data: {
        ...(body.cells !== undefined     && { cells: body.cells }),
        ...(body.colWidths !== undefined && { colWidths: body.colWidths }),
        ...(body.name !== undefined      && { name: body.name }),
      },
    });
    return json(updated);
  });
}

// DELETE /api/sheets/tabs/[tabId] — remove a tab (must not be the last one)
export async function DELETE(_req: Request, { params }: { params: Promise<{ tabId: string }> }) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { tabId } = await params;
    const tab = await ownedTab(tabId, user.id);

    const count = await prisma.spreadsheetTab.count({
      where: { spreadsheetId: tab.spreadsheetId },
    });
    if (count <= 1) throw Object.assign(new Error("Cannot delete last sheet"), { status: 400 });

    await prisma.spreadsheetTab.delete({ where: { id: tabId } });
    return json({ ok: true });
  });
}
