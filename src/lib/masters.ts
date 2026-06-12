import type { MasterType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ENTITIES, DEPARTMENTS } from "@/lib/constants";

// One-time lazy seed: populate masters from the historical hardcoded
// lists the first time anyone reads them.
async function seedIfEmpty(): Promise<void> {
  const count = await prisma.masterOption.count();
  if (count > 0) return;

  await prisma.masterOption.createMany({
    data: [
      ...ENTITIES.map((name, i) => ({
        type: "ENTITY" as MasterType,
        name,
        orderIndex: i,
      })),
      ...DEPARTMENTS.map((name, i) => ({
        type: "DEPARTMENT" as MasterType,
        name,
        orderIndex: i,
      })),
    ],
    skipDuplicates: true,
  });
}

/** All master options (admin screens). Seeds defaults on first call. */
export async function getAllMasterOptions() {
  await seedIfEmpty();
  return prisma.masterOption.findMany({
    orderBy: [{ type: "asc" }, { orderIndex: "asc" }, { name: "asc" }],
  });
}

/** Active names for one master type — for dropdown consumers. */
export async function getActiveMasterNames(type: MasterType): Promise<string[]> {
  await seedIfEmpty();
  const options = await prisma.masterOption.findMany({
    where: { type, isActive: true },
    select: { name: true },
    orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
  });
  return options.map((o) => o.name);
}
