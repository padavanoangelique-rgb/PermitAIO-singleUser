import "server-only";
import { mailboxPrefix } from "@/lib/chat/mailboxes";
import { findOrgIdByMailboxPrefix } from "@/lib/agents/email-agent/process";

// One main address per contractor: <shop>@permitaio.com (guardian@, majestic@, premier@, fwd@).
// Mail sent TO it is scoped to that shop (job matching, bulk updates, new-job intake, replies to
// emails sent from a job), and PermitAIO sends job emails FROM it. All of these are Google
// aliases on the single agent@permitaio.com inbox.

const DOMAIN = "permitaio.com";

/** Local-parts that belong to the platform, never to a contractor. */
const RESERVED_LOCALS = new Set([
  "agent",
  "permitsagent",
  "jobs",
  "invites",
  "hello",
  "noreply",
  "no-reply",
  "postmaster",
  "abuse",
  "support",
  "admin",
  "info",
  "billing",
  "sales",
  "team",
  "reply",
]);

/** The address PermitAIO sends from and asks for replies at for this contractor. */
export function contractorAlias(slug: string): string {
  return `${mailboxPrefix(slug)}@${DOMAIN}`;
}

/** Candidate contractor prefixes found in a To/Cc header (plain alphanumeric locals only). */
export function contractorAliasCandidates(header: string | null | undefined): string[] {
  const out: string[] = [];
  const re = /([a-z0-9][a-z0-9._-]*)@permitaio\.com\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(header ?? ""))) !== null) {
    const local = m[1].toLowerCase();
    if (!/^[a-z0-9]+$/.test(local)) continue; // desk aliases like guardian_permitagent are handled elsewhere
    if (RESERVED_LOCALS.has(local)) continue;
    if (!out.includes(local)) out.push(local);
  }
  return out;
}

/** The contractor an incoming message was addressed to, or null (agent@, permitsagent@, unknown). */
export async function orgIdForContractorAlias(header: string | null | undefined): Promise<string | null> {
  for (const candidate of contractorAliasCandidates(header)) {
    const orgId = await findOrgIdByMailboxPrefix(candidate);
    if (orgId) return orgId;
  }
  return null;
}
