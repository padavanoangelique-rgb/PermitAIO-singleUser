import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAllTechNames } from "@/lib/data/tech-names";
import { displayNameOnly } from "@/lib/tech-labels";
import { hoaPlain, HOMEOWNER_STAGES, hoaEtaLabel, hoaStageIndex, permitEtaLabel, stageIndexFromJob } from "@/lib/sales/friendly-status";
import { ensureHomeownerLink, homeownerUrl } from "@/lib/sales/link";
import { contractorStampForOrg, stampFields } from "@/lib/sales/brand";
import type { StatusPayload } from "@/components/sales/status-view";

export type JobStatusLookup = {
  notFound: boolean;
  status: StatusPayload | null;
  jobId: string | null;
  trackUrl: string | null;
  tableNote: string;
};

/**
 * The permit/HOA status lookup Sales already used (job-number search, exact
 * then fuzzy prefix match) — pulled out so Install can reuse the exact same
 * search and StatusView instead of getting the full Permit Inventory board.
 */
export async function lookupJobStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  orgId: string,
  jobNumber: string,
): Promise<JobStatusLookup> {
  const lookup = jobNumber.trim();
  if (!lookup) {
    return { notFound: false, status: null, jobId: null, trackUrl: null, tableNote: "" };
  }

  const exact = await supabase
    .from("jobs")
    .select("id, job_number, client_name, address, city, permit_number, sub_status, stage, permit_tech, hoa_tech, assigned_date, submitted_date, approved_date, ordered_date, material_eta")
    .eq("org_id", orgId)
    .eq("job_number", lookup)
    .maybeSingle();
  let job = exact.data;
  if (!job) {
    const fuzzy = await supabase
      .from("jobs")
      .select("id, job_number, client_name, address, city, permit_number, sub_status, stage, permit_tech, hoa_tech, assigned_date, submitted_date, approved_date, ordered_date, material_eta")
      .eq("org_id", orgId)
      .ilike("job_number", `${lookup}%`)
      .limit(1)
      .maybeSingle();
    job = fuzzy.data;
  }
  if (!job) {
    return { notFound: true, status: null, jobId: null, trackUrl: null, tableNote: "" };
  }

  const jobId = job.id;
  const names = await getAllTechNames(orgId);
  const { data: hoa } = await supabase
    .from("hoa_jobs")
    .select("status, assigned_to, assigned_date, date_submitted, date_approved")
    .eq("org_id", orgId)
    .eq("job_id", job.id)
    .maybeSingle();
  const idx = stageIndexFromJob(job.sub_status, job.stage);
  const stage = HOMEOWNER_STAGES[idx];
  const hoaCopy = hoaPlain(hoa?.status, !!hoa);
  const stamp = await contractorStampForOrg(supabase, orgId);
  const status: StatusPayload = {
    jobNumber: job.job_number,
    clientName: job.client_name,
    address: [job.address, job.city].filter(Boolean).join(", "),
    permitNumber: job.permit_number,
    permitTitle: stage.title,
    permitDescription: stage.description,
    permitNext: stage.next,
    stageIndex: idx,
    permitAssigned: job.assigned_date,
    permitSubmitted: job.submitted_date,
    permitApproved: job.approved_date,
    permitTech: displayNameOnly(job.permit_tech, names.permit),
    hoaTitle: hoaCopy.title,
    hoaDetail: hoaCopy.detail,
    hoaAssigned: hoa?.assigned_date ?? null,
    hoaSubmitted: hoa?.date_submitted ?? null,
    hoaApproved: hoa?.date_approved ?? null,
    hoaTech: displayNameOnly(job.hoa_tech || hoa?.assigned_to || "", names.hoa),
    orderedDate: job.ordered_date,
    materialEta: job.material_eta,
    permitEta: permitEtaLabel(job.submitted_date, /approved|complete/i.test(job.sub_status ?? "")),
    hoaEta: hoaEtaLabel(hoa?.date_submitted ?? null, hoaCopy.approved, !!hoa),
    hoaStageIndex: hoaStageIndex(hoa?.status, !!hoa),
    ...stampFields(stamp),
  };

  let trackUrl: string | null = null;
  let tableNote = "";
  try {
    const token = await ensureHomeownerLink(orgId, job.id);
    trackUrl = homeownerUrl(token);
  } catch (err) {
    tableNote = err instanceof Error ? err.message : "Run supabase/37_homeowner_links.sql so the customer link can be created.";
  }

  return { notFound: false, status, jobId, trackUrl, tableNote };
}
