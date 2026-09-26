const RESEND_ENDPOINT = "https://api.resend.com/emails";
const FROM_ADDRESS = "PermitAIO <invites@permitaio.com>";
const REPLY_TO_ADDRESS = "hello@permitaio.com";
const NOTIFY_TO = [
  process.env.PLATFORM_OWNER_EMAIL || "hello@permitaio.com",
  "hello@permitaio.com",
].filter((v, i, a) => a.indexOf(v) === i);

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function notifyInviteEvent(params: {
  event: "opened" | "password_set";
  email: string | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("notifyInviteEvent: RESEND_API_KEY not set");
    return;
  }

  const opened = params.event === "opened";
  const subject = opened
    ? `Invite link opened: ${params.email ?? "unknown"}`
    : `Invite accepted (password set): ${params.email ?? "unknown"}`;
  const line = opened
    ? "Someone clicked a PermitAIO invite link."
    : "Someone finished setting their password from an invite.";

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: NOTIFY_TO,
        reply_to: REPLY_TO_ADDRESS,
        subject,
        html: `<p>${line}</p><ul>
          <li><strong>Email:</strong> ${escapeHtml(params.email ?? "unknown")}</li>
          <li><strong>When:</strong> ${new Date().toISOString()}</li>
        </ul>`,
      }),
    });
    if (!res.ok) {
      console.error("notifyInviteEvent", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("notifyInviteEvent", err);
  }
}
