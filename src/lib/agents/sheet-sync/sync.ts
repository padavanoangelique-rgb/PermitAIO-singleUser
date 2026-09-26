import "server-only";
import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidAccessToken } from "@/lib/sheets/db";
import { readFullTab } from "./read";
import { normalizeFieldValue, type TargetField } from "./validate";
import { notify } from "@/lib/notifications/notify";

function adminTable(admin: ReturnType<typeof createAdminClient>, table: string) {
  return (admin as unknown as { from: (t: string) => any }).from(table);
}

/** Never overwritten by any agent, regardless of how the write was
 * triggered — a job in engineering review only leaves that state through
 * the app itself. Mirrors the same rule in data-agent/engine.ts. */
const PROTECTED_SUB_STATUS = "Engineering Pending";

interface ColumnMapping {
  column_index: number;
  column_header: string;
  target_field: TargetField;
  is_match_key: boolean;
}

export interface SyncRunResult {
  runId: string;
  status: "success" | "partial_error" | "error";
  rowsRead: number;
  rowsMatched: number;
  rowsUpdated: number;
  rowsSkipped: number;
  rowsErrored: number;
  errorMessage?: string;
}

/**
 * The single sync entrypoint shared by the manual "Sync now" button and the
 * 3x/day cron — reads the mapped range, matches each row to a job by its
 * designated match-key column (job_number, scoped to this connection's org —
 * never by client name or address, since one client routinely has separate
 * job numbers for separate trades), and writes matched fields directly, the
 * same no-approval-gate pattern as the bulk-update email agent.
 *
 * When multiple sheet connections for the same org map the same field, the
 * cron loop (src/app/api/cron/sheets-sync/route.ts) runs connections in
 * priority-descending order so the lowest `priority` number is applied
 * last and wins — this function itself has no cross-connection awareness.
 */
export async function runSheetSync(
  connectionId: string,
  trigger: "manual" | "cron",
  triggeredBy: string | null,
): Promise<SyncRunResult> {
  const admin = createAdminClient();

  const { data: connection, error: connectionError } = await adminTable(admin, "sheet_connections")
    .select("*")
    .eq("id", connectionId)
    .maybeSingle();
  if (connectionError || !connection) {
    throw new Error(`Sheet connection ${connectionId} not found.`);
  }

  const { data: mappingVersion } = await adminTable(admin, "sheet_mapping_versions")
    .select("*")
    .eq("connection_id", connectionId)
    .eq("is_current", true)
    .maybeSingle();
  if (!mappingVersion) {
    throw new Error(`No confirmed mapping for connection ${connectionId}.`);
  }

  const { data: run } = await adminTable(admin, "sheet_sync_runs")
    .insert({
      org_id: connection.org_id,
      connection_id: connectionId,
      mapping_version_id: mappingVersion.id,
      trigger,
      triggered_by: triggeredBy,
      status: "running",
    })
    .select("id")
    .single();
  const runId = run.id as string;

  const finish = async (
    status: SyncRunResult["status"],
    counts: Omit<SyncRunResult, "runId" | "status" | "errorMessage">,
    errorMessage?: string,
  ): Promise<SyncRunResult> => {
    await adminTable(admin, "sheet_sync_runs")
      .update({
        status,
        rows_read: counts.rowsRead,
        rows_matched: counts.rowsMatched,
        rows_updated: counts.rowsUpdated,
        rows_skipped: counts.rowsSkipped,
        rows_errored: counts.rowsErrored,
        error_message: errorMessage ?? null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
    return { runId, status, errorMessage, ...counts };
  };

  const accessToken = await getValidAccessToken(connection.grant_id);
  if (!accessToken) {
    await adminTable(admin, "sheet_connections")
      .update({ status: "error", last_error: "Could not obtain a valid access token." })
      .eq("id", connectionId);
    return finish(
      "error",
      { rowsRead: 0, rowsMatched: 0, rowsUpdated: 0, rowsSkipped: 0, rowsErrored: 0 },
      "Could not obtain a valid access token.",
    );
  }

  const mappings = mappingVersion.mappings as ColumnMapping[];
  const matchKeyMapping = mappings.find((m) => m.is_match_key);
  if (!matchKeyMapping) {
    return finish(
      "error",
      { rowsRead: 0, rowsMatched: 0, rowsUpdated: 0, rowsSkipped: 0, rowsErrored: 0 },
      "No match-key (Job #) column configured in this mapping.",
    );
  }
  const writableMappings = mappings.filter((m) => !m.is_match_key);

  let rows: string[][];
  try {
    rows = await readFullTab(accessToken, connection.spreadsheet_id, connection.tab_name, mappingVersion.header_row);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read the sheet.";
    await adminTable(admin, "sheet_connections").update({ status: "error", last_error: message }).eq("id", connectionId);
    return finish("error", { rowsRead: 0, rowsMatched: 0, rowsUpdated: 0, rowsSkipped: 0, rowsErrored: 0 }, message);
  }

  let rowsMatched = 0;
  let rowsUpdated = 0;
  let rowsSkipped = 0;
  let rowsErrored = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const jobNumber = (row[matchKeyMapping.column_index] ?? "").trim();
    if (!jobNumber) continue;

    try {
      const { data: job } = await adminTable(admin, "jobs")
        .select("*")
        .eq("org_id", connection.org_id)
        .eq("job_number", jobNumber)
        .maybeSingle();

      if (!job) {
        rowsSkipped++;
        continue;
      }
      rowsMatched++;

      const payload: Record<string, string | number> = {};
      const skippedFields: string[] = [];

      for (const mapping of writableMappings) {
        const rawValue = row[mapping.column_index];
        if (rawValue === undefined || rawValue.trim() === "") continue;
        if (mapping.target_field === "sub_status" && job.sub_status === PROTECTED_SUB_STATUS) {
          skippedFields.push(`sub_status (protected: ${PROTECTED_SUB_STATUS})`);
          continue;
        }
        const normalized = await normalizeFieldValue(connection.org_id, mapping.target_field, rawValue);
        if (normalized === null) {
          skippedFields.push(`${mapping.target_field} ("${rawValue}")`);
          continue;
        }
        payload[mapping.target_field] = normalized;
      }

      for (const [field, value] of Object.entries(payload)) { const cur = String((job as Record<string, unknown>)[field] ?? "").trim(); const nxt = String(value).trim(); if (cur === nxt || (cur !== "" && nxt !== "" && Number.isFinite(Number(cur)) && Number(cur) === Number(nxt))) delete payload[field]; } if (Object.keys(payload).length === 0 && skippedFields.length === 0) {
        continue; // nothing mapped had a value on this row
      }
      if (Object.keys(payload).length === 0) {
        rowsSkipped++;
        rowsMatched--;
        const hash = createHash("sha256").update(`sheet:${connectionId}:${runId}:${i}`).digest("hex").slice(0, 16);
        await adminTable(admin, "job_activity").insert({
          org_id: connection.org_id,
          job_id: job.id,
          user_id: null,
          activity_type: "system",
          message: `[Sheet Agent] No valid values on row ${i + mappingVersion.header_row + 1}. Skipped: ${skippedFields.join(", ")}. Source: ${connection.display_name}. Ref: ${hash}.`,
        });
        continue;
      }

      const { error: updateError } = await adminTable(admin, "jobs")
        .update(payload)
        .eq("id", job.id)
        .eq("org_id", connection.org_id);
      if (updateError) {
        rowsErrored++;
        continue;
      }

      const hash = createHash("sha256").update(`sheet:${connectionId}:${runId}:${i}`).digest("hex").slice(0, 16);
      const setLines = Object.entries(payload)
        .map(([field, value]) => `${field} to ${value}`)
        .join("; ");
      const skipNote = skippedFields.length ? ` Skipped: ${skippedFields.join(", ")}.` : "";
      const message = `Set ${setLines}.${skipNote}`;
      await adminTable(admin, "job_activity").insert({
        org_id: connection.org_id,
        job_id: job.id,
        user_id: null,
        activity_type: "system",
        message: `[Sheet Agent] ${message} Source: ${connection.display_name}, row ${i + mappingVersion.header_row + 1}. Ref: ${hash}.`,
      });
      await notify({
        orgId: connection.org_id,
        jobId: job.id,
        permitTech: job.permit_tech,
        source: "sheet_agent",
        message,
      });
      rowsUpdated++;
    } catch {
      rowsErrored++;
    }
  }

  await adminTable(admin, "sheet_connections")
    .update({ status: "active", last_error: null, last_synced_at: new Date().toISOString() })
    .eq("id", connectionId);

  const status: SyncRunResult["status"] = rowsErrored > 0 ? "partial_error" : "success";
  return finish(status, { rowsRead: rows.length, rowsMatched, rowsUpdated, rowsSkipped, rowsErrored });
}
