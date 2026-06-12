// Idempotent room seeder for container startup (plain ESM, no tsx needed).
// Uses the generated Prisma client. Safe to run on every boot.
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
  for (const room of ROOMS) {
    const existing = await prisma.room.findFirst({ where: { name: room.name } });
    if (!existing) {
      await prisma.room.create({ data: room });
      console.log(`  created room: ${room.name}`);
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
    }
  }
  console.log("rooms ready");
}

main()
  .catch((e) => {
    console.error("room seed failed (non-fatal):", e.message);
    process.exit(0); // non-fatal — don't block startup
  })
  .finally(() => prisma.$disconnect());
