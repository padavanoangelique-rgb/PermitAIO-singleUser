"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg, requireUser } from "@/lib/data/orgs";
import { libraryEntryProblems } from "@/lib/chat/answer-rules";
import { runKnowledgeChecks } from "@/lib/chat/knowledge-checks";
import { snapshotLibraryEntry } from "@/lib/libraries/versions";

function table(supabase: Awaited<ReturnType<typeof createClient>>, name: string) {
  return (supabase as unknown as { from: (t: string) => any }).from(name);
}

export type ProposalKind = "research_report" | "library_correction" | "weekly_self_update";

export async function insertProposal(input: {
  orgId: string;
  userId: string | null;
  authorLabel: string;
  library: string;
  kind: ProposalKind;
  why: string;
  proposed: Record<string, unknown>;
  previous?: Record<string, unknown> | null;
  entryId?: string | null;
}) {
  const supabase = await createClient();
  const { error } = await table(supabase, "proposed_updates").insert({
    org_id: input.orgId,
    library: input.library,
    entry_id: input.entryId ?? null,
    kind: input.kind,
    proposed: input.proposed,
    previous: input.previous ?? null,
    why: input.why,
    author_id: input.userId,
    author_label: input.authorLabel,
    status: "pending",
  });
  return { error: error?.message ?? null };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function str(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function publishResearch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  userId: string,
  authorLabel: string,
  proposed: Record<string, unknown>,
) {
  const body = str(proposed.body);
  if (!body) return "The report has no body, so it was not added.";
  const agent = proposed.agent === "forms_specialist" ? "forms_specialist" : "investigator";
  const title = str(proposed.title) || (agent === "investigator" ? "Investigator report" : "Forms report");
  const { data, error } = await table(supabase, "research_reports")
    .insert({
      org_id: orgId,
      agent,
      county: str(proposed.county) || null,
      jurisdiction: str(proposed.jurisdiction) || null,
      title,
      body,
      created_by: userId,
    })
    .select("id")
    .maybeSingle();
  if (error) return error.message;
  const id = data?.id as string | undefined;
  if (id) {
    await snapshotLibraryEntry(supabase, {
      orgId,
      library: "research_reports",
      entryId: id,
      version: 1,
      snapshot: { agent, title, body, county: str(proposed.county) || null, jurisdiction: str(proposed.jurisdiction) || null },
      changeNote: "Added from review.",
      authorId: userId,
      authorLabel,
    });
  }
  return null;
}

async function publishCorrection(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  userId: string,
  authorLabel: string,
  proposed: Record<string, unknown>,
  entryId: string | null,
) {
  const action = str(proposed.action) || "create";
  const problems = libraryEntryProblems({
    jurisdiction: str(proposed.jurisdiction),
    correction: str(proposed.correction),
    resolution: str(proposed.resolution),
    job_number: str(proposed.job_number),
    scope: str(proposed.scope) || "job",
    approval_ground_truth: str(proposed.approval_ground_truth),
  });
  if (action !== "retire" && problems.length) return problems.join(" ");

  if (action === "retire" && entryId) {
    const { error } = await table(supabase, "corrections_library")
      .update({ status: "retired", updated_at: new Date().toISOString() })
      .eq("org_id", orgId)
      .eq("id", entryId);
    return error?.message ?? null;
  }

  const row = {
    jurisdiction: str(proposed.jurisdiction) || null,
    correction: str(proposed.correction),
    resolution: str(proposed.resolution) || null,
    job_number: str(proposed.job_number) || null,
    job_id: str(proposed.job_id) || null,
    cross_ref: str(proposed.cross_ref) || null,
    original_submission: str(proposed.original_submission) || null,
    approval_ground_truth: str(proposed.approval_ground_truth) || null,
    scope: str(proposed.scope) === "jurisdiction" ? "jurisdiction" : "job",
    status: "published",
    author_label: authorLabel,
    updated_at: new Date().toISOString(),
  };

  if ((action === "update" || action === "restore" || action === "republish") && entryId) {
    const { data: current } = await table(supabase, "corrections_library")
      .select("version")
      .eq("org_id", orgId)
      .eq("id", entryId)
      .maybeSingle();
    const version = Number(current?.version ?? 1) + 1;
    const { error } = await table(supabase, "corrections_library")
      .update({ ...row, version })
      .eq("org_id", orgId)
      .eq("id", entryId);
    if (error) return error.message;
    await snapshotLibraryEntry(supabase, {
      orgId,
      library: "corrections",
      entryId,
      version,
      snapshot: row,
      changeNote: action,
      authorId: userId,
      authorLabel,
    });
    return null;
  }

  const { data, error } = await table(supabase, "corrections_library")
    .insert({ ...row, org_id: orgId, version: 1, created_by: userId })
    .select("id")
    .maybeSingle();
  if (error) return error.message;
  const id = data?.id as string | undefined;
  if (id) {
    await snapshotLibraryEntry(supabase, {
      orgId,
      library: "corrections",
      entryId: id,
      version: 1,
      snapshot: row,
      changeNote: "Added from review.",
      authorId: userId,
      authorLabel,
    });
  }
  return null;
}

export async function proposeLibraryCorrection(formData: FormData) {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();
  const jobNumber = String(formData.get("jobNumber") ?? "").trim() || null;
  let jobId: string | null = null;
  let jurisdiction = String(formData.get("jurisdiction") ?? "").trim() || null;
  if (jobNumber) {
    const { data } = await supabase
      .from("jobs")
      .select("id, jurisdiction")
      .eq("org_id", activeOrg.id)
      .eq("job_number", jobNumber)
      .maybeSingle();
    if (data) {
      jobId = data.id;
      jurisdiction = jurisdiction || data.jurisdiction;
    }
  }
  const correction = String(formData.get("correction") ?? "").trim();
  if (!correction) return { error: "Write what the correction is." };
  const entryId = String(formData.get("entryId") ?? "").trim() || null;
  const result = await insertProposal({
    orgId: activeOrg.id,
    userId: user.id,
    authorLabel: user.email || "teammate",
    library: "corrections",
    kind: "library_correction",
    entryId,
    why: String(formData.get("why") ?? "").trim() || "Library correction submitted for review.",
    proposed: {
      action: String(formData.get("action") ?? "create") || "create",
      scope: String(formData.get("scope") ?? "job") === "jurisdiction" ? "jurisdiction" : "job",
      jurisdiction,
      correction,
      resolution: String(formData.get("resolution") ?? "").trim() || null,
      job_number: jobNumber,
      job_id: jobId,
      cross_ref: String(formData.get("crossRef") ?? "").trim() || null,
      original_submission: String(formData.get("originalSubmission") ?? "").trim() || null,
      approval_ground_truth: String(formData.get("approvalGroundTruth") ?? "").trim() || null,
    },
  });
  if (result.error) return { error: result.error };
  revalidatePath("/libraries");
  return { error: null, message: "Submitted for review. It is not in the library until someone adds it." };
}

export async function decideProposedUpdate(id: string, decision: "added" | "skipped") {
  const user = await requireUser();
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();
  const { data: row } = await table(supabase, "proposed_updates")
    .select("id, org_id, library, entry_id, kind, proposed, status, author_label")
    .eq("id", id)
    .eq("org_id", activeOrg.id)
    .maybeSingle();
  if (!row) return { error: "That update is not in this company." };
  if (row.status !== "pending") return { error: "That update was already decided." };

  if (decision === "added") {
    const checks = runKnowledgeChecks();
    if (checks.length) {
      return { error: `Knowledge checks failed, so this was not added. ${checks[0].detail}` };
    }
    const proposed = asRecord(row.proposed);
    const author = row.author_label || user.email || "teammate";
    const publishError =
      row.kind === "research_report"
        ? await publishResearch(supabase, activeOrg.id, user.id, author, proposed)
        : row.kind === "library_correction" || row.kind === "weekly_self_update"
          ? await publishCorrection(supabase, activeOrg.id, user.id, author, proposed, row.entry_id)
          : "Unknown update.";
    if (publishError) return { error: publishError };
  }

  const { error } = await table(supabase, "proposed_updates")
    .update({
      status: decision,
      decided_by: user.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", activeOrg.id);
  if (error) return { error: error.message };

  revalidatePath("/libraries");
  return { error: null, message: decision === "added" ? "Added to the database." : "Skipped." };
}
