import "server-only";
import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseIntakeEmail } from "./parse";
import { notify } from "@/lib/notifications/notify";

const STAGE = "Need Permit Submittal";
const SUB_STATUS = "Need to Submit";

function adminTable(admin: ReturnType<typeof createAdminClient>, table: string) {
  return (admin as unknown as { from: (name: string) => any }).from(table);
}

function sourceHash(messageId: string): string {
  return createHash("sha256").update(`intake:${messageId}`).digest("hex").slice(0, 16);
}

async function resolveOrgId(admin: ReturnType<typeof createAdminClient>): Promise<string | null> {
  if (process.env.INTAKE_ORG_ID) return process.env.INTAKE_ORG_ID;
  const { data } = await adminTable(admin, "organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export type IntakeProcessResult = {
  isIntake: boolean;
  created: string[];
  skipped: string[];
  reason: string;
};

export async function processIntakeEmail(input: { orgId?: string;
  messageId: string;
  subject: string;
  body: string;
}): Promise<IntakeProcessResult> {
  const parsed = parseIntakeEmail(input.subject, input.body);
  if (!parsed.isIntake) {
    return { isIntake: false, created: [], skipped: [], reason: "Not an intake message." };
  }
  if (parsed.lines.length === 0) {
    return {
      isIntake: true,
      created: [],
      skipped: parsed.skipped,
      reason: "Intake label matched but no job number | name lines were found.",
    };
  }

  const admin = createAdminClient();
  const orgId = input.orgId ?? (await resolveOrgId(admin));
  if (!orgId) {
    return { isIntake: true, created: [], skipped: parsed.skipped, reason: "No organization available for intake." };
  }

  const created: string[] = [];
  const skipped = [...parsed.skipped];
  const hash = sourceHash(input.messageId);

  for (const line of parsed.lines) {
    const { data: existing } = await adminTable(admin, "jobs")
      .select("id, job_number")
      .eq("org_id", orgId)
      .eq("job_number", line.jobNumber)
      .maybeSingle();

    if (existing) {
      skipped.push(`${line.jobNumber} already exists`);
      continue;
    }

    const permitTech = parsed.tech || "Permit Tech 1";
    const { data: job, error } = await adminTable(admin, "jobs")
      .insert({
        org_id: orgId,
        job_number: line.jobNumber,
        client_name: line.clientName,
        trade_type: "Win",
        stage: STAGE,
        sub_status: SUB_STATUS,
        permit_tech: permitTech,
      })
      .select("id, job_number")
      .single();

    if (error || !job) {
      skipped.push(`${line.jobNumber}: ${error?.message ?? "insert failed"}`);
      continue;
    }

    const message = `Created job ${line.jobNumber} — ${line.clientName}. Status ${STAGE} / ${SUB_STATUS}.${parsed.tech ? ` Tech: ${parsed.tech}.` : ""}`;
    await adminTable(admin, "job_activity").insert({
      org_id: orgId,
      job_id: job.id,
      user_id: null,
      activity_type: "system",
      message: `[Intake Agent] ${message} Source ref: ${hash}.`,
    });
    await notify({
      orgId,
      jobId: job.id,
      permitTech,
      source: "intake_agent",
      message,
    });
    created.push(line.jobNumber);
  }

  return {
    isIntake: true,
    created,
    skipped,
    reason: created.length
      ? `Created ${created.length} job(s).`
      : "No new jobs were created.",
  };
}
