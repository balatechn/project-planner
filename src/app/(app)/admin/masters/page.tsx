import type { Metadata } from "next";
import { requireUserWithPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getAllMasterOptions } from "@/lib/masters";
import { PageHeader } from "@/components/page-header";
import { MastersClient } from "./masters-client";

export const metadata: Metadata = { title: "Masters" };

export default async function MastersPage() {
  await requireUserWithPermission("admin:users");

  const [options, rooms, holidays] = await Promise.all([
    getAllMasterOptions(),
    prisma.room.findMany({
      orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
    }),
    prisma.holiday.findMany({ orderBy: { date: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Masters"
        description="Manage the dropdown values used across the workspace — entities, locations, departments, designations, program types, meeting rooms and holidays."
      />
      <MastersClient
        options={options.map((o) => ({
          id: o.id,
          type: o.type,
          name: o.name,
          isActive: o.isActive,
        }))}
        rooms={rooms.map((r) => ({
          id: r.id,
          name: r.name,
          floor: r.floor,
          building: r.building,
          capacity: r.capacity,
          contactEmail: r.contactEmail,
          color: r.color,
          isActive: r.isActive,
        }))}
        holidays={holidays.map((h) => ({
          id: h.id,
          date: h.date.toISOString(),
          name: h.name,
        }))}
      />
    </div>
  );
}
