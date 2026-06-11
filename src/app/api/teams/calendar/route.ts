import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { getCalendarView } from "@/lib/teams-graph";

// GET /api/teams/calendar?date=YYYY-MM-DD
// Returns the current user's Outlook calendar events for the given day
export async function GET(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  const startDateTime = `${date}T00:00:00Z`;
  const endDateTime = `${date}T23:59:59Z`;

  const events = await getCalendarView(user.id, startDateTime, endDateTime);
  return NextResponse.json({ events });
}
