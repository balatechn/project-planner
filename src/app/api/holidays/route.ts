import { z } from "zod";
import { getAuthedUser, handle, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

const createSchema = z.object({
  date: z.coerce.date(),
  name: z.string().trim().min(1).max(120),
});

// GET /api/holidays — visible to every signed-in user (calendar, booking warnings).
export async function GET() {
  return handle(async () => {
    await getAuthedUser();
    const holidays = await prisma.holiday.findMany({
      orderBy: { date: "asc" },
    });
    return json({ holidays });
  });
}

// POST /api/holidays — admin only.
export async function POST(req: Request) {
  return handle(async () => {
    const user = await getAuthedUser();
    requirePermission(user.role, "admin:users");
    const { date, name } = createSchema.parse(await req.json());

    // Normalise to midnight UTC so each calendar day is unique
    const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const holiday = await prisma.holiday.create({ data: { date: day, name } });
    return json({ holiday }, { status: 201 });
  });
}
