import { graphFetch, isGraphConfigured } from "@/lib/graph";

// Email notifications. When Graph is configured and EMAIL_DRIVER=graph,
// sends via Microsoft Graph (sendMail). Otherwise logs to the console
// so local development works without a tenant.

export type EmailAttachment = {
  /** Filename shown in the email (e.g. "invite.ics") */
  name: string;
  /** Base64-encoded file content */
  contentBytes: string;
  /** MIME type (e.g. "text/calendar") */
  contentType: string;
};

export type EmailMessage = {
  to: string | string[];
  subject: string;
  html: string;
  /** Optional reply-to address */
  replyTo?: string;
  /** Optional file attachments */
  attachments?: EmailAttachment[];
};

function graphEmailEnabled(): boolean {
  return process.env.EMAIL_DRIVER === "graph" && isGraphConfigured();
}

export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const recipients = (Array.isArray(message.to) ? message.to : [message.to])
    .filter(Boolean)
    .map((address) => ({ emailAddress: { address } }));

  if (recipients.length === 0) return false;

  if (!graphEmailEnabled()) {
    console.info(
      `[email:console] To: ${recipients.map((r) => r.emailAddress.address).join(", ")} | ${message.subject}${message.attachments?.length ? ` | attachments: ${message.attachments.map((a) => a.name).join(", ")}` : ""}`,
    );
    return true;
  }

  const sender = process.env.GRAPH_SENDER_UPN;
  if (!sender) {
    console.warn("GRAPH_SENDER_UPN not set; cannot send email via Graph.");
    return false;
  }

  try {
    const graphMessage: Record<string, unknown> = {
      subject: message.subject,
      body: { contentType: "HTML", content: message.html },
      toRecipients: recipients,
    };

    if (message.replyTo) {
      graphMessage.replyTo = [{ emailAddress: { address: message.replyTo } }];
    }

    if (message.attachments && message.attachments.length > 0) {
      graphMessage.attachments = message.attachments.map((a) => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: a.name,
        contentType: a.contentType,
        contentBytes: a.contentBytes,
      }));
    }

    const res = await graphFetch(`/users/${encodeURIComponent(sender)}/sendMail`, {
      method: "POST",
      body: JSON.stringify({
        message: graphMessage,
        saveToSentItems: true,
      }),
    });
    if (!res.ok) {
      console.error("Graph sendMail failed", await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("sendEmail error", err);
    return false;
  }
}

/** Simple branded HTML wrapper for notification emails. */
export function renderEmail(opts: {
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const cta =
    opts.ctaLabel && opts.ctaUrl
      ? `<a href="${opts.ctaUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px">${opts.ctaLabel}</a>`
      : "";
  return `
  <div style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
    <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#2563eb;font-weight:700">Sharepoint</div>
    <h2 style="font-size:20px;margin:8px 0 12px">${opts.heading}</h2>
    <div style="font-size:14px;line-height:1.6;color:#334155">${opts.body}</div>
    ${cta}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
    <div style="font-size:12px;color:#94a3b8">You received this because you are a member of this workspace.</div>
  </div>`;
}
