import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { SheetsIndexClient } from "./sheets-index-client";

export const metadata: Metadata = { title: "Sheets" };

export default async function SheetsPage() {
  const user = await requireUser();

  const workbooks = await prisma.spreadsheet.findMany({
    where: { ownerId: user.id },
    include: { _count: { select: { tabs: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <SheetsIndexClient
      initialWorkbooks={workbooks.map((w) => ({
        id: w.id,
        name: w.name,
        updatedAt: w.updatedAt.toISOString(),
        _count: w._count,
      }))}
    />
  );
}
