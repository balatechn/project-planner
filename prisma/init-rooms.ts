/**
 * Idempotent rooms initialiser — safe to run on every deploy.
 * Creates the two National Group India meeting rooms if they don't already exist.
 * Existing rooms are updated with the latest contactEmail / amenities.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ROOMS = [
  {
    name: "Small Meeting Room",
    capacity: 6,
    amenities: ["projector", "whiteboard", "videoConf"],
    color: "#3b82f6",
    contactEmail: "nationalmr@nationalgroupindia.com",
    description: "Ideal for team syncs and small client meetings — up to 6 people.",
    orderIndex: 0,
  },
  {
    name: "Big Meeting Room",
    capacity: 10,
    amenities: ["projector", "whiteboard", "videoConf", "phone", "ac"],
    color: "#8b5cf6",
    contactEmail: "nationalmr@nationalgroupindia.com",
    description: "Boardroom for large meetings, presentations and workshops — up to 10 people.",
    orderIndex: 1,
  },
];

async function main() {
  console.log("🏢 Initialising meeting rooms…");

  for (const room of ROOMS) {
    const existing = await prisma.room.findFirst({ where: { name: room.name } });
    if (!existing) {
      await prisma.room.create({ data: room });
      console.log(`  ✅ Created: ${room.name} (${room.capacity} pax)`);
    } else {
      await prisma.room.update({
        where: { id: existing.id },
        data: {
          capacity: room.capacity,
          amenities: room.amenities,
          contactEmail: room.contactEmail,
          description: room.description,
          color: room.color,
          orderIndex: room.orderIndex,
        },
      });
      console.log(`  ✓  Updated: ${room.name}`);
    }
  }

  console.log("✅ Rooms ready.");
}

main()
  .catch((e) => {
    console.error("Room init failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
