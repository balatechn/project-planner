import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { adminEmails } from "@/auth";

/**
 * POST /api/admin/setup
 *
 * Promotes the calling user to ADMIN when either:
 *   (a) Their email is listed in the ADMIN_EMAILS env var, OR
 *   (b) No ADMIN account exists yet (first-run bootstrap).
 *
 * After promotion the caller must sign out and back in so their JWT
 * picks up the new role — unless they call /api/auth/session?update.
 */
export async function POST() {
  return handle(async () => {
    const user = await getAuthedUser();
    const email = (user.email ?? "").toLowerCase();
    const isPinned = adminEmails.includes(email);

    if (!isPinned) {
      // Only allow if no admin exists yet
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
      if (adminCount > 0) {
        return json(
          { error: "An admin account already exists. Setup is locked." },
          { status: 403 },
        );
      }
    }

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
        metadata: {
          note: isPinned ? "Promoted via ADMIN_EMAILS" : "First-run admin bootstrap",
        },
      },
    });

    return json({ ok: true });
  });
}

/**
 * GET /api/admin/setup
 * Returns whether the calling user is eligible to claim admin right now.
 */
export async function GET() {
  return handle(async () => {
    const user = await getAuthedUser();
    const email = (user.email ?? "").toLowerCase();
    const isPinned = adminEmails.includes(email);
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    return json({
      setupAvailable: isPinned || adminCount === 0,
      isPinned,
    });
  });
}
