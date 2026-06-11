/**
 * Microsoft Graph API utilities for Teams / Outlook integration.
 * All calls use the user's delegated token stored in the Account table by Auth.js.
 */
import { prisma } from "./prisma";

const GRAPH = "https://graph.microsoft.com/v1.0";
const TENANT_ID = process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID ?? "common";
const CLIENT_ID = process.env.AUTH_MICROSOFT_ENTRA_ID_ID ?? "";
const CLIENT_SECRET = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET ?? "";

// ── Token management ─────────────────────────────────────────────────────────

async function refreshToken(rt: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
} | null> {
  if (!CLIENT_ID || !CLIENT_SECRET) return null;
  try {
    const res = await fetch(
      `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          refresh_token: rt,
          scope:
            "openid profile email User.Read OnlineMeetings.ReadWrite Calendars.Read Mail.Send offline_access",
        }),
      },
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "microsoft-entra-id" },
    select: {
      id: true,
      access_token: true,
      refresh_token: true,
      expires_at: true,
    },
  });
  if (!account?.access_token) return null;

  // Refresh if token expires within 60 seconds
  const now = Math.floor(Date.now() / 1000);
  if (account.expires_at && account.expires_at - now < 60 && account.refresh_token) {
    const refreshed = await refreshToken(account.refresh_token);
    if (refreshed) {
      await prisma.account.update({
        where: { id: account.id },
        data: {
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token ?? account.refresh_token,
          expires_at: now + refreshed.expires_in,
        },
      });
      return refreshed.access_token;
    }
    return null;
  }
  return account.access_token;
}

// ── Teams Online Meetings ─────────────────────────────────────────────────────

export async function createTeamsMeeting(
  userId: string,
  subject: string,
  startTime: string, // ISO 8601
  endTime: string,
): Promise<{ joinUrl: string; meetingId: string } | null> {
  const token = await getToken(userId);
  if (!token) return null;
  try {
    const res = await fetch(`${GRAPH}/me/onlineMeetings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject,
        startDateTime: startTime,
        endDateTime: endTime,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { joinUrl: data.joinWebUrl as string, meetingId: data.id as string };
  } catch {
    return null;
  }
}

export async function cancelTeamsMeeting(
  userId: string,
  meetingId: string,
): Promise<boolean> {
  const token = await getToken(userId);
  if (!token) return false;
  try {
    const res = await fetch(`${GRAPH}/me/onlineMeetings/${meetingId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

// ── Outlook Calendar View ─────────────────────────────────────────────────────

export type CalendarEvent = {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: { displayName: string };
  isOnlineMeeting?: boolean;
  onlineMeetingUrl?: string;
};

export async function getCalendarView(
  userId: string,
  startDateTime: string,
  endDateTime: string,
): Promise<CalendarEvent[]> {
  const token = await getToken(userId);
  if (!token) return [];
  try {
    const params = new URLSearchParams({
      startDateTime,
      endDateTime,
      $select: "id,subject,start,end,location,isOnlineMeeting,onlineMeetingUrl",
      $top: "100",
      $orderby: "start/dateTime",
    });
    const res = await fetch(`${GRAPH}/me/calendarView?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: 'outlook.timezone="UTC"',
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.value ?? []) as CalendarEvent[];
  } catch {
    return [];
  }
}

// ── Mail / Teams notification ─────────────────────────────────────────────────

export async function sendBookingEmail(
  userId: string,
  toEmail: string,
  subject: string,
  htmlBody: string,
): Promise<boolean> {
  const token = await getToken(userId);
  if (!token) return false;
  try {
    const res = await fetch(`${GRAPH}/me/sendMail`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "HTML", content: htmlBody },
          toRecipients: [{ emailAddress: { address: toEmail } }],
        },
        saveToSentItems: false,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Booking confirmation email template ──────────────────────────────────────

export function buildBookingEmailHtml(params: {
  title: string;
  roomName: string;
  startTime: string;
  endTime: string;
  teamsJoinUrl?: string | null;
  organizerName: string;
}): string {
  const start = new Date(params.startTime).toLocaleString("en-IN", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
  const end = new Date(params.endTime).toLocaleString("en-IN", {
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
  const teamsBtn = params.teamsJoinUrl
    ? `<p><a href="${params.teamsJoinUrl}" style="background:#5558af;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:600;">Join Teams Meeting</a></p>`
    : "";
  return `
<div style="font-family:sans-serif;max-width:500px;padding:20px">
  <h2 style="color:#1e293b">📅 Room Booking Confirmed</h2>
  <table style="border-collapse:collapse;width:100%">
    <tr><td style="padding:6px 0;color:#64748b;width:120px">Meeting</td><td style="font-weight:600">${params.title}</td></tr>
    <tr><td style="padding:6px 0;color:#64748b">Room</td><td>${params.roomName}</td></tr>
    <tr><td style="padding:6px 0;color:#64748b">Time</td><td>${start} – ${end}</td></tr>
    <tr><td style="padding:6px 0;color:#64748b">Organizer</td><td>${params.organizerName}</td></tr>
  </table>
  <br>${teamsBtn}
  <p style="color:#94a3b8;font-size:12px">Booked via National Group India · Project Planner</p>
</div>`;
}
