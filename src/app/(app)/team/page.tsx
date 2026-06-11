import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { TeamDirectoryClient } from "./team-client";

export const metadata: Metadata = { title: "Team Directory" };

export default async function TeamPage() {
  await requireUser();

  const members = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      jobTitle: true,
      department: true,
      weeklyCapacity: true,
      createdAt: true,
    },
    orderBy: [{ department: "asc" }, { name: "asc" }],
  });

  const departments = [
    ...new Set(
      members.map((m) => m.department).filter(Boolean) as string[],
    ),
  ].sort();

  return (
    <TeamDirectoryClient
      members={members.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
      }))}
      departments={departments}
    />
  );
}
