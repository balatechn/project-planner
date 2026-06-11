/**
 * Builds an RFC 5545-compliant iCalendar (ICS) string for a meeting invite.
 * The produced content can be base64-encoded and attached to an email as
 * "invite.ics" (content-type: text/calendar; method=REQUEST).
 */

export interface ICSEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  organiserEmail: string;
  organiserName?: string;
  attendeeEmails: string[];
  teamsJoinUrl?: string;
  status?: "CONFIRMED" | "TENTATIVE" | "CANCELLED";
}

/** Format a Date as an ICS UTC timestamp: 20240611T143000Z */
function icsDate(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** Fold long lines to 75-octets as required by RFC 5545 */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  chunks.push(line.slice(0, 75));
  let pos = 75;
  while (pos < line.length) {
    chunks.push(" " + line.slice(pos, pos + 74));
    pos += 74;
  }
  return chunks.join("\r\n");
}

/** Escape special characters in ICS text values */
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildICS(event: ICSEvent): string {
  const {
    uid,
    summary,
    description,
    location,
    startTime,
    endTime,
    organiserEmail,
    organiserName,
    attendeeEmails,
    teamsJoinUrl,
    status = "CONFIRMED",
  } = event;

  const fullDescription = [description, teamsJoinUrl ? `Join Teams Meeting: ${teamsJoinUrl}` : ""]
    .filter(Boolean)
    .join("\\n\\n");

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//National Group India//Sharepoint//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    fold(`UID:${uid}`),
    fold(`DTSTAMP:${icsDate(new Date())}`),
    fold(`DTSTART:${icsDate(startTime)}`),
    fold(`DTEND:${icsDate(endTime)}`),
    fold(`SUMMARY:${esc(summary)}`),
    fold(`STATUS:${status}`),
    fold(
      `ORGANIZER;CN=${esc(organiserName ?? organiserEmail)}:mailto:${organiserEmail}`,
    ),
    ...attendeeEmails.map((email) =>
      fold(
        `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${email}`,
      ),
    ),
  ];

  if (fullDescription) {
    lines.push(fold(`DESCRIPTION:${esc(fullDescription)}`));
  }
  if (location) {
    lines.push(fold(`LOCATION:${esc(location)}`));
  }
  if (teamsJoinUrl) {
    lines.push(fold(`URL:${teamsJoinUrl}`));
  }

  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

/** Convert an ICS string to a base64-encoded string suitable for Graph attachment */
export function icsToBase64(ics: string): string {
  return Buffer.from(ics, "utf-8").toString("base64");
}
