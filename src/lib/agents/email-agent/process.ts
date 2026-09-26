import "server-only";
import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { classifyPermitEmail, isStatusInEvent, isStatusOutEvent } from "./classify";
import { matchEmailToJob, matchEmailSegments, isAutomatedSender } from "./match";
import { parseShopMailbox, mailboxPrefix } from "@/lib/chat/mailboxes";
import { notify } from "@/lib/notifications/notify";
import type {
  EmailAgentInput,
  EmailAgentJob,
  EmailAgentProcessResult,
  JobMatch,
  PermitEmailClassification,
} from "./types";

const AUTO_NOTE_MATCH_CONFIDENCE = 0.92;

const EVENT_LABELS: Record<string, string> = {
  client_update_request: "Client or coworker asked for a status update",
  permit_approved: "Permit approval detected",
  permit_issued: "Permit issuance detected",
  corrections_required: "Permit corrections detected",
  fees_due: "Permit fees/payment notice detected",
  submitted_or_received: "Permit submission/review receipt detected",
  inspection_update: "Inspection update detected",
  general_update: "Job email update detected",
};

function adminTable(admin: ReturnType<typeof createAdminClient>, table: string) {
  return (admin as unknown as { from: (name: string) => any }).from(table);
}

function sourceHash(messageId: string): string {
  return createHash("sha256").update(messageId).digest("hex").slice(0, 16);
}

function cleanOneLine(value: string, max = 180): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

function agentMarker(event: string): string {
  if (isStatusOutEvent(event as never)) return "[Status Out]";
  if (isStatusInEvent(event as never)) return "[Status In]";
  return "[Email Agent]";
}

export async function findOrgIdByMailboxPrefix(prefix: string): Promise<string | null> {
  if (!prefix) return null;
  const admin = createAdminClient();
  const { data } = await adminTable(admin, "organizations").select("id, slug").limit(500);
  const hit = ((data ?? []) as { id: string; slug: string }[]).find(
    (o) => mailboxPrefix(o.slug) === prefix || o.slug.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 32) === prefix,
  );
  return hit?.id ?? null;
}

async function dingHoaTech(
  admin: ReturnType<typeof createAdminClient>,
  match: JobMatch,
  message: string,
) {
  const label = match.job.hoa_tech;
  if (!label) {
    await notify({
      orgId: match.job.org_id,
      jobId: match.job.id,
      permitTech: null,
      source: "email_agent",
      message,
    });
    return;
  }
  const { data: members } = await adminTable(admin, "organization_members")
    .select("user_id")
    .eq("org_id", match.job.org_id)
    .eq("hoa_tech_label", label);
  const rows = (members ?? []) as { user_id: string }[];
  if (rows.length === 0) {
    await notify({
      orgId: match.job.org_id,
      jobId: match.job.id,
      permitTech: label,
      source: "email_agent",
      message,
    });
    return;
  }
  for (const row of rows) {
    await notify({
      orgId: match.job.org_id,
      jobId: match.job.id,
      permitTech: label,
      source: "email_agent",
      message,
      recipientUserId: row.user_id,
    });
  }
}

/** Writes one job_activity note (idempotent per job+message) and notifies. Returns false if a note for this message already existed on this job. */
async function addNoteForMatch(
  admin: ReturnType<typeof createAdminClient>,
  match: JobMatch,
  classification: PermitEmailClassification,
  input: EmailAgentInput,
  messageIdHash: string,
  ): Promise<boolean> {
  const eventLabel = EVENT_LABELS[classification.event] ?? "Job email update detected";
  const sender = cleanOneLine(input.from || "Unknown sender", 120);
  const subject = cleanOneLine(input.subject || "(no subject)", 180);
  const marker = agentMarker(classification.event);
  const note = [
    `${marker} ${eventLabel}.`,
    `From: ${sender}.`,
    `Subject: ${subject}.`,
    match.job.permit_number ? `Permit #: ${match.job.permit_number}.` : "",
    `Recommended action: ${classification.recommendedAction}`,
    `Source ref: ${messageIdHash}.`,
    "No PermitAIO status or stage was changed automatically.",
    ].filter(Boolean).join(" ");

const { data: existing, error: existingError } = await adminTable(admin, "job_activity")
  .select("id")
  .eq("job_id", match.job.id)
  .ilike("message", `%${messageIdHash}%`)
  .limit(1)
  .maybeSingle();

if (existingError) throw existingError;
  if (existing) return false;

const { error: insertError } = await adminTable(admin, "job_activity").insert({
  org_id: match.job.org_id,
  job_id: match.job.id,
  user_id: null,
  activity_type: "system",
  message: note,
});
  if (insertError) throw insertError;

const desk = input.desk ?? parseShopMailbox(input.to)?.desk;
if (desk === "hoa") {
  await dingHoaTech(admin, match, `${eventLabel} on job ${match.job.job_number}.`);
} else {
  await notify({
    orgId: match.job.org_id,
    jobId: match.job.id,
    permitTech: match.job.permit_tech,
    source: desk === "permits_dept" || input.to?.toLowerCase().includes("permitsagent@") ? "permits_agent" : "email_agent",
    message: `${eventLabel} on job ${match.job.job_number}.`,
  });
}

return true;
}

export async function processPermitEmail(input: EmailAgentInput): Promise<EmailAgentProcessResult> {
  const messageIdHash = sourceHash(input.messageId);
  const classification = classifyPermitEmail(input.subject, input.body); if (isAutomatedSender(input.from)) { return { messageIdHash, classification, match: null, noteAdded: false, requiresReview: true, reason: "Automated sender (Google or mail-system message), not matched to a job." }; }
  const admin = createAdminClient();

  let jobsQuery = adminTable(admin, "jobs")
    .select("id, org_id, job_number, client_name, permit_number, jurisdiction, address, sub_status, stage, permit_tech, hoa_tech")
    .limit(5000);
  if (input.orgId) jobsQuery = jobsQuery.eq("org_id", input.orgId);
  const { data: jobs, error: jobsError } = await jobsQuery;

if (jobsError) throw jobsError;
  const jobList = (jobs ?? []) as EmailAgentJob[];

const match = matchEmailToJob(input.subject, input.body, jobList);

const idHit = !!match?.reasons.some(
  (reason) => reason.field === "job_number" || reason.field === "permit_number",
  );
  const safeToAddNote =
    !!match &&
    !match.ambiguous &&
    idHit &&
    match.confidence >= AUTO_NOTE_MATCH_CONFIDENCE;

if (safeToAddNote && match) {
  const added = await addNoteForMatch(admin, match, classification, input, messageIdHash);
  return {
    messageIdHash,
    classification,
    match,
    noteAdded: true,
    requiresReview: false,
    reason: added
    ? `${agentMarker(classification.event)} Job # or permit # matched. Note added. Status unchanged.`
      : "The note already existed; no duplicate was added.",
  };
}

// Whole-email match wasn't safe to auto-note — often because the email is
// a digest naming several permits/jobs at once, which makes every job
// mentioned tie for the same top score. Split the email into sentence/line
// segments and try to match+note each one to its own job individually,
// since a digest's individual lines are rarely ambiguous even when the
// email as a whole is.
const segmentMatches = matchEmailSegments(input.subject, input.body, jobList);

if (segmentMatches.length === 0) {
  return {
    messageIdHash,
    classification,
    match,
    noteAdded: false,
    requiresReview: true,
    reason: !match
    ? "No PermitAIO job matched the email."
      : match.ambiguous
    ? "More than one PermitAIO job matched at the same confidence."
      : !idHit
    ? "No explicit job number or permit number. Address is not enough for an automatic note."
      : "The job match was below the automatic-note confidence threshold.",
  };
}

let notesAdded = 0;
  const jobNumbers: string[] = [];
  for (const { segment, match: segmentMatch } of segmentMatches) {
    const segmentClassification = classifyPermitEmail("", segment);
    const added = await addNoteForMatch(admin, segmentMatch, segmentClassification, input, messageIdHash);
    if (added) notesAdded++;
    jobNumbers.push(segmentMatch.job.job_number);
  }

return {
  messageIdHash,
  classification,
  match: segmentMatches[0].match,
  noteAdded: notesAdded > 0,
  requiresReview: false,
  reason: `Digest email — matched and noted ${segmentMatches.length} job(s): ${jobNumbers.join(", ")}.`,
};
}
