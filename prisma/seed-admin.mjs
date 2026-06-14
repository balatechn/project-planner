// Seeds a temporary admin user for dev-login bypass (runs at container startup).
// Remove once Microsoft SSO is confirmed working.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ADMIN_EMAIL = "admin@sharepoint.local";
// Password: Admin@2025  (scrypt hash)
const PASSWORD_HASH =
  "scrypt$20d088588036c0b0dbcbc2dfedba44b4$f541cb96ca0618abeeced7a5765eb1874e5108add224b09d9ac3c1d9b521c7f4c98d3ab02bff6c595e46694132901d33a6dbf24cefa04291defe198752c573ba";

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!existing) {
    await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        name: "Admin",
        role: "ADMIN",
        isActive: true,
        passwordHash: PASSWORD_HASH,
      },
    });
    console.log("  admin user created:", ADMIN_EMAIL);
  } else if (!existing.passwordHash) {
    await prisma.user.update({
      where: { email: ADMIN_EMAIL },
      data: { passwordHash: PASSWORD_HASH, role: "ADMIN", isActive: true },
    });
    console.log("  admin user updated:", ADMIN_EMAIL);
  } else {
    console.log("  admin user already exists");
  }
}

main()
  .catch((e) => {
    console.error("admin seed failed (non-fatal):", e.message);
    process.exit(0);
  })
  .finally(() => prisma.$disconnect());
