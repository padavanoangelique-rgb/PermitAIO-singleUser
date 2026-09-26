import { createClient } from "@/lib/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/types";

export type JobFee = Tables<"job_fees">;
export type JobFeeInsert = TablesInsert<"job_fees">;
export type JobFeeUpdate = TablesUpdate<"job_fees">;

const RECEIPT_BUCKET = "job-fee-receipts";
export const RECEIPT_ACCEPT = "application/pdf,image/jpeg,image/png,image/heic";

export function safeReceiptName(name: string): string {
  return name.replace(/[^\w.\- ]/g, "_");
}

/** Fetches every fee line item recorded for a single job, newest first. */
export async function fetchJobFees(jobId: string): Promise<JobFee[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("job_fees")
    .select("*")
    .eq("job_id", jobId)
    .order("paid_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Fetches every fee line item across the org that has a receipt on file and
 * falls inside [startIso, endIso] (inclusive), for the daily/weekly
 * cross-job accounting report. Joins in job_number/client_name/permit_tech
 * so the report doesn't need a second round trip per job.
 */
export async function fetchOrgFeesInRange(
  orgId: string,
  startIso: string,
  endIso: string,
): Promise<(JobFee & { job_number: string; client_name: string; permit_tech: string })[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("job_fees")
    .select("*, jobs!inner(job_number, client_name, permit_tech)")
    .eq("org_id", orgId)
    .gte("paid_date", startIso)
    .lte("paid_date", endIso)
    .order("paid_date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const { jobs, ...fee } = row as JobFee & {
      jobs: { job_number: string; client_name: string; permit_tech: string };
    };
    return { ...fee, job_number: jobs.job_number, client_name: jobs.client_name, permit_tech: jobs.permit_tech };
  });
}

/**
 * Fetches every fee line item across the org that has ever been recorded,
 * regardless of date — for the "all-time" cross-job accounting report.
 * Same job join as fetchOrgFeesInRange, just without the date filter.
 */
export async function fetchOrgFeesAll(
  orgId: string,
): Promise<(JobFee & { job_number: string; client_name: string; permit_tech: string })[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("job_fees")
    .select("*, jobs!inner(job_number, client_name, permit_tech)")
    .eq("org_id", orgId)
    .order("paid_date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const { jobs, ...fee } = row as JobFee & {
      jobs: { job_number: string; client_name: string; permit_tech: string };
    };
    return { ...fee, job_number: jobs.job_number, client_name: jobs.client_name, permit_tech: jobs.permit_tech };
  });
}

export async function createJobFee(
  fee: JobFeeInsert,
  receiptFile: File | null,
): Promise<JobFee> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  let receiptFields: Partial<JobFeeInsert> = {};
  if (receiptFile) {
    const path = `${fee.job_id}/${Date.now()}-${safeReceiptName(receiptFile.name)}`;
    const { error: uploadError } = await supabase.storage.from(RECEIPT_BUCKET).upload(path, receiptFile);
    if (uploadError) throw new Error(`Couldn't upload receipt: ${uploadError.message}`);
    receiptFields = {
      receipt_storage_path: path,
      receipt_file_name: receiptFile.name,
      receipt_mime_type: receiptFile.type || null,
      receipt_size_bytes: receiptFile.size,
    };
  }
  const { data, error } = await supabase
    .from("job_fees")
    .insert({ ...fee, ...receiptFields, created_by: auth.user?.id ?? null })
    .select("*")
    .single();
  if (error) {
    if (receiptFields.receipt_storage_path) {
      await supabase.storage.from(RECEIPT_BUCKET).remove([receiptFields.receipt_storage_path]);
    }
    throw new Error(`Couldn't save that fee: ${error.message}`);
  }
  return data;
}

export async function updateJobFee(id: string, orgId: string, patch: JobFeeUpdate): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("job_fees").update(patch).eq("id", id).eq("org_id", orgId);
  if (error) throw new Error(`Couldn't save that change: ${error.message}`);
}

export async function deleteJobFee(fee: JobFee): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("job_fees").delete().eq("id", fee.id).eq("org_id", fee.org_id);
  if (error) throw new Error(`Couldn't delete that fee: ${error.message}`);
  if (fee.receipt_storage_path) {
    await supabase.storage.from(RECEIPT_BUCKET).remove([fee.receipt_storage_path]);
  }
}

/** Downloads a receipt's raw bytes (for embedding into a report PDF). */
export async function downloadReceiptBytes(storagePath: string): Promise<Uint8Array> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(RECEIPT_BUCKET).download(storagePath);
  if (error || !data) throw new Error(`Couldn't fetch receipt: ${error?.message ?? "unknown error"}`);
  return new Uint8Array(await data.arrayBuffer());
}

/** Opens a receipt in a new tab via a short-lived signed URL. */
export async function openReceipt(storagePath: string): Promise<void> {
  // Open the tab synchronously (before the async signed-URL fetch) so this
  // still counts as a direct user gesture in browsers that block window.open
  // calls made after an await (notably Safari).
  const popup = window.open("", "_blank");
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(storagePath, 60);
  if (error || !data) {
    popup?.close();
    throw new Error(`Couldn't open receipt: ${error?.message ?? "unknown error"}`);
  }
  if (popup) popup.location.href = data.signedUrl;
  else window.open(data.signedUrl, "_blank");
}
