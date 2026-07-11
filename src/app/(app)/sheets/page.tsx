import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { SpreadsheetClient, type InitialTab } from "./spreadsheet-client";

export const metadata: Metadata = { title: "Sheets" };

export default async function SheetsPage() {
  const user = await requireUser();

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

  const initialTabs: InitialTab[] = sheet.tabs.map((t) => ({
    id: t.id,
    name: t.name,
    order: t.orderIndex,
    cells: (t.cells as Record<string, unknown>) ?? {},
    cw: (t.colWidths as Record<string, number>) ?? {},
  }));

  return <SpreadsheetClient initialTabs={initialTabs} />;
}
