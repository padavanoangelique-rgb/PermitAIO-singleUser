import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg } from "@/lib/data/orgs";
import { isPlatformAdmin } from "@/lib/data/platform-admin";
import { isCompanyInstallAdmin } from "@/lib/data/install-access";
import { InstallDashboard, type InstallAssignment, type InstallJob, type InstallMember } from "./install-dashboard";
import { PmApp } from "./pm-app";
import { AccountManagerApp } from "./account-manager-app";
import { InstallerApp } from "./installer-app";
import { RolePicker } from "./role-picker";

export default async function InstallPage({
  searchParams,
}: {
  searchParams: Promise<{ mail?: string; app?: string }>;
}) {
  const user = await requireUser();
  const { activeOrg, role } = await requireActiveOrg();
  const admin = await isPlatformAdmin();
  const supabase = await createClient();
  const params = await searchParams;
  const companyAdmin = isCompanyInstallAdmin(user.email, role);
  const orgManager = role === "owner" || role === "admin" || role === "manager";

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, job_number, client_name, address, city, trade_type, permit_number, contract_value")
    .eq("org_id", activeOrg.id)
    .order("created_at", { ascending: false });

  let installMembers: InstallMember[] = [];
  let assignments: InstallAssignment[] = [];
  let tableNote = "";
  let warehouseReadyIds: string[] = [];
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
    const withMoney = await db
      .from("install_job_assignments")
      .select(
        "job_id, job_number, installer_id, pm_id, account_manager_id, inspection_status, inspection_result, inspection_date, pm_checked_at, pm_checked_by, permit_checked_out_at, permit_checked_out_by, scheduled_date, deposit_collected, deposit_amount, deposit_date, change_order, contract_signed, final_payment_collected, final_payment_amount, final_payment_date",
      )
      .eq("org_id", activeOrg.id);
    const withCheckout = withMoney.error
      ? await db
          .from("install_job_assignments")
          .select(
            "job_id, job_number, installer_id, pm_id, account_manager_id, inspection_status, inspection_result, inspection_date, pm_checked_at, pm_checked_by, permit_checked_out_at, permit_checked_out_by, scheduled_date",
          )
          .eq("org_id", activeOrg.id)
      : withMoney;
    const withAm = withCheckout.error
      ? await db
          .from("install_job_assignments")
          .select(
            "job_id, job_number, installer_id, pm_id, account_manager_id, inspection_status, inspection_result, inspection_date, pm_checked_at, pm_checked_by",
          )
          .eq("org_id", activeOrg.id)
      : withCheckout;
    const asg = withAm.error
      ? await db
          .from("install_job_assignments")
          .select("job_id, job_number, installer_id, pm_id, inspection_status, inspection_result, inspection_date, pm_checked_at, pm_checked_by")
          .eq("org_id", activeOrg.id)
      : withAm;
    if (roster.error || asg.error) {
      tableNote = (roster.error ?? asg.error)?.message ?? "";
    } else {
      installMembers = (roster.data ?? []) as InstallMember[];
      assignments = (asg.data ?? []) as InstallAssignment[];
    }
    const ready = await db.from("warehouse_jobs").select("job_id, ready_for_schedule_at").eq("org_id", activeOrg.id);
    if (!ready.error) {
      warehouseReadyIds = ((ready.data ?? []) as { job_id: string; ready_for_schedule_at: string | null }[])
        .filter((r) => r.ready_for_schedule_at)
        .map((r) => r.job_id);
    }
  } catch (err) {
    tableNote = err instanceof Error ? err.message : "Install tables not ready.";
  }

  const myEmail = (user.email ?? "").toLowerCase();
  const myInstallRoles = installMembers.filter((m) => m.email.toLowerCase() === myEmail || m.user_id === user.id);

  const catalog = (jobs ?? []) as InstallJob[];
  const onBoard = new Set(assignments.map((a) => a.job_id));
  const boardJobs = catalog.filter((j) => onBoard.has(j.id));
  const addable = catalog.filter((job) => !onBoard.has(job.id));
  const assignmentByJob = new Map(assignments.map((a) => [a.job_id, a]));

  const photoCountByJob: Record<string, number> = {};
  const permitOnFileIds: string[] = [];
  try {
    const files = await supabase.from("job_files").select("job_id, category").eq("org_id", activeOrg.id);
    const permitSet = new Set<string>();
    for (const file of files.data ?? []) {
      if (!onBoard.has(file.job_id)) continue;
      if (file.category === "install-photo") {
        photoCountByJob[file.job_id] = (photoCountByJob[file.job_id] ?? 0) + 1;
      }
      if (file.category === "permit_printed" || file.category === "permit-inventory") {
        permitSet.add(file.job_id);
      }
    }
    permitOnFileIds.push(...permitSet);
  } catch {
    /* job_files may not exist yet */
  }

  const canManagerView = orgManager || companyAdmin || admin || myInstallRoles.some((m) => m.role === "install_manager");
  const canAccountManagerView = myInstallRoles.some((m) => m.role === "account_manager");
  const canPmView = myInstallRoles.some((m) => m.role === "project_manager");
  const canInstallerView = myInstallRoles.some((m) => m.role === "installer");

  const available: { key: string; label: string }[] = [];
  if (canManagerView) available.push({ key: "manager", label: "Install manager" });
  if (canAccountManagerView) available.push({ key: "account_manager", label: "Account manager" });
  if (canPmView) available.push({ key: "pm", label: "Project manager" });
  if (canInstallerView) available.push({ key: "installer", label: "Installer" });

  const requestedApp = params.app ?? "";
  let appKey: string;
  if (requestedApp && available.some((a) => a.key === requestedApp)) {
    appKey = requestedApp;
  } else if (available.length <= 1) {
    appKey = available[0]?.key ?? "installer";
  } else {
    appKey = "";
  }

  if (appKey === "") {
    return <RolePicker options={available} mail={params.mail} />;
  }

  const myTitle =
    appKey === "manager"
      ? "Install manager"
      : appKey === "account_manager"
        ? "Account manager"
        : appKey === "pm"
          ? "Project manager"
          : "Installer";

  const myPmIds = new Set(myInstallRoles.filter((m) => m.role === "project_manager").map((m) => m.id));
  const myAccountManagerIds = new Set(myInstallRoles.filter((m) => m.role === "account_manager").map((m) => m.id));
  const myInstallerIds = new Set(myInstallRoles.filter((m) => m.role === "installer").map((m) => m.id));

  if (appKey === "pm") {
    const pmJobs = boardJobs.filter((job) => {
      const a = assignmentByJob.get(job.id);
      return a?.pm_id ? myPmIds.has(a.pm_id) : false;
    });
    return (
      <PmApp
        jobs={pmJobs}
        assignments={assignments.filter((a) => (a.pm_id ? myPmIds.has(a.pm_id) : false))}
        mail={params.mail}
        pmName={user.email ?? "Project manager"}
      />
    );
  }

  if (appKey === "account_manager") {
    const amJobs = boardJobs.filter((job) => {
      const a = assignmentByJob.get(job.id);
      return a?.account_manager_id ? myAccountManagerIds.has(a.account_manager_id) : false;
    });
    return (
      <AccountManagerApp
        jobs={amJobs}
        assignments={assignments.filter((a) => (a.account_manager_id ? myAccountManagerIds.has(a.account_manager_id) : false))}
        pms={installMembers.filter((m) => m.role === "project_manager")}
        installers={installMembers.filter((m) => m.role === "installer")}
        mail={params.mail}
        accountManagerName={user.email ?? "Account manager"}
      />
    );
  }

  if (appKey === "manager") {
    return (
      <InstallDashboard
        jobs={boardJobs}
        assignments={assignments}
        members={installMembers}
        addable={addable}
        mail={params.mail}
        tableNote={tableNote}
        myTitle={myTitle}
        signedInName={user.email ?? myTitle}
        orgName={activeOrg.name}
        showMoney
        canManage
        canCheck
        warehouseReadyIds={warehouseReadyIds}
        orgId={activeOrg.id}
        photoCountByJob={photoCountByJob}
        permitOnFileIds={permitOnFileIds}
      />
    );
  }

  const installerJobs = boardJobs.filter((job) => {
    const a = assignmentByJob.get(job.id);
    return a?.installer_id ? myInstallerIds.has(a.installer_id) : false;
  });

  return (
    <InstallerApp
      jobs={installerJobs}
      mail={params.mail}
      installerName={user.email ?? "Installer"}
      orgId={activeOrg.id}
    />
  );
}
