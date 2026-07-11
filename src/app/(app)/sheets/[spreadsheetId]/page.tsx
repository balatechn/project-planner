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

  // Load the workbook — accessible if user is the owner OR has a share
  const sheet = await prisma.spreadsheet.findFirst({
    where: {
      id: spreadsheetId,
      OR: [
        { ownerId: user.id },
        { shares: { some: { sharedWithId: user.id } } },
      ],
    },
    include: {
      tabs: { orderBy: { orderIndex: "asc" } },
      shares: { where: { sharedWithId: user.id }, select: { permission: true } },
    },
  });

  if (!sheet) notFound();

  const isOwner = sheet.ownerId === user.id;
  const permission = isOwner
    ? "EDIT"
    : (sheet.shares[0]?.permission ?? "VIEW");

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
      permission={permission as "VIEW" | "EDIT"}
      isOwner={isOwner}
      initialTabs={initialTabs}
    />
  );
}
