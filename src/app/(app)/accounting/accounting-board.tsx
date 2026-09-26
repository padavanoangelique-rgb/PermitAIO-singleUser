"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchOrgFeesAll, openReceipt, type JobFee } from "@/lib/inventory/fees";
import { FeeReceiptsReportButton } from "@/components/inventory/fee-receipts-report-button";
import { displayNameOnly, type TechNameMap } from "@/lib/tech-labels";
import {
  APP_GRID,
  BTN_BLUE,
  CELL,
  FIELD,
  JOB_BTN,
  LOOKUP,
  NAME_PILL,
  PILL,
  TAP_BLUE,
  TAP_GREEN,
} from "@/lib/ui/chrome";
import { FILL_AMBER, FILL_BLUE, FILL_GREEN, FILL_PURPLE } from "@/lib/ui/fills";

type LedgerRow = JobFee & { job_number: string; client_name: string; permit_tech: string };

type InstallFile = {
  id: string;
  job_id: string;
  file_name: string;
  storage_path: string;
  uploaded_at: string;
  category: string;
  job_number: string;
  client_name: string;
};

type Tab = "ledger" | "receipts";

function money(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortDate(iso: string): string {
  const [y, m, d] = (iso ?? "").slice(0, 10).split("-");
  if (!y || !m || !d) return "—";
  return `${Number(m)}/${Number(d)}`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const LEDGER_GRID =
  "grid w-full grid-cols-[1.25rem_5.75rem_minmax(6.5rem,1.1fr)_minmax(5.5rem,.8fr)_5.5rem_4.75rem_minmax(5rem,.7fr)_5.75rem] items-center gap-x-1.5";

export function AccountingBoard({
  orgId,
  orgName,
  techNames,
}: {
  orgId: string;
  orgName: string;
  techNames: TechNameMap;
}) {
  const [tab, setTab] = useState<Tab>("ledger");
  const [fees, setFees] = useState<LedgerRow[]>([]);
  const [files, setFiles] = useState<InstallFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [feeRows, fileRes, jobRes] = await Promise.all([
      fetchOrgFeesAll(orgId),
      supabase
        .from("job_files")
        .select("id, job_id, file_name, storage_path, uploaded_at, category")
        .eq("org_id", orgId)
        .in("category", ["installer_invoice", "material_receipt"])
        .order("uploaded_at", { ascending: false }),
      supabase.from("jobs").select("id, job_number, client_name").eq("org_id", orgId),
    ]);
    const jobs = new Map((jobRes.data ?? []).map((j) => [j.id, j]));
    setFees(feeRows);
    setFiles(
      ((fileRes.data ?? []) as Omit<InstallFile, "job_number" | "client_name">[]).map((f) => {
        const job = jobs.get(f.job_id);
        return {
          ...f,
          job_number: job?.job_number ?? "—",
          client_name: job?.client_name ?? "",
        };
      }),
    );
    setUpdatedAt(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 20000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    return fees.filter((row) => {
      if (fromDate && row.paid_date < fromDate) return false;
      if (toDate && row.paid_date > toDate) return false;
      if (!q) return true;
      return [row.job_number, row.client_name, row.category, row.jurisdiction, row.notes, row.permit_tech]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [fees, fromDate, toDate, q]);

  const chronological = useMemo(
    () => [...filtered].sort((a, b) => a.paid_date.localeCompare(b.paid_date) || a.created_at.localeCompare(b.created_at)),
    [filtered],
  );
  const running = useMemo(() => {
    const map = new Map<string, number>();
    let total = 0;
    for (const row of chronological) {
      total += Number(row.amount) || 0;
      map.set(row.id, total);
    }
    return map;
  }, [chronological]);
  const newestFirst = useMemo(() => [...chronological].reverse(), [chronological]);
  const withReceipt = useMemo(() => newestFirst.filter((r) => r.receipt_storage_path), [newestFirst]);
  const totalPaid = chronological.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const missing = filtered.filter((r) => !r.receipt_storage_path).length;

  async function openInstallFile(path: string) {
    const popup = window.open("", "_blank");
    const supabase = createClient();
    const { data, error } = await supabase.storage.from("job-files").createSignedUrl(path, 60);
    if (error || !data) {
      popup?.close();
      alert(error?.message ?? "Couldn't open that file.");
      return;
    }
    if (popup) popup.location.href = data.signedUrl;
    else window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{orgName}</p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Accounting</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Ledger of every fee receipt as it is entered. Refreshing live
            {updatedAt ? ` · ${updatedAt}` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FeeReceiptsReportButton orgId={orgId} orgName={orgName} techNames={techNames} />
          <button type="button" className={TAP_BLUE} onClick={() => void load()}>
            Refresh
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <Kpi label="Fees" value={String(filtered.length)} />
        <Kpi label="Total paid" value={money(totalPaid)} tone={FILL_GREEN} />
        <Kpi label="Receipts on file" value={String(withReceipt.length)} tone={FILL_PURPLE} />
        <Kpi label="Missing receipt" value={String(missing)} tone={missing ? FILL_AMBER : undefined} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={`${PILL} ${tab === "ledger" ? FILL_PURPLE : "bg-muted text-muted-foreground"}`} onClick={() => setTab("ledger")}>
          Ledger
        </button>
        <button type="button" className={`${PILL} ${tab === "receipts" ? FILL_BLUE : "bg-muted text-muted-foreground"}`} onClick={() => setTab("receipts")}>
          Receipts
        </button>
      </div>

      <form className={LOOKUP} onSubmit={(e) => e.preventDefault()}>
        <label className="text-xs">
          Search
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Job, client, category…" className={`${FIELD} min-w-[16rem]`} />
        </label>
        <label className="text-xs">
          From
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={FIELD} />
        </label>
        <label className="text-xs">
          To
          <input type="date" value={toDate} max={todayIso()} onChange={(e) => setToDate(e.target.value)} className={FIELD} />
        </label>
        {fromDate || toDate ? (
          <button type="button" className={BTN_BLUE} onClick={() => { setFromDate(""); setToDate(""); }}>
            Clear dates
          </button>
        ) : null}
      </form>

      {loading ? (
        <p className="px-2 py-8 text-sm text-muted-foreground">Loading ledger…</p>
      ) : tab === "ledger" ? (
        newestFirst.length === 0 ? (
          <p className="px-2 py-8 text-sm text-muted-foreground">No fees recorded yet. Add them on a job in Permit Inventory.</p>
        ) : (
          <div className="space-y-0.5">
            <div className={`${LEDGER_GRID} px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground`}>
              <span />
              <span>Job #</span>
              <span>Client</span>
              <span>Category</span>
              <span className="text-right">Amount</span>
              <span>Paid</span>
              <span>Running</span>
              <span>Receipt</span>
            </div>
            {newestFirst.map((row) => {
              const open = openId === row.id;
              return (
                <article key={row.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : row.id)}
                    className={`${LEDGER_GRID} w-full cursor-pointer rounded-xl px-2 py-1.5 text-left hover:bg-muted/40`}
                  >
                    {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <span className={JOB_BTN}>{row.job_number}</span>
                    <span className={`${NAME_PILL}`}>{row.client_name}</span>
                    <span className={CELL}>{row.category}</span>
                    <span className="text-right text-sm font-semibold tabular-nums">{money(Number(row.amount) || 0)}</span>
                    <span className={CELL}>{shortDate(row.paid_date)}</span>
                    <span className={`${CELL} tabular-nums text-muted-foreground`}>{money(running.get(row.id) ?? 0)}</span>
                    {row.receipt_storage_path ? (
                      <span className={`${PILL} ${FILL_GREEN} w-full justify-center`}>On file</span>
                    ) : (
                      <span className={`${PILL} ${FILL_AMBER} w-full justify-center`}>Missing</span>
                    )}
                  </button>
                  {open ? (
                    <div className="space-y-2 px-8 pb-3">
                      <p className="text-sm text-muted-foreground">
                        {displayNameOnly(row.permit_tech, techNames)}
                        {row.jurisdiction ? ` · ${row.jurisdiction}` : ""}
                        {row.notes ? ` · ${row.notes}` : ""}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/jobs/${row.job_id}`} className={BTN_BLUE}>
                          Open job
                        </Link>
                        {row.receipt_storage_path ? (
                          <button
                            type="button"
                            className={TAP_GREEN}
                            onClick={() => void openReceipt(row.receipt_storage_path!).catch((err) => alert(err instanceof Error ? err.message : "Couldn't open receipt."))}
                          >
                            <Receipt className="h-3.5 w-3.5" />
                            View receipt
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
            <div className={`${LEDGER_GRID} px-2 pt-2 text-sm font-semibold`}>
              <span />
              <span />
              <span />
              <span>Total</span>
              <span className="text-right tabular-nums">{money(totalPaid)}</span>
              <span />
              <span />
              <span />
            </div>
          </div>
        )
      ) : (
        <ReceiptsTab
          fees={withReceipt}
          files={files}
          techNames={techNames}
          onOpenFee={(path) => void openReceipt(path).catch((err) => alert(err instanceof Error ? err.message : "Couldn't open receipt."))}
          onOpenFile={(path) => void openInstallFile(path)}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-[8.5rem] rounded-2xl px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold ${tone ?? "bg-muted text-foreground"}`}>{value}</p>
    </div>
  );
}

function ReceiptsTab({
  fees,
  files,
  techNames,
  onOpenFee,
  onOpenFile,
}: {
  fees: LedgerRow[];
  files: InstallFile[];
  techNames: TechNameMap;
  onOpenFee: (path: string) => void;
  onOpenFile: (path: string) => void;
}) {
  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <p className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Permit fee receipts</p>
        {fees.length === 0 ? (
          <p className="px-2 py-5 text-sm text-muted-foreground">No fee receipts uploaded yet.</p>
        ) : (
          <>
            <div className={`${LEDGER_GRID} px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground`}>
              <span />
              <span>Job #</span>
              <span>Client</span>
              <span>Category</span>
              <span className="text-right">Amount</span>
              <span>Paid</span>
              <span>Tech</span>
              <span>Receipt</span>
            </div>
            {fees.map((row) => (
              <article key={row.id} className={`${LEDGER_GRID} rounded-xl px-2 py-1.5`}>
                <span />
                <Link href={`/jobs/${row.job_id}`} className={JOB_BTN}>
                  {row.job_number}
                </Link>
                <span className={`${NAME_PILL}`}>{row.client_name}</span>
                <span className={CELL}>{row.category}</span>
                <span className="text-right text-sm font-semibold tabular-nums">{money(Number(row.amount) || 0)}</span>
                <span className={CELL}>{shortDate(row.paid_date)}</span>
                <span className={CELL}>{displayNameOnly(row.permit_tech, techNames)}</span>
                <button type="button" className={`${PILL} ${FILL_GREEN} w-full justify-center`} onClick={() => onOpenFee(row.receipt_storage_path!)}>
                  View
                </button>
              </article>
            ))}
          </>
        )}
      </section>

      <section className="space-y-1">
        <p className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Installer invoices & material receipts</p>
        {files.length === 0 ? (
          <p className="px-2 py-5 text-sm text-muted-foreground">No installer invoices or material receipts uploaded yet.</p>
        ) : (
          <>
            <div className={`${APP_GRID} px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground`}>
              <span />
              <span>Job #</span>
              <span>File</span>
              <span className="hidden sm:block">Type</span>
            </div>
            {files.map((f) => (
              <article key={f.id} className={`${APP_GRID} rounded-xl px-2 py-1.5`}>
                <span />
                <Link href={`/jobs/${f.job_id}`} className={JOB_BTN}>
                  {f.job_number}
                </Link>
                <span className={`${NAME_PILL}`}>{f.file_name}</span>
                <button
                  type="button"
                  className={`${PILL} ${f.category === "installer_invoice" ? FILL_PURPLE : FILL_GREEN} hidden w-full justify-center sm:inline-flex`}
                  onClick={() => onOpenFile(f.storage_path)}
                >
                  {f.category === "installer_invoice" ? "Invoice" : "Material"}
                </button>
              </article>
            ))}
          </>
        )}
      </section>
    </div>
  );
}
