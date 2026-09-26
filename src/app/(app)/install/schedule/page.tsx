import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg } from "@/lib/data/orgs";
import { isPlatformAdmin } from "@/lib/data/platform-admin";
import { isCompanyInstallAdmin } from "@/lib/data/install-access";
import { hoaIsApproved, permitIsApproved } from "@/lib/warehouse/permit";
import type { InstallAssignment, InstallMember } from "../install-dashboard";
import { ScheduleBoard, type ScheduleRow } from "./schedule-board";

export default async function InstallSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ mail?: string }>;
}) {
  const user = await requireUser();
  const { activeOrg, role } = await requireActiveOrg();
  const admin = await isPlatformAdmin();
  const companyAdmin = isCompanyInstallAdmin(user.email, role);
  const orgManager = role === "owner" || role === "admin" || role === "manager";
  const supabase = await createClient();
  const params = await searchParams;

  let members: InstallMember[] = [];
  let assignments: InstallAssignment[] = [];
  let readyRows: { job_id: string; ready_for_schedule_at: string }[] = [];

  try {
    const db = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => { eq: (a: string, b: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }> };
      };
    };
    const roster = await db
      .from("install_members")
      .select("id, email, role, user_id, display_name, company_name")
      .eq("org_id", activeOrg.id);
    members = (roster.data ?? []) as InstallMember[];
    const asg = await db
      .from("install_job_assignments")
      .select("job_id, job_number, installer_id, pm_id, account_manager_id, scheduled_date")
      .eq("org_id", activeOrg.id);
    assignments = (asg.data ?? []) as InstallAssignment[];
    const ready = await db.from("warehouse_jobs").select("job_id, ready_for_schedule_at").eq("org_id", activeOrg.id);
    readyRows = ((ready.data ?? []) as { job_id: string; ready_for_schedule_at: string | null }[])
      .filter((r) => r.ready_for_schedule_at)
      .map((r) => ({ job_id: r.job_id, ready_for_schedule_at: r.ready_for_schedule_at as string }));
  } catch {
    readyRows = [];
  }

  const myEmail = (user.email ?? "").toLowerCase();
  const myInstallRoles = members.filter((m) => m.email.toLowerCase() === myEmail || m.user_id === user.id);
  const canSee =
    orgManager ||
    companyAdmin ||
    admin ||
    myInstallRoles.some((m) => m.role === "install_manager" || m.role === "account_manager");

  if (!canSee) {
    return (
      <p className="text-sm text-muted-foreground">This list is for the install manager.</p>
    );
  }

  const ids = readyRows.map((r) => r.job_id);
  const checkedAt = new Map(readyRows.map((r) => [r.job_id, r.ready_for_schedule_at]));
  const assignmentByJob = new Map(assignments.map((a) => [a.job_id, a]));

  let jobs: {
    id: string;
    job_number: string;
    client_name: string;
    address: string | null;
    city: string | null;
    permit_number: string | null;
    sub_status: string | null;
  }[] = [];
  let hoaByJob = new Map<string, string>();

  if (ids.length) {
    const { data } = await supabase
      .from("jobs")
      .select("id, job_number, client_name, address, city, permit_number, sub_status")
      .eq("org_id", activeOrg.id)
      .in("id", ids);
    jobs = (data ?? []) as typeof jobs;
    const { data: hoa } = await supabase
      .from("hoa_jobs")
      .select("job_id, status")
      .eq("org_id", activeOrg.id)
      .in("job_id", ids);
    for (const row of hoa ?? []) {
      if (row.job_id) hoaByJob.set(row.job_id, row.status ?? "");
    }
  }

  const rows: ScheduleRow[] = jobs
    .map((job) => {
      const hoaStatus = hoaByJob.get(job.id) ?? "";
      const a = assignmentByJob.get(job.id);
      return {
        id: job.id,
        job_number: job.job_number,
        client_name: job.client_name,
        address: job.address,
        city: job.city,
        permit_number: job.permit_number,
        sub_status: job.sub_status ?? "",
        permitApproved: permitIsApproved(job.sub_status),
        hoaStatus,
        hoaApproved: hoaIsApproved(hoaStatus || null),
        checkedInAt: checkedAt.get(job.id) ?? "",
        installerId: a?.installer_id ?? null,
        pmId: a?.pm_id ?? null,
        accountManagerId: a?.account_manager_id ?? null,
        scheduledDate: a?.scheduled_date ?? null,
      };
    })
    .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt));

  const ready = rows.filter((r) => r.permitApproved && r.hoaApproved && !r.scheduledDate);
  const waiting = rows.filter((r) => !(r.permitApproved && r.hoaApproved));

  return (
    <div className="space-y-4">
      {params.mail ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-lime-400 dark:bg-transparent dark:text-lime-300">
          {params.mail}
        </p>
      ) : null}
      <ScheduleBoard
        ready={ready}
        waiting={waiting}
        pms={members.filter((m) => m.role === "project_manager")}
        installers={members.filter((m) => m.role === "installer")}
        accountManagers={members.filter((m) => m.role === "account_manager")}
        members={members}
      />
    </div>
  );
}
