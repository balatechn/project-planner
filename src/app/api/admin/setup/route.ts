import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/setup
 *
 * One-time bootstrap endpoint.  Promotes the calling user to ADMIN
 * *only* when zero ADMIN accounts exist in the database.
 *
 * Once any ADMIN exists this endpoint is permanently locked — it returns
 * 403 so it cannot be used to escalate privileges after initial setup.
 */
export async function POST() {
  return handle(async () => {
    const user = await getAuthedUser();

    // Safety check — refuse if an admin already exists
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount > 0) {
      return json(
        { error: "An admin account already exists. Setup is locked." },
        { status: 403 },
      );
    }

    // Promote
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN" },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "admin.setup",
        entityType: "user",
        entityId: user.id,
        metadata: { note: "First-run admin bootstrap" },
      },
    });

    return json({ ok: true, message: "You are now an admin. Please sign out and sign back in." });
  });
}

/**
 * GET /api/admin/setup
 *
 * Returns whether first-run setup is still available (no admin yet).
 * Used by the Projects page to decide whether to show the claim banner.
 */
export async function GET() {
  return handle(async () => {
    await getAuthedUser(); // must be signed in
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    return json({ setupAvailable: adminCount === 0 });
  });
}
