/**
 * Cron job: send 15-minute room booking reminders via email.
 * Triggered by Vercel Cron every 5 minutes.
 * Only runs if CRON_SECRET matches the Authorization header.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendBookingEmail } from "@/lib/teams-graph";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() + 14 * 60 * 1000); // 14 min from now
  const windowEnd = new Date(now.getTime() + 16 * 60 * 1000);   // 16 min from now

  // Find confirmed bookings starting in ~15 min that haven't had a reminder
  const upcoming = await prisma.roomBooking.findMany({
    where: {
      status: "CONFIRMED",
      reminderSent: false,
      startTime: { gte: windowStart, lte: windowEnd },
    },
    include: {
      room: { select: { name: true, floor: true } },
      organizer: { select: { id: true, name: true, email: true } },
    },
  });

  let sent = 0;
  for (const booking of upcoming) {
    if (!booking.organizer.email) continue;

    const startStr = booking.startTime.toLocaleString("en-IN", {
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    });
    const roomInfo = booking.room.floor
      ? `${booking.room.name} (Floor ${booking.room.floor})`
      : booking.room.name;

    const html = `
<div style="font-family:sans-serif;max-width:480px;padding:20px">
  <h2 style="color:#f59e0b">⏰ Meeting in 15 minutes</h2>
  <p><strong>${booking.title}</strong></p>
  <p>Room: ${roomInfo}</p>
  <p>Starts at: ${startStr}</p>
  ${booking.teamsJoinUrl ? `<p><a href="${booking.teamsJoinUrl}" style="background:#5558af;color:#fff;padding:8px 16px;border-radius:4px;text-decoration:none;">Join Teams Meeting</a></p>` : ""}
  <p style="color:#94a3b8;font-size:12px">Reminder from National Group India · Project Planner</p>
</div>`;

    const ok = await sendBookingEmail(
      booking.organizer.id,
      booking.organizer.email,
      `Reminder: ${booking.title} in 15 min`,
      html,
    );

    if (ok) {
      await prisma.roomBooking.update({
        where: { id: booking.id },
        data: { reminderSent: true },
      });
      sent++;
    }
  }

  return NextResponse.json({ processed: upcoming.length, sent });
}
