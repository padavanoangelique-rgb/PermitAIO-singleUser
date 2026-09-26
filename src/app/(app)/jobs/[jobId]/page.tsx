import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg, requireUser, canManageOrg } from "@/lib/data/orgs";
import { getJobTasks } from "@/lib/job-tasks/data";
import { listTeammates } from "@/lib/notifications/compose-actions";
import { JobTabs } from "./job-tabs";
import { Badge } from "@/components/ui/badge";
import { tradeBadgeClass, tradeLabel } from "@/lib/jobs/trade";
import { Dynamics365SyncButton } from "@/components/jobs/dynamics365-sync-button";
import { currency } from "@/lib/inventory/constants";
import { JobShareCard } from "@/components/sales/job-share-card";
import { ensureHomeownerLink, homeownerUrl } from "@/lib/sales/link";
import { contractorStampForOrg } from "@/lib/sales/brand";
import { hoaPlain, HOMEOWNER_STAGES, hoaEtaLabel, permitEtaLabel, stageIndexFromJob } from "@/lib/sales/friendly-status";

export default async function JobPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ mail?: string }>;
}) {
  const { jobId } = await params;
  const { mail } = await searchParams;
  const user = await requireUser();
  const { activeOrg, role } = await requireActiveOrg();
  const supabase = await createClient();

const { data: job } = await supabase
  .from("jobs")
  .select("*")
  .eq("id", jobId)
  .eq("org_id", activeOrg.id)
  .maybeSingle();

if (!job) notFound();

const { data: activity } = await supabase
  .from("job_activity")
  .select("*")
  .eq("job_id", jobId)
  .order("created_at", { ascending: false });

const tasks = await getJobTasks(jobId);
  const teammates = await listTeammates({ includeSelf: true });

let dynamics365Connected = false;
  if (canManageOrg(role)) {
    try {
      const raw = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              eq: (
                col: string,
                val: string,
                ) => { maybeSingle: () => Promise<{ data: { status: string } | null }> };
            };
          };
        };
      };
      const { data } = await raw
      .from("crm_connections")
      .select("status")
      .eq("org_id", activeOrg.id)
      .eq("provider", "dynamics365")
      .maybeSingle();
      dynamics365Connected = data?.status === "active";
    } catch {
      dynamics365Connected = false;
    }
  }

const jobWithSync = job as typeof job & {
  sync_status: string | null;
  external_job_url: string | null;
};

const { data: hoa } = await supabase
  .from("hoa_jobs")
  .select("status, date_submitted, date_approved, assigned_to, assigned_date, hoas(name)")
  .eq("org_id", activeOrg.id)
  .eq("job_id", job.id)
  .maybeSingle();
  const hoaRow = hoa as (typeof hoa & { hoas?: { name: string } | null }) | null;
  const idx = stageIndexFromJob(job.sub_status, job.stage);
  const permitTitle = HOMEOWNER_STAGES[idx].title;
  const hoaCopy = hoaPlain(hoaRow?.status, !!hoaRow);
  const permitEta = permitEtaLabel(job.submitted_date, /approved|complete/i.test(job.sub_status ?? ""));
  const hoaEta = hoaEtaLabel(hoaRow?.date_submitted ?? null, hoaCopy.approved, !!hoaRow);
  const stamp = await contractorStampForOrg(supabase, activeOrg.id);
  let trackUrl: string | null = null;
  try {
    trackUrl = homeownerUrl(await ensureHomeownerLink(activeOrg.id, job.id));
  } catch {
    trackUrl = null;
  }

const address = [job.address, job.city].filter(Boolean).join(", ");

return (
  <div className="space-y-6">
  <header className="flex flex-wrap items-start justify-between gap-3">
  <div className="min-w-0">
  <p className="font-mono text-xs text-muted-foreground">{job.job_number}</p>
  <h1 className="mt-1 font-heading text-3xl tracking-tight">{job.client_name}</h1>
  <p className="mt-1 text-sm text-muted-foreground">{address || "No address"}</p>
  <div className="mt-2 flex flex-wrap items-center gap-2">
  <Badge variant="outline" className={tradeBadgeClass(job.trade_type)}>
    {tradeLabel(job.trade_type)}
  </Badge>
  <Badge variant="secondary">{job.stage}</Badge>
  <span className="text-sm font-medium text-primary">
    {job.contract_value != null ? currency(job.contract_value) : "Contract —"}
  </span>
  </div>
  </div>
    {dynamics365Connected && (
    <Dynamics365SyncButton
      jobId={job.id}
      initialSyncStatus={jobWithSync.sync_status}
      initialExternalJobUrl={jobWithSync.external_job_url}
      />
    )}
  </header>
  
  <JobTabs
    job={job}
    activity={activity ?? []}
    tasks={tasks}
    teammates={teammates}
    currentUserId={user.id}
    orgName={activeOrg.name}
    shareCard={
      <JobShareCard
        jobId={job.id}
        jobNumber={job.job_number}
        clientName={job.client_name}
        address={address}
        trackUrl={trackUrl}
        permitTitle={permitTitle}
        permitEta={permitEta}
        hoaTitle={hoaCopy.title}
        hoaEta={hoaEta}
        mail={mail}
        returnTo={`/jobs/${job.id}`}
        contractorName={stamp.name}
        />
    }
    hoaSummary={{
      community: hoaRow?.hoas?.name ?? null,
      status: hoaRow?.status ?? null,
      submitted: hoaRow?.date_submitted ?? null,
      approved: hoaRow?.date_approved ?? null,
      assignedTo: job.hoa_tech || hoaRow?.assigned_to || null,
      assigned: hoaRow?.assigned_date ?? null,
    }}
    />
  </div>
  );
}
