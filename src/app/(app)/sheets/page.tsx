import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { SheetsIndexClient } from "./sheets-index-client";

export const metadata: Metadata = { title: "Sheets" };

export default async function SheetsPage() {
  const user = await requireUser();

  const [ownedRaw, sharesRaw] = await Promise.all([
    prisma.spreadsheet.findMany({
      where: { ownerId: user.id },
      include: { _count: { select: { tabs: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    (prisma as any).spreadsheetShare.findMany({
      where: { sharedWithId: user.id },
      include: {
        spreadsheet: { include: { _count: { select: { tabs: true } } } },
        sharedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <SheetsIndexClient
      initialOwned={ownedRaw.map((w) => ({
        id: w.id,
        name: w.name,
        updatedAt: w.updatedAt.toISOString(),
        _count: w._count,
      }))}
      initialShared={sharesRaw.map((s: any) => ({
        shareId: s.id,
        permission: s.permission as "VIEW" | "EDIT",
        sharedBy: s.sharedBy,
        workbook: {
          id: s.spreadsheet.id,
          name: s.spreadsheet.name,
          updatedAt: s.spreadsheet.updatedAt.toISOString(),
          _count: s.spreadsheet._count,
        },
      }))}
    />
  );
}
