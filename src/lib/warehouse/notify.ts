const RESEND_ENDPOINT = "https://api.resend.com/emails";
const FROM_ADDRESS = "PermitAIO <notifications@permitaio.com>";
const REPLY_TO_ADDRESS = "hello@permitaio.com";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;");
}

export function parseNotifyEmails(raw: string | null | undefined): string[] {
  const seen = new Set<string>();
  for (const part of (raw ?? "").split(/[,;\n]+/)) {
    const email = part.trim().toLowerCase();
    if (email.includes("@") && email.includes(".") && !seen.has(email)) seen.add(email);
  }
  return [...seen];
}

export async function notifyWarehouseReady(params: {
  to: string | string[];
  jobNumber: string;
  clientName: string;
  address: string;
  openingCount: number;
  brokenCount: number;
  brokenNotes: string[];
}): Promise<string | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return "Email is not configured (RESEND_API_KEY).";
  const to = Array.isArray(params.to) ? params.to : parseNotifyEmails(params.to);
  if (to.length === 0) return "Set warehouse check-in emails in Settings first.";

  const brokenHtml =
    params.brokenCount > 0
      ? `<p><strong>${params.brokenCount} broken</strong></p><ul>${params.brokenNotes
          .map((n) => `<li>${escapeHtml(n)}</li>`)
          .join("")}</ul>`
      : "<p>No broken units reported.</p>";

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to,
        reply_to: REPLY_TO_ADDRESS,
        subject: `Ready to schedule — ${params.jobNumber} ${params.clientName}`,
        html: `<p>Warehouse checked in <strong>${params.openingCount}</strong> openings for job <strong>${escapeHtml(
          params.jobNumber,
        )}</strong>.</p>
        <p>${escapeHtml(params.clientName)}<br/>${escapeHtml(params.address || "")}</p>
        ${brokenHtml}
        <p>This job is now on the manager <strong>Need to be scheduled</strong> list.</p>`,
      }),
    });
    if (!res.ok) return `Email did not send (${res.status}).`;
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Email did not send.";
  }
}
