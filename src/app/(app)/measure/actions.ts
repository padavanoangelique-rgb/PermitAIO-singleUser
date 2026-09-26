"use server";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg, requireUser } from "@/lib/data/orgs";
import type { LookupResult, MeasurePayload } from "@/lib/measure/integration";
import type { Plan } from "@/lib/measure/types";

function asPlan(data: unknown, jobNumber: string, address: string): Plan | null {
  if (!data || typeof data !== "object") return null;
  const plan = data as Plan;
  if (!Array.isArray(plan.walls)) return null;
  return {
    ...plan,
    jobNumber: plan.jobNumber || jobNumber,
    address: plan.address || address,
  };
}

async function findJob(orgId: string, jobNumber: string) {
  const supabase = await createClient();
  const n = jobNumber.trim();
  const exact = await supabase
    .from("jobs")
    .select("id, job_number, address, city, client_name")
    .eq("org_id", orgId)
    .eq("job_number", n)
    .maybeSingle();
  if (exact.data) return exact.data;
  const fuzzy = await supabase
    .from("jobs")
    .select("id, job_number, address, city, client_name")
    .eq("org_id", orgId)
    .ilike("job_number", `${n}%`)
    .limit(1)
    .maybeSingle();
  return fuzzy.data;
}

function jobAddress(job: { address: string | null; city: string | null; client_name: string | null }) {
  return [job.address, job.city].filter(Boolean).join(", ") || job.client_name || "";
}

export async function listMeasureJobs(): Promise<{ jobNumber: string; address: string }[]> {
  await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select("job_number, address, city, client_name")
    .eq("org_id", activeOrg.id)
    .order("created_at", { ascending: false })
    .limit(40);
  return (data ?? []).map((j) => ({
    jobNumber: j.job_number,
    address: jobAddress(j),
  }));
}

export async function lookupMeasureJob(jobNumber: string): Promise<LookupResult> {
  await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const n = jobNumber.trim();
  if (!n) return { found: false, jobNumber: n, address: "", plan: null };
  const job = await findJob(activeOrg.id, n);
  if (!job) return { found: false, jobNumber: n, address: "", plan: null };
  const address = jobAddress(job);
  const base = {
    found: true as const,
    jobNumber: job.job_number,
    address,
    jobId: job.id,
    clientName: job.client_name ?? "",
  };
  const supabase = await createClient();
  const db = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (a: string, b: string) => {
          eq: (c: string, d: string) => {
            maybeSingle: () => Promise<{ data: { plan_data: unknown } | null; error: { message: string } | null }>;
          };
        };
      };
      upsert: (
        row: Record<string, unknown>,
        opts: { onConflict: string },
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
  try {
    const saved = await db
      .from("job_measures")
      .select("plan_data")
      .eq("org_id", activeOrg.id)
      .eq("job_id", job.id)
      .maybeSingle();
    return {
      ...base,
      plan: asPlan(saved.data?.plan_data, job.job_number, address),
    };
  } catch {
    return { ...base, plan: null };
  }
}

async function upsertMeasure(payload: MeasurePayload, submitted: boolean) {
  await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const job = await findJob(activeOrg.id, payload.jobNumber);
  if (!job) throw new Error("No job with that number in this company.");
  const supabase = await createClient();
  const db = supabase as unknown as {
    from: (t: string) => {
      upsert: (
        row: Record<string, unknown>,
        opts: { onConflict: string },
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
  const row = {
    org_id: activeOrg.id,
    job_id: job.id,
    job_number: job.job_number,
    plan_data: payload,
    schedule: payload.schedule,
    submitted_at: submitted ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from("job_measures").upsert(row, { onConflict: "org_id,job_id" });
  if (error) throw new Error(error.message);
}

export async function saveMeasureAction(payload: MeasurePayload) {
  await upsertMeasure(payload, false);
}

export async function submitMeasureAction(payload: MeasurePayload) {
  await upsertMeasure(payload, true);
}

export type MeasureFile = {
  id: string;
  file_name: string;
  storage_path: string;
  uploaded_at: string;
};

export async function listMeasureFiles(jobId: string): Promise<MeasureFile[]> {
  await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_files")
    .select("id, file_name, storage_path, uploaded_at")
    .eq("org_id", activeOrg.id)
    .eq("job_id", jobId)
    .eq("category", "measure")
    .order("uploaded_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as MeasureFile[];
}

export async function deleteMeasureFile(fileId: string, storagePath: string) {
  await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();
  await supabase.storage.from("job-files").remove([storagePath]);
  await supabase.from("job_files").delete().eq("id", fileId).eq("org_id", activeOrg.id);
}

