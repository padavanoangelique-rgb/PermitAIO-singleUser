"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileWarning, Loader2, Plus, Printer, Receipt, Trash2 } from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import {
  createJobFee,
  deleteJobFee,
  fetchJobFees,
  openReceipt,
  RECEIPT_ACCEPT,
  type JobFee,
} from "@/lib/inventory/fees";
import { buildJobFeeReportPdf, downloadPdfBytes } from "@/lib/inventory/fee-report-pdf";
import { displayNameOnly, type TechNameMap } from "@/lib/tech-labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Fee amounts are tracked to the cent (unlike job values elsewhere in Permit
// Inventory, which use the shared whole-dollar `currency()` helper from
// constants.ts). A dedicated formatter here avoids touching that existing
// helper/behavior while keeping fee totals precise for accounting handoff.
function feeCurrency(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Job = Tables<"jobs">;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function usDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}/${y}`;
}

/**
 * Additive-only companion to Permit Inventory: per-job fee tracking (NOC,
 * permit, engineering, or any other free-text fee category) with a PDF/photo
 * receipt per line item, plus a one-click stamped PDF report for handing to
 * accounting. This data does not touch the jobs table and is never surfaced
 * in any existing Permit Inventory report — it's purely internal
 * recordkeeping, rendered as its own card inside the Permit Inventory tab.
 */
export function JobFeesPanel({ job, techNames }: { job: Job; techNames?: TechNameMap }) {
  const [fees, setFees] = useState<JobFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [form, setForm] = useState({
    category: "",
    amount: "",
    paid_date: todayIso(),
    jurisdiction: job.jurisdiction ?? "",
    notes: "",
  });
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFees(await fetchJobFees(job.id));
    } finally {
      setLoading(false);
    }
  }, [job.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = useMemo(() => fees.reduce((sum, f) => sum + f.amount, 0), [fees]);

  async function handleAdd() {
    const amount = Number(form.amount);
    if (!form.category.trim()) return alert("Add a category for this fee (e.g. NOC, Permit Fee, Engineering Fee).");
    if (!Number.isFinite(amount) || amount < 0) return alert("Enter a valid amount.");
    setSaving(true);
    try {
      const created = await createJobFee(
        {
          org_id: job.org_id,
          job_id: job.id,
          category: form.category.trim(),
          amount,
          paid_date: form.paid_date || todayIso(),
          jurisdiction: form.jurisdiction.trim() || null,
          notes: form.notes.trim() || null,
        },
        file,
      );
      setFees((prev) => [created, ...prev]);
      setForm({ category: "", amount: "", paid_date: todayIso(), jurisdiction: job.jurisdiction ?? "", notes: "" });
      setFile(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't save that fee.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(fee: JobFee) {
    try {
      await deleteJobFee(fee);
      setFees((prev) => prev.filter((f) => f.id !== fee.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't delete that fee.");
    }
  }

  async function handlePrint() {
    if (fees.length === 0) return;
    setPrinting(true);
    try {
      const bytes = await buildJobFeeReportPdf(
        {
          job_number: job.job_number,
          client_name: job.client_name,
          permit_tech: displayNameOnly(job.permit_tech, techNames),
          address: job.address,
        },
        fees,
      );
      downloadPdfBytes(bytes, `Job ${job.job_number} Fee Report.pdf`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't build the fee report.");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Card className="gap-2 py-4">
      <CardHeader className="flex-row items-center justify-between px-5 py-0">
        <CardTitle className="text-base font-heading flex items-center gap-1.5">
          <Receipt className="h-4 w-4" /> Fees & Receipts
        </CardTitle>
        <Button variant="outline" size="sm" onClick={handlePrint} disabled={printing || fees.length === 0}>
          {printing ? <Loader2 className="animate-spin" /> : <Printer />} {printing ? "Building…" : "Print fee report"}
        </Button>
      </CardHeader>
      <CardContent className="px-5 space-y-4">
        <p className="text-xs text-muted-foreground">
          Internal recordkeeping — NOC, permit, engineering, and other job costs with receipts on file. The Accounting page shows the live ledger.
        </p>

        <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-5">
          <div className="col-span-2 sm:col-span-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Category</Label>
            <Input placeholder="NOC, Permit, Engineering…" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Amount</Label>
            <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Paid date</Label>
            <Input type="date" value={form.paid_date} onChange={(e) => setForm({ ...form, paid_date: e.target.value })} />
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Jurisdiction</Label>
            <Input placeholder="Optional" value={form.jurisdiction} onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Receipt</Label>
            <Input type="file" accept={RECEIPT_ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-xs" />
          </div>
          <div className="col-span-2 sm:col-span-5">
            <Label className="text-[10px] uppercase text-muted-foreground">Notes</Label>
            <Textarea rows={1} placeholder="Optional" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="col-span-2 flex justify-end sm:col-span-5">
            <Button size="sm" onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Plus />} {saving ? "Saving…" : "Add fee"}
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : fees.length === 0 ? (
          <p className="text-sm text-muted-foreground">No fees recorded yet for this job.</p>
        ) : (
          <ul className="space-y-1.5">
            {fees.map((fee) => (
              <li key={fee.id} className="flex flex-wrap items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                <span className="font-medium">{fee.category}</span>
                <span className="text-muted-foreground">{usDate(fee.paid_date)}</span>
                {fee.jurisdiction && <span className="text-xs text-muted-foreground">· {fee.jurisdiction}</span>}
                {fee.notes && <span className="max-w-[200px] truncate text-xs text-muted-foreground">· {fee.notes}</span>}
                <span className="ml-auto font-semibold">{feeCurrency(fee.amount)}</span>
                {fee.receipt_storage_path ? (
                  <Button
                    type="button"
                    variant="link"
                    size="xs"
                    onClick={() => openReceipt(fee.receipt_storage_path!).catch((err) => alert(err instanceof Error ? err.message : "Couldn't open receipt."))}
                    className="px-0"
                  >
                    <Download /> Receipt
                  </Button>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-amber-600">
                    <FileWarning className="h-3 w-3" /> No receipt
                  </span>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="ghost" size="icon-xs" title="Delete fee">
                      <Trash2 />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this fee?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Delete the {fee.category} entry for {feeCurrency(fee.amount)}? This can&apos;t be undone
                        {fee.receipt_storage_path ? " and will remove its receipt file" : ""}.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(fee)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </li>
            ))}
          </ul>
        )}

        {fees.length > 0 && (
          <div className="flex justify-end border-t pt-2 text-sm font-semibold">Total paid: {feeCurrency(total)}</div>
        )}
      </CardContent>
    </Card>
  );
}
