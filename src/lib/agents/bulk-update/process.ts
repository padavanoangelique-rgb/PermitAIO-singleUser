import "server-only";
import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBulkEmail, type BulkPatch } from "./parse";
import { notify } from "@/lib/notifications/notify";

/** Never overwritten by any agent, regardless of trigger — mirrors the same
 * rule in data-agent/engine.ts and sheet-sync/sync.ts. */
const PROTECTED_SUB_STATUS = "Engineering Pending";

function adminTable(admin: ReturnType<typeof createAdminClient>, table: string) {
  return (admin as unknown as { from: (name: string) => any }).from(table);
}

function sourceHash(messageId: string): string {
  return createHash("sha256").update(`bulk:${messageId}`).digest("hex").slice(0, 16);
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

function patchPayload(patch: BulkPatch): Record<string, string> {
  return { [patch.field]: patch.value };
}

export type BulkProcessResult = {
  isBulk: boolean;
  updated: string[];
  missing: string[];
  skipped: string[];
  reason: string;
};

export async function processBulkEmail(input: { orgId?: string;
  messageId: string;
  subject: string;
  body: string;
}): Promise<BulkProcessResult> {
  const parsed = parseBulkEmail(input.subject, input.body);
  if (!parsed.isBulk) {
    return { isBulk: false, updated: [], missing: [], skipped: [], reason: parsed.reason };
  }
  if (!parsed.patch || parsed.jobNumbers.length === 0) {
    return {
      isBulk: true,
      updated: [],
      missing: [],
      skipped: parsed.skipped,
      reason: parsed.reason,
    };
  }

  const admin = createAdminClient();
  const orgId = input.orgId ?? (await resolveOrgId(admin));
  if (!orgId) {
    return {
      isBulk: true,
      updated: [],
      missing: [],
      skipped: parsed.skipped,
      reason: "No organization available for bulk update.",
    };
  }

  const hash = sourceHash(input.messageId);
  const updated: string[] = [];
  const missing: string[] = [];
  const skipped = [...parsed.skipped];
  const payload = patchPayload(parsed.patch);

  for (const jobNumber of parsed.jobNumbers) {
    const { data: job } = await adminTable(admin, "jobs")
      .select("id, job_number, sub_status, permit_tech")
      .eq("org_id", orgId)
      .eq("job_number", jobNumber)
      .maybeSingle();

    if (!job) {
      missing.push(jobNumber);
      continue;
    }

    if (parsed.patch.field === "sub_status" && job.sub_status === PROTECTED_SUB_STATUS) {
      skipped.push(`${jobNumber}: status protected (${PROTECTED_SUB_STATUS})`);
      continue;
    }

    const { error } = await adminTable(admin, "jobs").update(payload).eq("id", job.id).eq("org_id", orgId);
    if (error) {
      skipped.push(`${jobNumber}: ${error.message}`);
      continue;
    }

    const message = `Set ${parsed.patch.field} to ${parsed.patch.value}.`;
    await adminTable(admin, "job_activity").insert({
      org_id: orgId,
      job_id: job.id,
      user_id: null,
      activity_type: "system",
      message: `[Bulk Agent] ${message} Source ref: ${hash}.`,
    });
    await notify({
      orgId,
      jobId: job.id,
      permitTech: job.permit_tech,
      source: "bulk_agent",
      message,
    });
    updated.push(jobNumber);
  }

  return {
    isBulk: true,
    updated,
    missing,
    skipped,
    reason: updated.length
      ? `Updated ${parsed.patch.field} to ${parsed.patch.value} on ${updated.length} job(s).`
      : "No jobs were updated.",
  };
}
