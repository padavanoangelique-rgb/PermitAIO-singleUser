/**
 * Best-effort notification email sent to the platform owner whenever a new
 * organization signs up. Uses a direct fetch to the Resend API (no `resend`
 * npm package) to avoid adding a dependency for a single call.
 *
 * This must never block or fail signup — every call site should treat this
 * as fire-and-forget and swallow errors.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** permitaio.com is verified in Resend; send from a domain address. */
const FROM_ADDRESS = "PermitAIO <notifications@permitaio.com>";

/** Human reply inbox on permitaio.com Google Workspace. Any reply to a
 * transactional email lands here so customer questions don't die at the
 * unmonitored notifications@ address. */
const REPLY_TO_ADDRESS = "hello@permitaio.com";

export async function notifySignup(params: {
  orgName: string;
  orgSlug: string;
  userEmail: string | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("notifySignup: RESEND_API_KEY not set, skipping notification email.");
    return;
  }

  const to = process.env.PLATFORM_OWNER_EMAIL || "angeliquepadavano@icloud.com";

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [to],
        reply_to: REPLY_TO_ADDRESS,
        subject: `New PermitAIO signup: ${params.orgName}`,
        html: `
          <p>A new organization just signed up on PermitAIO.</p>
          <ul>
            <li><strong>Organization:</strong> ${escapeHtml(params.orgName)}</li>
            <li><strong>Slug:</strong> ${escapeHtml(params.orgSlug)}</li>
            <li><strong>Signed up by:</strong> ${escapeHtml(params.userEmail ?? "unknown")}</li>
            <li><strong>When:</strong> ${new Date().toISOString()}</li>
          </ul>
        `,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`notifySignup: Resend API returned ${res.status}: ${body}`);
    }
  } catch (err) {
    console.error("notifySignup: failed to send notification email", err);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
