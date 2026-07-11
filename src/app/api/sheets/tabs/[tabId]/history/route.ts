import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";

async function ownedTab(tabId: string, userId: string) {
  const tab = await prisma.spreadsheetTab.findFirst({
    where: { id: tabId, spreadsheet: { ownerId: userId } },
  });
  if (!tab) throw Object.assign(new Error("Not found"), { status: 404 });
  return tab;
}

// GET /api/sheets/tabs/[tabId]/history — list last 50 snapshots
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tabId: string }> },
) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { tabId } = await params;
    await ownedTab(tabId, user.id);

    const entries = await prisma.spreadsheetHistory.findMany({
      where: { tabId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, label: true, createdAt: true },
    });
    return json(entries);
  });
}

// POST /api/sheets/tabs/[tabId]/history — save a snapshot
export async function POST(
  req: Request,
  { params }: { params: Promise<{ tabId: string }> },
) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { tabId } = await params;
    const tab = await ownedTab(tabId, user.id);
    const body = await req.json().catch(() => ({}));

    const entry = await prisma.spreadsheetHistory.create({
      data: {
        tabId,
        cells:     tab.cells     ?? {},
        colWidths: tab.colWidths ?? {},
        label:     body.label ?? null,
      },
    });

    // Keep only the latest 50 snapshots per tab
    const old = await prisma.spreadsheetHistory.findMany({
      where: { tabId },
      orderBy: { createdAt: "desc" },
      skip: 50,
      select: { id: true },
    });
    if (old.length) {
      await prisma.spreadsheetHistory.deleteMany({
        where: { id: { in: old.map((o) => o.id) } },
      });
    }

    return json({ id: entry.id, createdAt: entry.createdAt, label: entry.label });
  });
}
