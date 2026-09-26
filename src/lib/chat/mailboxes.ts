/** Per-shop mail aliases on the locked inbox agent@permitaio.com.
 * "client" = the contractor company, not the word client.
 * Example: Guardian → guardian_permitagent@permitaio.com
 */

export const AGENT_INBOX = "agent@permitaio.com";
export const PERMITS_DEPT_ALIAS = "permitsagent@permitaio.com";
const DOMAIN = "permitaio.com";

export type ShopMailDesk = "permit" | "hoa" | "permits_dept";

export type ParsedShopMail = {
  prefix: string;
  desk: ShopMailDesk;
};

/** Org slug → alias local-part. guardian, Guard What Matters → guardian / guardwhatmatters */
export function mailboxPrefix(slug: string) {
  return (slug.split("-")[0] || slug).replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 32) || "shop";
}

export function permitAgentMailbox(slug: string) {
  return `${mailboxPrefix(slug)}_permitagent@${DOMAIN}`;
}

export function hoaAgentMailbox(slug: string) {
  return `${mailboxPrefix(slug)}_hoaagent@${DOMAIN}`;
}

export function mailboxForBot(botId: string, slug: string): string | undefined {
  if (botId === "permit_mail") return permitAgentMailbox(slug);
  if (botId === "hoa_mail") return hoaAgentMailbox(slug);
  return undefined;
}

export function shopMailboxes(slug: string) {
  const shop = mailboxPrefix(slug);
  return [
    {
      addr: AGENT_INBOX,
      job: "The real inbox. PermitAIO Email Agent is locked to this. Grok may look; do not auto-reply.",
    },
    {
      addr: permitAgentMailbox(slug),
      job: `This shop’s permit mail (${shop}). Create this alias on ${AGENT_INBOX}. Match the job. Ding the permit tech.`,
    },
    {
      addr: hoaAgentMailbox(slug),
      job: `This shop’s HOA mail (${shop}). Create this alias on ${AGENT_INBOX}. Stick to the job. Ding the HOA tech.`,
    },
    {
      addr: PERMITS_DEPT_ALIAS,
      job: "Shared building-dept alias when there is a permit number but no job # yet.",
    },
  ];
}

/** Read the To: header. guardian_permitagent@… → { prefix: "guardian", desk: "permit" } */
export function parseShopMailbox(to: string | null | undefined): ParsedShopMail | null {
  if (!to) return null;
  const hay = to.toLowerCase();
  const permit = hay.match(/\b([a-z0-9]+)_permitagent@permitaio\.com\b/);
  if (permit) return { prefix: permit[1], desk: "permit" };
  const hoa = hay.match(/\b([a-z0-9]+)_hoaagent@permitaio\.com\b/);
  if (hoa) return { prefix: hoa[1], desk: "hoa" };
  if (hay.includes(PERMITS_DEPT_ALIAS)) return { prefix: "", desk: "permits_dept" };
  return null;
}
