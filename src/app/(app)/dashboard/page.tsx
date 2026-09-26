import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg, canAssignJobs, requireUser } from "@/lib/data/orgs";
import { DashboardActions } from "@/components/jobs/dashboard-actions"; import { AgentInbox } from "@/components/jobs/agent-inbox";
import { MasterStatusReport } from "@/components/jobs/master-status-report";
import { type JobRow, type ViewerKind } from "@/components/jobs/jobs-table";
import { type JobsKpis } from "@/components/jobs/jobs-kpi-strip";
import { type AgingJob } from "@/components/jobs/aging-alerts";
import { DashboardScopeView } from "@/components/jobs/dashboard-scope-view";
import { type TechBreakdownRow, type AmBreakdownRow } from "@/components/jobs/team-status-panel";
import { type FieldOverviewData } from "@/components/jobs/field-overview";
import { materialEtaIsSoon } from "@/lib/inventory/eta";
import { permitTechSlots } from "@/lib/inventory/constants";
import { hoaTechSlots, NO_HOA_TECH } from "@/lib/hoa/constants";
import { hoaIsApproved, permitIsApproved } from "@/lib/warehouse/permit";

const ARCHIVED_STATUS = "Complete";
const AM_SLOTS = ["Account manager 1", "Account manager 2", "Account manager 3"];

type HoaInfo = {
  hoa_job_id: string;
  status: string | null;
  hoa_name: string | null;
  updated_at: string | null;
  assigned_to: string | null;
};

type JobForDashboard = {
  id: string;
  job_number: string;
  client_name: string;
  trade_type: string | null;
  address: string | null;
  city: string | null;
  stage: string;
  sub_status: string;
  permit_tech: string;
  hoa_tech: string | null;
  permit_number: string | null;
  jurisdiction: string | null;
  contract_value: number | null;
  assigned_date: string | null;
  submitted_date: string | null;
  approved_date: string | null;
  ordered_date: string | null;
  material_eta: string | null;
  created_at: string;
  updated_at: string;
};

function buildDashboardData(
  jobsSubset: JobForDashboard[],
  hoaByJobId: Map<string, HoaInfo>,
  statusKind: "permit" | "hoa",
): { rows: JobRow[]; kpis: JobsKpis; agingJobs: AgingJob[] } {
  const rows: JobRow[] = jobsSubset.map((job) => {
    const hoaInfo = hoaByJobId.get(job.id);
    return {
      id: job.id,
      job_number: job.job_number,
      client_name: job.client_name,
      city: job.city,
      trade_type: job.trade_type,
      jurisdiction: job.jurisdiction,
      stage: job.stage,
      sub_status: job.sub_status,
      permit_number: job.permit_number,
      permit_updated_at: job.updated_at,
      permit_tech: job.permit_tech,
      hoa_tech: job.hoa_tech ?? null,
      contract_value: job.contract_value,
      ordered_date: job.ordered_date,
      material_eta: job.material_eta,
      hoa_job_id: hoaInfo?.hoa_job_id ?? null,
      hoa_name: hoaInfo?.hoa_name ?? null,
      hoa_status: hoaInfo?.status ?? null,
      hoa_updated_at: hoaInfo?.updated_at ?? null,
      hoa_assigned_to: hoaInfo?.assigned_to ?? null,
      account_manager_id: null,
      agentTouched: false,
    };
  });

  const statusOf = (job: JobForDashboard) =>
    statusKind === "hoa" ? (hoaByJobId.get(job.id)?.status ?? null) : job.sub_status;

  const kpis: JobsKpis = {
    totalActive: jobsSubset.length,
    needToSubmit: jobsSubset.filter((j) => statusOf(j) === "Need to Submit").length,
    inReview: jobsSubset.filter((j) => statusOf(j) === "In Review").length,
    approved: jobsSubset.filter((j) => {
      const status = statusOf(j);
      return status === "Approved" || status === "Approved and Printed";
    }).length,
    agingCount: 0,
  };

  const attentionJobs: AgingJob[] = [];
  kpis.agingCount = 0;

  return { rows, kpis, agingJobs: attentionJobs };
}

function buildTechBreakdown(
  techs: readonly string[],
  entries: { tech: string | null; status: string | null }[],
): TechBreakdownRow[] {
  return techs.map((tech) => {
    const mine = entries.filter((e) => (e.tech ?? "") === tech);
    return {
      tech,
      total: mine.length,
      needToSubmit: mine.filter((e) => e.status === "Need to Submit").length,
      inReview: mine.filter((e) => e.status === "In Review").length,
      approved: mine.filter((e) => e.status === "Approved" || e.status === "Approved and Printed").length,
    };
  });
}

function resolveViewerKind(
  canAssign: boolean,
  permitTechLabel: string | null,
  hoaTechLabel: string | null,
): ViewerKind {
  if (canAssign) return "manager";
  if (permitTechLabel && hoaTechLabel) return "both";
  if (hoaTechLabel) return "hoa";
  if (permitTechLabel) return "permit";
  return "member";
}

const SUBTITLE: Record<ViewerKind, string> = {
  manager: "Open jobs, installs by account manager, and what's ready to schedule.",
  permit: "Your permit jobs. Permit Builder tools and the floor plan live on the job number.",
  hoa: "Your HOA jobs. Same Permit Builder tools and floor plan as the permit tech — one plan per job.",
  both: "Your jobs. One floor plan per job. Permit and HOA share Forms, Floor Plans, and Package.",
  member: "Set which tech you are in Settings to see your queue.",
};

function emptyAm(name: string, id: string): AmBreakdownRow {
  return { id, name, total: 0, scheduled: 0, inProgress: 0, pendingFinal: 0 };
}

function amName(member: { display_name?: string | null; email: string }, index: number) {
  const name = member.display_name?.trim();
  if (name) return name;
  const local = member.email.split("@")[0]?.trim();
  if (local) return local;
  return AM_SLOTS[index] ?? `Account manager ${index + 1}`;
}

function amLane(
  stage: string | null | undefined,
  assignment: { scheduled_date: string | null; inspection_date: string | null; inspection_status: string | null },
): "scheduled" | "inProgress" | "final" | "other" {
  const s = stage ?? "";
  if (s === "Needs Final Inspection" || s === "Scheduled Final Inspection") return "final";
  if (s === "Install Started" || s === "In Progress") return "inProgress";
  if (s === "Scheduled for Install") return "scheduled";
  if (assignment.inspection_date || assignment.inspection_status === "scheduled") return "final";
  if (assignment.scheduled_date) return "scheduled";
  return "other";
}

export default async function DashboardPage() {
  const user = await requireUser();
  const { activeOrg, role, permitTechLabel, hoaTechLabel } = await requireActiveOrg();
  const supabase = await createClient();
  const canAssign = canAssignJobs(role);
  const viewerKind = resolveViewerKind(canAssign, permitTechLabel, hoaTechLabel);
  const statusKind: "permit" | "hoa" = viewerKind === "hoa" ? "hoa" : "permit";

  const jobsSelectWithHoaTech =
    "id, job_number, client_name, trade_type, address, city, stage, sub_status, permit_tech, hoa_tech, permit_number, jurisdiction, contract_value, assigned_date, submitted_date, approved_date, ordered_date, material_eta, created_at, updated_at";
  const jobsSelectWithHoaTechNoDates =
    "id, job_number, client_name, trade_type, address, city, stage, sub_status, permit_tech, hoa_tech, permit_number, jurisdiction, contract_value, assigned_date, submitted_date, approved_date, created_at, updated_at";
  const jobsSelect =
    "id, job_number, client_name, trade_type, address, city, stage, sub_status, permit_tech, permit_number, jurisdiction, contract_value, assigned_date, submitted_date, approved_date, created_at, updated_at";

  let [{ data: jobs }, { data: hoaJobsRaw }] = await Promise.all([
    supabase.from("jobs").select(jobsSelectWithHoaTech).eq("org_id", activeOrg.id).order("created_at", { ascending: false }),
    supabase.from("hoa_jobs").select("*, hoas(name)").eq("org_id", activeOrg.id),
  ]);
  if (!jobs) {
    const retryDates = await supabase
      .from("jobs")
      .select(jobsSelectWithHoaTechNoDates)
      .eq("org_id", activeOrg.id)
      .order("created_at", { ascending: false });
    if (retryDates.data) {
      jobs = retryDates.data.map((row) => ({ ...row, ordered_date: null, material_eta: null }));
    } else {
      const retry = await supabase
        .from("jobs")
        .select(jobsSelect)
        .eq("org_id", activeOrg.id)
        .order("created_at", { ascending: false });
      jobs = (retry.data ?? []).map((row) => ({ ...row, hoa_tech: "", ordered_date: null, material_eta: null }));
    }
  }

  const hoaByJobId = new Map<string, HoaInfo>();
  const tradeByJobId = new Map<string, string | null>();
  for (const job of jobs ?? []) tradeByJobId.set(job.id, job.trade_type);

  const hoaJobs = (hoaJobsRaw ?? []).map((row) => {
    const { hoas, ...rest } = row as typeof row & { hoas: { name: string } | null };
    return {
      ...rest,
      hoa_name: hoas?.name ?? null,
      trade_type: rest.job_id ? tradeByJobId.get(rest.job_id) ?? null : null,
    };
  });
  for (const hj of hoaJobs) {
    if (hj.job_id)
      hoaByJobId.set(hj.job_id, {
        hoa_job_id: hj.id,
        status: hj.status,
        hoa_name: hj.hoa_name,
        updated_at: hj.updated_at,
        assigned_to: hj.assigned_to,
      });
  }

  const allJobs: JobForDashboard[] = (jobs ?? []).map((job) => ({
    ...job,
    city: job.city ?? null,
  }));
  const activeJobs = allJobs.filter((j) => j.sub_status !== ARCHIVED_STATUS);

  function isMine(job: JobForDashboard): boolean {
    if (viewerKind === "permit") return Boolean(permitTechLabel && job.permit_tech === permitTechLabel);
    if (viewerKind === "hoa") {
      if (hoaTechLabel && job.hoa_tech === hoaTechLabel) return true;
      return Boolean(hoaTechLabel && hoaByJobId.get(job.id)?.assigned_to === hoaTechLabel);
    }
    if (viewerKind === "both") {
      if (permitTechLabel && job.permit_tech === permitTechLabel) return true;
      if (hoaTechLabel && job.hoa_tech === hoaTechLabel) return true;
      if (hoaTechLabel && hoaByJobId.get(job.id)?.assigned_to === hoaTechLabel) return true;
    }
    return false;
  }

  const hasMyIdentity = Boolean(permitTechLabel || hoaTechLabel);

  const allData = buildDashboardData(activeJobs, hoaByJobId, statusKind);
  const mineData = buildDashboardData(activeJobs.filter(isMine), hoaByJobId, statusKind);
  const data = viewerKind === "manager" ? allData : mineData;

  const permitTechBreakdown = buildTechBreakdown(
    permitTechSlots(activeOrg.permit_tech_seats),
    activeJobs.map((j) => ({ tech: j.permit_tech, status: j.sub_status })),
  );
  const hoaTechBreakdown = buildTechBreakdown(
    hoaTechSlots(activeOrg.hoa_tech_seats),
    activeJobs.map((j) => ({
      tech: j.hoa_tech || hoaByJobId.get(j.id)?.assigned_to || null,
      status: hoaByJobId.get(j.id)?.status ?? (j.hoa_tech === NO_HOA_TECH ? "Complete" : null),
    })),
  );

  const incoming = activeJobs
    .filter((j) => materialEtaIsSoon(j.material_eta))
    .sort((a, b) => (a.material_eta ?? "").localeCompare(b.material_eta ?? ""))
    .map((j) => ({
      id: j.id,
      jobNumber: j.job_number,
      client: j.client_name,
      tech: j.permit_tech || "Unassigned",
      eta: j.material_eta as string,
    }));

  let field: FieldOverviewData = { ready: [], incoming };
  let accountManagers: AmBreakdownRow[] = AM_SLOTS.map((name, i) => emptyAm(name, `slot-${i}`));
  if (canAssign) {
    try {
      const db = supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (a: string, b: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
          };
        };
      };
      const ready = await db.from("warehouse_jobs").select("job_id, ready_for_schedule_at").eq("org_id", activeOrg.id);
      const asg = await db
        .from("install_job_assignments")
        .select("job_id, installer_id, pm_id, account_manager_id, scheduled_date, inspection_date, inspection_status")
        .eq("org_id", activeOrg.id);
      const roster = await db
        .from("install_members")
        .select("id, email, role, display_name")
        .eq("org_id", activeOrg.id);
      const warehouseReady = new Set(
        ((ready.data ?? []) as { job_id: string; ready_for_schedule_at: string | null }[])
          .filter((r) => r.ready_for_schedule_at)
          .map((r) => r.job_id),
      );
      const assignments = (asg.data ?? []) as {
        job_id: string;
        installer_id: string | null;
        pm_id: string | null;
        account_manager_id: string | null;
        scheduled_date: string | null;
        inspection_date: string | null;
        inspection_status: string | null;
      }[];
      const members = ((roster.data ?? []) as {
        id: string;
        email: string;
        role: string;
        display_name: string | null;
      }[]).filter((m) => m.role === "account_manager");
      const assignmentByJob = new Map(assignments.map((a) => [a.job_id, a]));
      const jobById = new Map(activeJobs.map((j) => [j.id, j]));
      for (const row of allData.rows) {
        row.account_manager_id = assignmentByJob.get(row.id)?.account_manager_id ?? null;
      }
      for (const row of mineData.rows) {
        row.account_manager_id = assignmentByJob.get(row.id)?.account_manager_id ?? null;
      }
      for (const job of activeJobs) {
        const a = assignmentByJob.get(job.id);
        const hoaStatus = hoaByJobId.get(job.id)?.status ?? null;
        if (
          warehouseReady.has(job.id) &&
          permitIsApproved(job.sub_status) &&
          hoaIsApproved(hoaStatus) &&
          !a?.installer_id
        ) {
          field.ready.push({
            id: job.id,
            jobNumber: job.job_number,
            client: job.client_name,
            tech: job.permit_tech || "Unassigned",
          });
        }
      }
      const statsFor = (
        memberId: string,
      ): Pick<AmBreakdownRow, "total" | "scheduled" | "inProgress" | "pendingFinal"> => {
        const mine = assignments.filter((a) => a.account_manager_id === memberId);
        let scheduled = 0;
        let inProgress = 0;
        let pendingFinal = 0;
        for (const a of mine) {
          const lane = amLane(jobById.get(a.job_id)?.stage, a);
          if (lane === "scheduled") scheduled += 1;
          else if (lane === "inProgress") inProgress += 1;
          else if (lane === "final") pendingFinal += 1;
        }
        return { total: mine.length, scheduled, inProgress, pendingFinal };
      };
      const named = members.map((m, i) => ({
        id: m.id,
        name: amName(m, i),
        ...statsFor(m.id),
      }));
      while (named.length < 3) {
        const i = named.length;
        named.push(emptyAm(AM_SLOTS[i] ?? `Account manager ${i + 1}`, `slot-${i}`));
      }
      accountManagers = named;
    } catch {
      field = { ready: [], incoming };
      accountManagers = AM_SLOTS.map((name, i) => emptyAm(name, `slot-${i}`));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Command center</p>
          <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{SUBTITLE[viewerKind]}</p>
        </div>
        <DashboardActions orgId={activeOrg.id} userId={user.id} />
      </div>

      <AgentInbox orgId={activeOrg.id} userId={user.id} isManager={canAssign} permitTechLabel={permitTechLabel} hoaTechLabel={hoaTechLabel} permitTechSlots={permitTechSlots(activeOrg.permit_tech_seats)} hoaTechSlots={hoaTechSlots(activeOrg.hoa_tech_seats)} /> <DashboardScopeView
        data={data}
        allJobsCount={allJobs.length}
        hasMyIdentity={hasMyIdentity}
        canAssign={canAssign}
        viewerKind={viewerKind}
        field={canAssign ? field : undefined}
        permitTechs={permitTechBreakdown}
        hoaTechs={hoaTechBreakdown}
        accountManagers={canAssign ? accountManagers : undefined}
      />

      <MasterStatusReport jobs={allJobs} hoaJobs={hoaJobs} orgName={activeOrg.name} />
    </div>
  );
}
