import type { EmailAgentJob, JobMatch, JobMatchReason } from "./types";

function normalizeWords(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * True when `id` appears in `text` as a token of its own, never inside a longer number or word
 * (so a job number 2509 cannot match inside 12509 or 20250912). Punctuation and spacing inside the id
 * are flexible: "26 - 00002899", "26-00002899" and "2600002899" are the same permit number.
 *
 * Short all-digit ids (under 5 digits, e.g. job 2509) are far too easy to hit by accident (years,
 * times, codes), so they only count when a label sits right before them: "Job 2509", "job #2509",
 * "Job number: 2509" or "#2509".
 */
function containsId(text: string, id: string | null | undefined): boolean {
  const parts = (id ?? "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const compact = parts.join("");
  if (compact.length < 4) return false;
  const body = parts.map(escapeRegExp).join("[^a-z0-9]*");
  const shortNumeric = /^\d+$/.test(compact) && compact.length < 5;
  const label = shortNumeric ? "(?:job\\s*(?:no\\.?|number)?|#)\\s*[:#.\\-]?\\s*" : "";
  return new RegExp(`(?<![a-z0-9])${label}${body}(?![a-z0-9])`, "i").test(text.toLowerCase());
}

/**
 * Mail that is never about a specific job: Google account/security/admin alerts and bounce notices.
 * (Permit-department "no-reply" mail is deliberately NOT here: those are real permit notices.)
 */
export function isAutomatedSender(from: string | null | undefined): boolean {
  const f = (from ?? "").toLowerCase();
  return /@([a-z0-9-]+\.)*google\.com\b/.test(f) || /(^|[<\s"'])(mailer-daemon|postmaster)@/.test(f);
}

function scoreJob(text: string, job: EmailAgentJob): JobMatch {
  const reasons: JobMatchReason[] = [];
  let score = 0;

  if (containsId(text, job.permit_number)) {
    score += 80;
    reasons.push({ field: "permit_number", weight: 80, detail: "Permit number matched." });
  }

  if (containsId(text, job.job_number)) {
    score += 70;
    reasons.push({ field: "job_number", weight: 70, detail: "Job number matched." });
  }

  const normalizedText = normalizeWords(text);
  const address = normalizeWords(job.address);
  if (address.length >= 8 && normalizedText.includes(address)) {
    score += 45;
    reasons.push({ field: "address", weight: 45, detail: "Exact normalized property address matched." });
  }

  const clientName = normalizeWords(job.client_name);
  if (clientName.length >= 5 && normalizedText.includes(clientName)) {
    score += 15;
    reasons.push({ field: "client_name", weight: 15, detail: "Client name matched." });
  }

  const confidence = Math.min(
    0.99,
    score >= 100 ? 0.99 : score >= 80 ? 0.96 : score >= 70 ? 0.92 : score >= 45 ? 0.78 : score >= 15 ? 0.5 : 0.1,
  );

  return { job, score, confidence, reasons, ambiguous: false };
}

export function matchEmailToJob(subject: string, body: string, jobs: EmailAgentJob[]): JobMatch | null {
  const text = `${subject}\n${body}`;
  const ranked = jobs
    .map((job) => scoreJob(text, job))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) return null;

  const best = ranked[0];
  const second = ranked[1];

  if (second && second.score === best.score) {
    return {
      ...best,
      confidence: Math.min(best.confidence, 0.45),
      ambiguous: true,
      reasons: [
        ...best.reasons,
        { field: "job_number", weight: 0, detail: "Multiple PermitAIO jobs received the same top match score." },
      ],
    };
  }

  return best;
}

function splitIntoSegments(text: string): string[] {
  return text
    .split(/(?<=[.;\n])\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export type SegmentMatch = {
  segment: string;
  match: JobMatch;
};

/**
 * Digest emails (e.g. "here are the updates for permits X, Y, Z") name
 * several jobs at once, so matchEmailToJob's whole-email pass usually ties
 * and bails out as ambiguous. This splits the email into sentence/line-sized
 * segments and matches each one independently, so a digest's individual
 * lines can still produce a confident, safe match even though the email as
 * a whole can't.
 */
export function matchEmailSegments(subject: string, body: string, jobs: EmailAgentJob[]): SegmentMatch[] {
  const segments = splitIntoSegments(`${subject}\n${body}`);
  const seenJobIds = new Set<string>();
  const results: SegmentMatch[] = [];

  for (const segment of segments) {
    const match = matchEmailToJob("", segment, jobs);
    if (!match || match.ambiguous) continue;

    const idHit = match.reasons.some(
      (reason) => reason.field === "job_number" || reason.field === "permit_number",
    );
    if (!idHit || seenJobIds.has(match.job.id)) continue;

    seenJobIds.add(match.job.id);
    results.push({ segment, match });
  }

  return results;
}
