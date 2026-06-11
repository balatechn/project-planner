import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { MyTimesheetsClient } from "./timesheets-client";

export const metadata: Metadata = { title: "My Timesheets" };

export default async function MyTimesheetsPage() {
  const user = await requireUser();

  const logs = await prisma.timeLog.findMany({
    where: { userId: user.id },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          project: { select: { id: true, name: true, key: true, color: true } },
        },
      },
    },
    orderBy: { logDate: "desc" },
    take: 200,
  });

  const serialized = logs.map((l) => ({
    id: l.id,
    hours: l.hours,
    logDate: l.logDate.toISOString(),
    description: l.description,
    task: {
      id: l.task.id,
      title: l.task.title,
      project: l.task.project,
    },
  }));

  return <MyTimesheetsClient logs={serialized} />;
}
