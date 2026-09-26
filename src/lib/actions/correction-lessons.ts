"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg } from "@/lib/data/orgs";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./auth";
import { insertProposal } from "./proposed-updates";

function table(supabase: Awaited<ReturnType<typeof createClient>>, name: string) {
  return (supabase as unknown as { from: (t: string) => any }).from(name);
}

export async function feedCorrectionLesson(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();

  const jobId = String(formData.get("jobId") ?? "").trim() || null;
  const jobNumber = String(formData.get("jobNumber") ?? "").trim() || null;
  const jurisdiction = String(formData.get("jurisdiction") ?? "").trim() || null;
  const trade = String(formData.get("trade") ?? "").trim() || null;
  let asked = String(formData.get("asked") ?? "").trim();
  const cleared = String(formData.get("cleared") ?? "").trim() || null;
  const letter = formData.get("letter");
  const file = letter instanceof File && letter.size > 0 ? letter : null;

  if (!asked && !file) return { error: "Paste what the city asked, or attach the letter." };

  let resolvedJobId = jobId;
  let resolvedNumber = jobNumber;
  let resolvedCity = jurisdiction;
  let resolvedTrade = trade;

  if (!resolvedJobId && jobNumber) {
    const { data } = await supabase
      .from("jobs")
      .select("id, job_number, jurisdiction, trade_type")
      .eq("org_id", activeOrg.id)
      .eq("job_number", jobNumber)
      .maybeSingle();
    if (data) {
      resolvedJobId = data.id;
      resolvedNumber = data.job_number;
      resolvedCity = resolvedCity || data.jurisdiction;
      resolvedTrade = resolvedTrade || data.trade_type;
    }
  } else if (resolvedJobId) {
    const { data } = await supabase
      .from("jobs")
      .select("id, job_number, jurisdiction, trade_type")
      .eq("org_id", activeOrg.id)
      .eq("id", resolvedJobId)
      .maybeSingle();
    if (data) {
      resolvedNumber = resolvedNumber || data.job_number;
      resolvedCity = resolvedCity || data.jurisdiction;
      resolvedTrade = resolvedTrade || data.trade_type;
    }
  }

  if (file && !asked) asked = `Correction letter on file: ${file.name}`;

  let fileName: string | null = null;
  let storagePath: string | null = null;
  if (file) {
    if (!resolvedJobId) {
      return { error: "Add a job number to attach the letter." };
    }
    const safe = file.name.replace(/[^\w.\-]/g, "_");
    storagePath = `${resolvedJobId}/correction-${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage.from("job-files").upload(storagePath, file);
    if (upErr) return { error: upErr.message };
    fileName = file.name;
    await supabase.from("job_files").insert({
      org_id: activeOrg.id,
      job_id: resolvedJobId,
      file_name: file.name,
      storage_path: storagePath,
      size_bytes: file.size,
      uploaded_by: user.id,
      category: "correction",
    });
  }

  if (resolvedJobId) {
    await supabase.from("job_activity").insert({
      org_id: activeOrg.id,
      job_id: resolvedJobId,
      user_id: user.id,
      activity_type: "note",
      message: `[Correction] ${resolvedCity || "city unknown"} · Job ${resolvedNumber || "—"}. Asked: ${asked.slice(0, 180)}.${cleared ? ` Cleared: ${cleared.slice(0, 180)}.` : ""}`,
    });
  }

  const scope = String(formData.get("jurisdictionLesson") ?? "") === "yes" ? "jurisdiction" : "job";
  const proposal = {
    action: "create",
    scope,
    jurisdiction: resolvedCity,
    correction: asked,
    resolution: cleared,
    job_number: resolvedNumber,
    job_id: resolvedJobId,
    cross_ref: null,
    original_submission: fileName ? `Letter on file: ${fileName}` : null,
    approval_ground_truth: null,
  };
  const proposed = await insertProposal({
    orgId: activeOrg.id,
    userId: user.id,
    authorLabel: user.email || "teammate",
    library: "corrections",
    kind: "library_correction",
    why: "Submitted from the corrections desk. The note is already on the job. The library copy waits for review.",
    proposed: proposal,
  });

  if (proposed.error) {
    const row = {
      org_id: activeOrg.id,
      job_id: resolvedJobId,
      job_number: resolvedNumber,
      jurisdiction: resolvedCity,
      trade: resolvedTrade,
      asked,
      cleared,
      file_name: fileName,
      storage_path: storagePath,
      created_by: user.id,
    };
    const { error } = await table(supabase, "permit_correction_lessons").insert(row);
    if (error && !resolvedJobId) {
      return { error: "Could not save the lesson. Open the job and feed it from there." };
    }
    revalidatePath("/inventory");
    return { error: null, message: "Saved on the job. The review queue is not live yet, so this copy is on file now." };
  }

  revalidatePath("/libraries");
  revalidatePath("/inventory");
  return {
    error: null,
    message: `Note is on the job. The library copy is waiting for Add to database${resolvedCity ? ` (${resolvedCity})` : ""}.`,
  };
}

export async function rememberFromChat(opts: {
  asked: string;
  cleared?: string | null;
  jobNumber?: string | null;
  jurisdiction?: string | null;
}): Promise<{ ok: boolean; message: string }> {
  const fd = new FormData();
  fd.set("asked", opts.asked);
  if (opts.cleared) fd.set("cleared", opts.cleared);
  if (opts.jobNumber) fd.set("jobNumber", opts.jobNumber);
  if (opts.jurisdiction) fd.set("jurisdiction", opts.jurisdiction);
  const result = await feedCorrectionLesson(fd);
  if (result.error) return { ok: false, message: result.error };
  return { ok: true, message: result.message ?? "Saved as a city lesson." };
}
