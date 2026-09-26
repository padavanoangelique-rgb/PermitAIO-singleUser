import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveOrg } from "@/lib/data/orgs";
import { isPlatformAdmin } from "@/lib/data/platform-admin";
import { isCompanyInstallAdmin } from "@/lib/data/install-access";
import { PrintButton } from "@/components/print-button";
import { InvoiceDownloadButton } from "./invoice-download-button";
import { APP_GRID, CELL, JOB_BTN, NAME_PILL, PILL } from "@/lib/ui/chrome";
import { FILL_GREEN, FILL_PURPLE } from "@/lib/ui/fills";

type InstallMemberRow = { id: string; email: string; role: string; user_id: string | null; display_name: string | null };
type AssignmentRow = {
  job_id: string;
  installer_id: string | null;
  account_manager_id: string | null;
  deposit_collected: boolean | null;
  change_order: boolean | null;
  contract_signed: boolean | null;
  final_payment_collected: boolean | null;
};
type JobRow = { id: string; job_number: string; client_name: string };
type FileRow = { id: string; job_id: string; file_name: string; storage_path: string; uploaded_at: string; size_bytes: number | null; category: string };

const CATEGORY_LABEL: Record<string, string> = {
  installer_invoice: "Invoice",
  material_receipt: "Material receipt",
};

function MoneyChip({ done, label }: { done: boolean | null; label: string }) {
  return (
    <span className={`${PILL} ${done ? FILL_GREEN : "bg-muted text-muted-foreground"}`}>
      {label}
    </span>
  );
}

export default async function InstallInvoicesPage() {
  const user = await requireUser();
  const { activeOrg, role } = await requireActiveOrg();
  const admin = await isPlatformAdmin();
  const companyAdmin = isCompanyInstallAdmin(user.email, role);
  const orgManager = role === "owner" || role === "admin" || role === "manager";
  const supabase = await createClient();

  const db = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => { eq: (a: string, b: string) => { in?: (a: string, b: string[]) => Promise<{ data: unknown[] | null; error: { message: string } | null }> } & Promise<{ data: unknown[] | null; error: { message: string } | null }> };
    };
  };

  const rosterRes = await db.from("install_members").select("id, email, role, user_id, display_name").eq("org_id", activeOrg.id);
  const members = (rosterRes.data ?? []) as InstallMemberRow[];
  const myEmail = (user.email ?? "").toLowerCase();
  const myRoles = members.filter((m) => m.email.toLowerCase() === myEmail || m.user_id === user.id);
  const isManager = orgManager || companyAdmin || admin || myRoles.some((m) => m.role === "install_manager");
  const myAccountManagerIds = new Set(myRoles.filter((m) => m.role === "account_manager").map((m) => m.id));
  const canView = isManager || myAccountManagerIds.size > 0;

  if (!canView) {
    return <p className="text-sm text-muted-foreground">This report is for install managers and account managers.</p>;
  }

  const assignmentsRes = await db
    .from("install_job_assignments")
    .select("job_id, installer_id, account_manager_id, deposit_collected, change_order, contract_signed, final_payment_collected")
    .eq("org_id", activeOrg.id);
  const assignments = (assignmentsRes.data ?? []) as AssignmentRow[];

  const visibleJobIds = isManager
    ? new Set(assignments.map((a) => a.job_id))
    : new Set(assignments.filter((a) => a.account_manager_id && myAccountManagerIds.has(a.account_manager_id)).map((a) => a.job_id));

  const { data: fileRows } = await supabase
    .from("job_files")
    .select("id, job_id, file_name, storage_path, uploaded_at, size_bytes, category")
    .eq("org_id", activeOrg.id)
    .in("category", ["installer_invoice", "material_receipt"])
    .order("uploaded_at", { ascending: false });
  const files = ((fileRows ?? []) as FileRow[]).filter((f) => visibleJobIds.has(f.job_id));

  const jobIds = [...visibleJobIds];
  let jobs: JobRow[] = [];
  if (jobIds.length) {
    const { data: jobRows } = await supabase
      .from("jobs")
      .select("id, job_number, client_name")
      .eq("org_id", activeOrg.id)
      .in("id", jobIds);
    jobs = (jobRows ?? []) as JobRow[];
  }
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const assignmentByJob = new Map(assignments.map((a) => [a.job_id, a]));
  const memberById = new Map(members.map((m) => [m.id, m]));

  function installerName(jobId: string) {
    const a = assignmentByJob.get(jobId);
    const m = a?.installer_id ? memberById.get(a.installer_id) : undefined;
    return m?.display_name?.trim() || m?.email || "Unassigned";
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Accounting</p>
          <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight">Invoices & receipts</h1>
          <p className="text-sm text-muted-foreground">
            {isManager ? "Every invoice and material receipt installers have uploaded, plus payment status." : "Invoices, receipts, and payment status for jobs assigned to you."}
          </p>
        </div>
        <PrintButton />
      </div>

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payment status</h2>
        {jobs.length === 0 ? (
          <p className="px-2 py-6 text-sm text-muted-foreground">No jobs on the board yet.</p>
        ) : (
          <div className="space-y-0.5">
            {jobs.map((job) => {
              const a = assignmentByJob.get(job.id);
              return (
                <article key={job.id} className="space-y-1.5 rounded-xl px-2 py-1.5">
                  <div className={APP_GRID}>
                    <span />
                    <span className={JOB_BTN}>{job.job_number}</span>
                    <span className={`${NAME_PILL}`}>{job.client_name}</span>
                    <span className={`${CELL} hidden sm:block`}>{installerName(job.id)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 px-8">
                    <MoneyChip done={a?.deposit_collected ?? false} label="Deposit" />
                    <MoneyChip done={a?.change_order ?? false} label="Change order" />
                    <MoneyChip done={a?.contract_signed ?? false} label="Signed" />
                    <MoneyChip done={a?.final_payment_collected ?? false} label="Final payment" />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Files</h2>
        {files.length === 0 ? (
          <p className="px-2 py-6 text-sm text-muted-foreground">No invoices or receipts uploaded yet.</p>
        ) : (
          <div className="space-y-0.5">
            {files.map((f) => {
              const job = jobById.get(f.job_id);
              return (
                <article key={f.id} className={`${APP_GRID} rounded-xl px-2 py-1.5`}>
                  <span />
                  <span className={JOB_BTN}>{job?.job_number ?? "—"}</span>
                  <span className={`${NAME_PILL}`}>{f.file_name}</span>
                  <span className={`${CELL} hidden sm:flex items-center gap-2`}>
                    <span className={`${PILL} ${f.category === "installer_invoice" ? FILL_PURPLE : FILL_GREEN}`}>
                      {CATEGORY_LABEL[f.category] ?? f.category}
                    </span>
                    <InvoiceDownloadButton storagePath={f.storage_path} fileName={f.file_name} />
                  </span>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
