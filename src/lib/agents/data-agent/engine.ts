import "server-only";
import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidStage, isValidSubStatus, parseSheetDate } from "@/lib/agents/sheet-sync/validate";
import { notify, type NotificationSource } from "@/lib/notifications/notify";
import type { CsvRecord } from "@/lib/inventory/csv";
import { DATA_AGENT_INSTRUCTIONS, type DataAgentInstruction } from "./types";

/**
 * The Data Agent absorbs what used to be three separate paths — the manual
 * CSV importer in Permit Inventory, the Bulk Update email agent, and the
 * Job Intake email agent — behind one instruction-aware core, shared by
 * every input (manager upload, an emailed CSV attachment, a connected
 * Google Sheet). Each run is scoped to exactly one instruction, so a run
 * never does more than what was asked.
 */
export { DATA_AGENT_INSTRUCTIONS, type DataAgentInstruction };

/** Never overwritten, under any instruction — a job in engineering review
 * only leaves that state through the app itself, never a spreadsheet. */
const PROTECTED_SUB_STATUS = "Engineering Pending";

const DATE_FIELDS = ["sale_date", "assigned_date", "submitted_date", "approved_date", "noc_date"] as const;

/** Fields eligible for "fill in missing fields" — deliberately excludes
 * stage, sub_status, and permit_tech, matching the existing importer's
 * documented rule: a fill-gaps run should never silently move a job's
 * workflow state or reassign its tech. */
const FILL_MISSING_FIELDS = [
  "client_name",
  "trade_type",
  "contract_value",
  "permit_number",
  "jurisdiction",
  "address",
  "folio_number",
  "notes",
  ...DATE_FIELDS,
] as const;

interface Job {
  id: string;
  job_number: string;
  sub_status: string;
  [key: string]: unknown;
}

export interface DataAgentSourceMeta {
  source: NotificationSource;
  /** Human-readable origin for the job_activity/notification message, e.g.
   * the uploaded filename or the connected sheet's display name. */
  label: string;
  tag: string; // e.g. "Data Agent"
}

export interface DataAgentRunResult {
  inserted: number;
  updated: number;
  skipped: number;
  skippedReasons: string[];
}

function adminTable(admin: ReturnType<typeof createAdminClient>, table: string) {
  return (admin as unknown as { from: (t: string) => any }).from(table);
}

const pick = (row: CsvRecord, ...names: string[]) => names.map((name) => row[name]).find(Boolean) ?? "";

function contractValue(raw: string): number | null {
  if (!raw) return null;
  const num = Number(raw.replace(/[$,]/g, ""));
  return Number.isFinite(num) ? num : null;
}

async function defaultStageAndSubStatus(orgId: string): Promise<{ stage: string; subStatus: string }> {
  const admin = createAdminClient();
  const { data } = await adminTable(admin, "stages")
    .select("name")
    .eq("org_id", orgId)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  return { stage: data?.name ?? "Need Permit Submittal", subStatus: "Need to Submit" };
}

export async function runDataAgent(opts: {
  orgId: string;
  userId: string | null;
  instruction: DataAgentInstruction;
  permitTech: string;
  rows: CsvRecord[];
  meta: DataAgentSourceMeta;
}): Promise<DataAgentRunResult> {
  const admin = createAdminClient();
  const { data: existingJobs } = await adminTable(admin, "jobs").select("*").eq("org_id", opts.orgId);
  const byNumber = new Map<string, Job>(
    ((existingJobs ?? []) as Job[]).map((j) => [j.job_number.trim().toLowerCase(), j]),
  );

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const skippedReasons: string[] = [];
  const seenInFile = new Set<string>();
  const runHash = createHash("sha256").update(`${opts.meta.source}:${opts.meta.label}:${Date.now()}`).digest("hex").slice(0, 12);

  async function log(jobId: string, message: string) {
    await adminTable(admin, "job_activity").insert({
      org_id: opts.orgId,
      job_id: jobId,
      user_id: null,
      activity_type: "system",
      message: `[${opts.meta.tag}] ${message} Source: ${opts.meta.label}. Ref: ${runHash}.`,
    });
    await notify({
      orgId: opts.orgId,
      jobId,
      permitTech: opts.permitTech,
      source: opts.meta.source,
      message,
    });
  }

  for (const row of opts.rows) {
    const jobNumber = pick(row, "job_number", "job #", "job#", "job").trim();
    if (!jobNumber) {
      skipped++;
      skippedReasons.push("missing job number");
      continue;
    }
    const key = jobNumber.toLowerCase();
    if (seenInFile.has(key)) {
      skipped++;
      skippedReasons.push(`${jobNumber}: duplicate in file`);
      continue;
    }
    seenInFile.add(key);

    const existing = byNumber.get(key);

    if (opts.instruction === "add_new_jobs") {
      if (existing) {
        skipped++;
        skippedReasons.push(`${jobNumber}: already exists`);
        continue;
      }
      const { stage, subStatus } = await defaultStageAndSubStatus(opts.orgId);
      const { data: job, error } = await adminTable(admin, "jobs")
        .insert({
          org_id: opts.orgId,
          created_by: opts.userId,
          client_name: pick(row, "client_name", "client") || "Unknown",
          job_number: jobNumber,
          trade_type: pick(row, "trade_type", "trade") || null,
          contract_value: contractValue(pick(row, "contract_value", "value")),
          permit_number: pick(row, "permit_number", "permit #", "permit#") || null,
          jurisdiction: pick(row, "jurisdiction", "city", "county", "municipality") || null,
          address: pick(row, "address", "job_address", "property_address", "site_address") || null,
          folio_number: pick(row, "folio_number", "folio #", "folio#", "folio") || null,
          notes: pick(row, "notes", "note", "comments") || null,
          stage,
          sub_status: subStatus,
          permit_tech: opts.permitTech,
          sale_date: parseSheetDate(pick(row, "sale_date", "sale")),
          assigned_date: parseSheetDate(pick(row, "assigned_date", "assigned")),
          submitted_date: parseSheetDate(pick(row, "submitted_date", "submitted")),
          approved_date: parseSheetDate(pick(row, "approved_date", "approved")),
        })
        .select("id")
        .single();
      if (error || !job) {
        skipped++;
        skippedReasons.push(`${jobNumber}: ${error?.message ?? "insert failed"}`);
        continue;
      }
      inserted++;
      await log(job.id, `Created job ${jobNumber} — ${pick(row, "client_name", "client") || "Unknown"}.`);
      continue;
    }

    // Every other instruction only ever touches an existing job — this
    // agent never creates a job unless the run was explicitly told to.
    if (!existing) {
      skipped++;
      skippedReasons.push(`${jobNumber}: no matching job`);
      continue;
    }

    if (opts.instruction === "update_status") {
      const rawStatus = pick(row, "sub_status", "status");
      if (!rawStatus) {
        skipped++;
        skippedReasons.push(`${jobNumber}: no status value in row`);
        continue;
      }
      if (existing.sub_status === PROTECTED_SUB_STATUS) {
        skipped++;
        skippedReasons.push(`${jobNumber}: status protected (${PROTECTED_SUB_STATUS})`);
        continue;
      }
      const validStatus = isValidSubStatus(rawStatus);
      if (!validStatus) {
        skipped++;
        skippedReasons.push(`${jobNumber}: "${rawStatus}" is not a valid status`);
        continue;
      }
      if (validStatus === existing.sub_status) {
        skipped++;
        skippedReasons.push(`${jobNumber}: already ${validStatus}`);
        continue;
      }
      const { error } = await adminTable(admin, "jobs")
        .update({ sub_status: validStatus })
        .eq("id", existing.id)
        .eq("org_id", opts.orgId);
      if (error) {
        skipped++;
        skippedReasons.push(`${jobNumber}: ${error.message}`);
        continue;
      }
      updated++;
      await log(existing.id, `Set sub_status to ${validStatus}.`);
      continue;
    }

    if (opts.instruction === "update_dates") {
      const patch: Record<string, string> = {};
      for (const field of DATE_FIELDS) {
        if (existing[field]) continue; // fill-blanks-only, same default as everywhere else
        const raw = pick(row, field, field.replace("_date", ""));
        const parsed = raw ? parseSheetDate(raw) : null;
        if (parsed) patch[field] = parsed;
      }
      if (Object.keys(patch).length === 0) {
        skipped++;
        skippedReasons.push(`${jobNumber}: no new dates to set`);
        continue;
      }
      const { error } = await adminTable(admin, "jobs").update(patch).eq("id", existing.id).eq("org_id", opts.orgId);
      if (error) {
        skipped++;
        skippedReasons.push(`${jobNumber}: ${error.message}`);
        continue;
      }
      updated++;
      const setLines = Object.entries(patch).map(([f, v]) => `${f} to ${v}`).join("; ");
      await log(existing.id, `Set ${setLines}.`);
      continue;
    }

    // fill_missing — today's existing importer behavior, unchanged in
    // spirit: only fields that are currently blank get filled; stage,
    // sub_status, and permit_tech are never touched by this instruction.
    const patch: Record<string, string | number> = {};
    const contractRaw = pick(row, "contract_value", "value");
    const maybeSet = (field: (typeof FILL_MISSING_FIELDS)[number], incoming: string | number | null) => {
      const existingVal = existing[field];
      const isEmpty = existingVal === null || existingVal === undefined || existingVal === "";
      if (isEmpty && incoming !== null && incoming !== "") patch[field] = incoming;
    };
    maybeSet("client_name", pick(row, "client_name", "client") || null);
    maybeSet("trade_type", pick(row, "trade_type", "trade") || null);
    maybeSet("contract_value", contractRaw ? contractValue(contractRaw) : null);
    maybeSet("permit_number", pick(row, "permit_number", "permit #", "permit#") || null);
    maybeSet("jurisdiction", pick(row, "jurisdiction", "city", "county", "municipality") || null);
    maybeSet("address", pick(row, "address", "job_address", "property_address", "site_address") || null);
    maybeSet("folio_number", pick(row, "folio_number", "folio #", "folio#", "folio") || null);
    maybeSet("notes", pick(row, "notes", "note", "comments") || null);
    for (const field of DATE_FIELDS) {
      maybeSet(field, parseSheetDate(pick(row, field, field.replace("_date", ""))));
    }

    if (Object.keys(patch).length === 0) {
      skipped++;
      skippedReasons.push(`${jobNumber}: already up to date`);
      continue;
    }
    const { error } = await adminTable(admin, "jobs").update(patch).eq("id", existing.id).eq("org_id", opts.orgId);
    if (error) {
      skipped++;
      skippedReasons.push(`${jobNumber}: ${error.message}`);
      continue;
    }
    updated++;
    const setLines = Object.entries(patch).map(([f, v]) => `${f} to ${v}`).join("; ");
    await log(existing.id, `Filled in ${setLines}.`);
  }

  return { inserted, updated, skipped, skippedReasons };
}

/** Exported so the mapping UI (Google Sheets path) and validate.ts can both
 * confirm a stage name against this org's real, configured stages table
 * rather than any hardcoded list. Re-exported here so callers of the Data
 * Agent don't need to also import from sheet-sync directly. */
export { isValidStage };
