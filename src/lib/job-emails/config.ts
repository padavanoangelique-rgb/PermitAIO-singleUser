// Shared helpers for emails sent from (and replied back to) a job.
//
// Every outbound email carries Reply-To: j-<job id, 32 hex>@<reply domain>. When the recipient
// replies, the Resend inbound webhook reads that address to file the reply on the right job.

export const JOB_MAIL_FROM_ADDRESS = "jobs@permitaio.com";

export function replyDomain(): string {
  return process.env.INBOUND_REPLY_DOMAIN || "reply.permitaio.com";
}

export function jobReplyAddress(jobId: string): string {
  return `j-${jobId.replace(/-/g, "").toLowerCase()}@${replyDomain()}`;
}

/** Finds a job id in any To/Cc address like "Name <j-<32 hex>@reply.permitaio.com>". */
export function jobIdFromAddresses(addresses: string[]): string | null {
  for (const addr of addresses) {
    const m = String(addr).toLowerCase().match(/\bj-([0-9a-f]{32})@/);
    if (m) {
      const h = m[1];
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    }
  }
  return null;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
