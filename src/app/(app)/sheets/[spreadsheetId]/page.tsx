import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { SpreadsheetClient, type InitialTab } from "../spreadsheet-client";

export const metadata: Metadata = { title: "Sheets" };

export default async function WorkbookPage({
  params,
}: {
  params: Promise<{ spreadsheetId: string }>;
}) {
  const user = await requireUser();
  const { spreadsheetId } = await params;

  const sheet = await prisma.spreadsheet.findFirst({
    where: { id: spreadsheetId, ownerId: user.id },
    include: { tabs: { orderBy: { orderIndex: "asc" } } },
  });

  if (!sheet) notFound();

  const initialTabs: InitialTab[] = sheet.tabs.map((t) => ({
    id: t.id,
    name: t.name,
    order: t.orderIndex,
    cells: (t.cells as Record<string, unknown>) ?? {},
    cw: (t.colWidths as Record<string, number>) ?? {},
  }));

  return (
    <SpreadsheetClient
      spreadsheetId={sheet.id}
      spreadsheetName={sheet.name}
      initialTabs={initialTabs}
    />
  );
}
