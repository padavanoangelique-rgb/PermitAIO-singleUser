import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUB_STATUSES, type SubStatus } from "@/lib/inventory/constants";

type AnyClient = SupabaseClient<any, any, any>;

export type AssistantResult = {
  handled: boolean;
  reply: string;
};

function todayIso() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function table(supabase: AnyClient, name: string) {
  return (supabase as unknown as { from: (t: string) => any }).from(name);
}

function isQuestion(text: string) {
  return /^\s*(what|who|where|when|why|how|can you (tell|find|look)|could you|tell me|look up|find|what's|whats|status of)\b/i.test(
    text,
  );
}

function isNoteOnly(text: string) {
  if (/\b(change|set|mark|update) (the )?(job |permit )?status\b/i.test(text)) return false;
  return /\bnote only\b|\bjust (a |the )?note\b|\bdon'?t change\b|\bdo not change\b|\bmake a note\b|\badd a note\b|\bput a note\b|\blog a note\b|\bwrite a note\b/i.test(
    text,
  );
}

function isDirectStatusCommand(text: string) {
  if (isNoteOnly(text)) return false;
  return (
    /\b(change|set|mark|update)\b.{0,50}\b(status|submitted|approved|in review|complete|need to submit|corrections|engineering|quote|printed)\b/i.test(
      text,
    ) ||
    /\bi submitted\b/i.test(text) ||
    /\bsubmitted (this |the )?job\b/i.test(text) ||
    /\bmark(?:ed)? (this |it |the job |job )?(as )?(submitted|approved|in review|complete|printed)\b/i.test(text) ||
    /\bstatus (is now|to|=|is)\s/i.test(text)
  );
}

function jobNumberFrom(text: string): string | null {
  const skip = /^(this|that|the|a|an|here|heres|here's|number|no|num|#)$/i;
  const labeled = text.match(/\bjob\s*#?\s*([A-Za-z0-9][A-Za-z0-9._-]{1,24})\b/i);
  if (labeled?.[1] && !skip.test(labeled[1])) return labeled[1].replace(/[.,;:]+$/, "");
  const hashed = text.match(/#\s*([A-Za-z]{0,4}-?\d{3,}(?:-[A-Za-z0-9]+)?)\b/);
  if (hashed?.[1] && !skip.test(hashed[1])) return hashed[1];
  const bare = text.match(/\b(\d{4,}(?:-[A-Za-z0-9]+)?)\b/);
  return bare?.[1] ?? null;
}

function permitNumberFrom(text: string): string | null {
  const m = text.match(/\bpermit\s*#?\s*(?:is|:)?\s*([A-Za-z0-9][A-Za-z0-9._/-]{2,40})/i);
  if (!m?.[1]) return null;
  const value = m[1].replace(/[.,;:]+$/, "");
  if (/^(number|no|num|#)$/i.test(value)) return null;
  return value;
}

function matchSubStatus(text: string): SubStatus | null {
  const t = text.toLowerCase();
  if (/approved pending issuance/.test(t)) return null;
  if (/approved and printed|\bprinted\b/.test(t)) return "Approved and Printed";
  if (/\bapproved\b/.test(t)) return "Approved";
  if (/corrections needed|\bcorrection/.test(t)) return "Corrections Needed";
  if (/engineering pending/.test(t)) return "Engineering Pending";
  if (/quote needed/.test(t)) return "Quote Needed";
  if (/need to submit|needs to be submitted/.test(t)) return "Need to Submit";
  if (
    /\bi submitted\b/.test(t) ||
    /\bsubmitted (this |the )?job\b/.test(t) ||
    /\bmark(?:ed)? (as )?submitted\b/.test(t) ||
    /\bin review\b/.test(t)
  ) {
    return "In Review";
  }
  if (/\bcomplete\b/.test(t)) return "Complete";
  for (const status of SUB_STATUSES) {
    if (t.includes(status.toLowerCase())) return status;
  }
  return null;
}

export function isAssistantCommand(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (isNoteOnly(trimmed)) return true;
  if (isQuestion(trimmed) && !isDirectStatusCommand(trimmed)) return false;
  if (isDirectStatusCommand(trimmed)) return true;
  if (/\bpermit\s*#/.test(trimmed) && jobNumberFrom(trimmed)) return true;
  return false;
}

export async function runAssistantCommand(
  supabase: AnyClient,
  input: { orgId: string; userId: string; text: string },
): Promise<AssistantResult> {
  const text = input.text.trim();
  if (!isAssistantCommand(text)) return { handled: false, reply: "" };

  const jobNumber = jobNumberFrom(text);
  if (!jobNumber) {
    return {
      handled: true,
      reply: "Give me the job number and I’ll put that on the job.",
    };
  }

  const { data: exact } = await table(supabase, "jobs")
    .select("id, job_number, sub_status, permit_number, submitted_date, approved_date, permit_tech")
    .eq("org_id", input.orgId)
    .eq("job_number", jobNumber)
    .maybeSingle();

  let job = exact as
    | {
        id: string;
        job_number: string;
        sub_status: string;
        permit_number: string | null;
        submitted_date: string | null;
        approved_date: string | null;
        permit_tech: string | null;
      }
    | null; type JobRow = NonNullable<typeof job>; if (!job) {
    const { data: prefix } = await table(supabase, "jobs")
      .select("id, job_number, sub_status, permit_number, submitted_date, approved_date, permit_tech")
      .eq("org_id", input.orgId)
      .ilike("job_number", `${jobNumber}%`)
      .limit(5);
    const rows = (prefix ?? []) as JobRow[];
    if (rows.length === 1) job = rows[0];
    else if (rows.length > 1) {
      return {
        handled: true,
        reply: `A few jobs start with ${jobNumber}: ${rows.map((row) => row.job_number).join(", ")}. Give me the full job number.`,
      };
    }
  }

  if (!job) {
    return {
      handled: true,
      reply: `I don’t have job ${jobNumber}. Check the number and try again.`,
    };
  }

  const noteOnly = isNoteOnly(text);
  const permitNumber = permitNumberFrom(text);
  const nextStatus = !noteOnly && isDirectStatusCommand(text) ? matchSubStatus(text) : null;
  const patch: Record<string, string> = {};

  if (nextStatus && nextStatus !== job.sub_status) {
    patch.sub_status = nextStatus;
    const today = todayIso();
    if (nextStatus === "In Review" && !job.submitted_date) patch.submitted_date = today;
    if ((nextStatus === "Approved" || nextStatus === "Approved and Printed") && !job.approved_date) {
      patch.approved_date = today;
    }
  }
  if (!noteOnly && permitNumber && permitNumber !== job.permit_number) {
    patch.permit_number = permitNumber;
  }

  if (Object.keys(patch).length) {
    const { error } = await table(supabase, "jobs")
      .update(patch)
      .eq("id", job.id)
      .eq("org_id", input.orgId);
    if (error) {
      return { handled: true, reply: `I couldn’t save that on ${job.job_number}: ${error.message}` };
    }
  }

  const { error: noteError } = await table(supabase, "job_activity").insert({
    org_id: input.orgId,
    job_id: job.id,
    user_id: input.userId,
    activity_type: "note",
    message: text.replace(/\s+/g, " ").trim(),
  });
  if (noteError) {
    return {
      handled: true,
      reply: `I found ${job.job_number}, but I couldn’t write the note: ${noteError.message}`,
    };
  }

  const bits = [`Got it — job ${job.job_number}.`];
  if (patch.sub_status) bits.push(`Status is now ${patch.sub_status}.`);
  else if (noteOnly) bits.push(`Note only. Status is still ${job.sub_status}.`);
  if (patch.permit_number) bits.push(`Permit # ${patch.permit_number} is on the job.`);
  else if (!patch.sub_status && !noteOnly && permitNumber) bits.push(`Permit # ${permitNumber} was already on the job.`);
  if (!patch.sub_status && !patch.permit_number && !noteOnly) bits.push("Note is on the job.");
  return { handled: true, reply: bits.join(" ") };
}
