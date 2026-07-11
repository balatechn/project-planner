import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";

async function ownedSheet(spreadsheetId: string, userId: string) {
  const sheet = await prisma.spreadsheet.findFirst({
    where: { id: spreadsheetId, ownerId: userId },
  });
  if (!sheet) throw Object.assign(new Error("Not found"), { status: 404 });
  return sheet;
}

// GET /api/sheets/[spreadsheetId]/shares — list shares (owner only)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ spreadsheetId: string }> },
) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { spreadsheetId } = await params;
    await ownedSheet(spreadsheetId, user.id);

    const shares = await prisma.spreadsheetShare.findMany({
      where: { spreadsheetId },
      select: {
        id: true, permission: true, createdAt: true,
        sharedWith: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return json(shares);
  });
}

// POST /api/sheets/[spreadsheetId]/shares — share with a user
export async function POST(
  req: Request,
  { params }: { params: Promise<{ spreadsheetId: string }> },
) {
  return handle(async () => {
    const user = await getAuthedUser();
    const { spreadsheetId } = await params;
    await ownedSheet(spreadsheetId, user.id);

    const { email, permission } = await req.json();
    if (!email) throw Object.assign(new Error("email required"), { status: 400 });

    const target = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, name: true, email: true, image: true },
    });
    if (!target) throw Object.assign(new Error("User not found"), { status: 404 });
    if (target.id === user.id) throw Object.assign(new Error("Cannot share with yourself"), { status: 400 });

    const perm = permission === "EDIT" ? "EDIT" : "VIEW";

    const share = await prisma.spreadsheetShare.upsert({
      where: { spreadsheetId_sharedWithId: { spreadsheetId, sharedWithId: target.id } },
      update: { permission: perm },
      create: { spreadsheetId, sharedWithId: target.id, sharedById: user.id, permission: perm },
      select: {
        id: true, permission: true, createdAt: true,
        sharedWith: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    // Touch updatedAt on the spreadsheet so shared list re-orders
    await prisma.spreadsheet.update({ where: { id: spreadsheetId }, data: { updatedAt: new Date() } });

    return json(share);
  });
}
