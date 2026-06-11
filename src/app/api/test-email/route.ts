// Diagnostic endpoint — admin only.
// GET /api/test-email   → sends a test email to the calling user and returns diagnostic JSON.
import { ApiError, getAuthedUser, handle, json } from "@/lib/api";
import { sendEmail, renderEmail } from "@/lib/email";
import { isGraphConfigured } from "@/lib/graph";

export async function GET() {
  return handle(async () => {
    const user = await getAuthedUser();
    if (user.role !== "ADMIN") throw new ApiError(403, "Admin only");

    const diagnostics = {
      EMAIL_DRIVER: process.env.EMAIL_DRIVER ?? "(not set)",
      GRAPH_SENDER_UPN: process.env.GRAPH_SENDER_UPN ?? "(not set)",
      GRAPH_TENANT_ID: process.env.GRAPH_TENANT_ID ? "set" : "(not set — falling back to AUTH_MICROSOFT_ENTRA_ID_TENANT_ID)",
      AUTH_MICROSOFT_ENTRA_ID_TENANT_ID: process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID ? "set" : "(not set)",
      isGraphConfigured: isGraphConfigured(),
      graphEmailEnabled: process.env.EMAIL_DRIVER === "graph" && isGraphConfigured(),
      callerEmail: user.email ?? "(null — no email on your user record!)",
      callerRole: user.role,
    };

    console.log("[test-email] diagnostics:", JSON.stringify(diagnostics));

    let sendResult = false;
    let sendError: string | null = null;

    if (user.email) {
      try {
        sendResult = await sendEmail({
          to: user.email,
          subject: "✅ Sharepoint — Test Email",
          html: renderEmail({
            heading: "Test Email",
            body: `<p>This is a test email sent from the Sharepoint diagnostic endpoint.</p>
                   <p>Sender: <strong>${process.env.GRAPH_SENDER_UPN ?? "unknown"}</strong></p>
                   <p>Recipient: <strong>${user.email}</strong></p>
                   <p>Driver: <strong>${process.env.EMAIL_DRIVER ?? "console"}</strong></p>`,
          }),
        });
      } catch (e) {
        sendError = e instanceof Error ? e.message : String(e);
        console.error("[test-email] sendEmail threw:", sendError);
      }
    }

    return json({
      diagnostics,
      sendResult,
      sendError,
      message: sendResult
        ? `Email dispatched to ${user.email} — check inbox (and Junk/Spam folder)`
        : `Email NOT sent — see diagnostics above`,
    });
  });
}
