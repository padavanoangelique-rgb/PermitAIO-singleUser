"use server";

import { requireUser, requireActiveOrg } from "@/lib/data/orgs";
import { csvRecords } from "@/lib/inventory/csv";
import { runDataAgent, type DataAgentInstruction } from "@/lib/agents/data-agent/engine";

export interface DataAgentUploadResult {
  ok: boolean;
  error?: string;
  inserted?: number;
  updated?: number;
  skipped?: number;
  skippedReasons?: string[];
}

/**
 * Server-side entry point for the manager-facing spreadsheet upload — the
 * same csv-upload-form.tsx dialog used in the Permit Inventory board, now
 * routed through the shared Data Agent engine instead of writing to
 * Supabase directly from the browser, so it gets job_activity logging,
 * notifications, and real per-org stage validation for the first time.
 */
export async function runDataAgentUpload(
  instruction: DataAgentInstruction,
  permitTech: string,
  csvText: string,
): Promise<DataAgentUploadResult> {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();

  const rows = csvRecords(csvText);
  if (rows.length === 0) {
    return { ok: false, error: "No rows found — check the file has a header row plus data." };
  }
  const anyJobNumber = rows.some((row) => (row["job_number"] || row["job #"] || row["job#"] || row.job || "").trim());
  if (!anyJobNumber) {
    return {
      ok: false,
      error: `Couldn't find a job number column. Your file's columns are: ${Object.keys(rows[0]).join(", ")}. Rename the job number column to "job_number" and try again.`,
    };
  }

  const result = await runDataAgent({
    orgId: activeOrg.id,
    userId: user.id,
    instruction,
    permitTech,
    rows,
    meta: { source: "data_agent", label: "manual upload", tag: "Data Agent" },
  });

  return { ok: true, ...result };
}
