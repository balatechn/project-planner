import { z } from "zod";
import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAudit } from "@/lib/activity";

const createSchema = z.object({
  type: z.enum(["ENTITY", "LOCATION", "DEPARTMENT", "DESIGNATION"]),
  name: z.string().trim().min(1).max(80),
});

// GET /api/admin/masters — all master options grouped by type (admin only).
export async function GET() {
  return handle(async () => {
    const user = await getAuthedUser();
    requirePermission(user.role, "admin:users");
    const options = await prisma.masterOption.findMany({
      orderBy: [{ type: "asc" }, { orderIndex: "asc" }, { name: "asc" }],
    });
    return json({ options });
  });
}

// POST /api/admin/masters — add a master value.
export async function POST(req: Request) {
  return handle(async () => {
    const user = await getAuthedUser();
    requirePermission(user.role, "admin:users");
    const data = createSchema.parse(await req.json());

    const option = await prisma.masterOption.create({ data });
    await writeAudit({
      userId: user.id,
      action: "master.created",
      entityType: "masterOption",
      entityId: option.id,
      metadata: { type: data.type, name: data.name },
    });
    return json({ option }, { status: 201 });
  });
}
