"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { JobNotesLog } from "./job-notes-log";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, Download, Paperclip, Pencil, Printer, Receipt, TriangleAlert, Upload, X } from "lucide-react";
import type { Tables, TablesUpdate } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import {
  COUNTIES,
  NOC_STATUSES,
  STAGES,
  SUB_STATUSES,
  canonicalJurisdiction,
  countyOf,
  currency,
  isFlagged,
  jurisdictionsInCounty,
  type NocStatus,
  type SubStatus,
} from "@/lib/inventory/constants";
import { materialEtaIsSoon, reviewDateTone, DATE_PILL_EMPTY, DATE_TONE_SLOT } from "@/lib/inventory/eta";
import { FILL_BLUE, STATUS_FILL } from "@/lib/ui/fills";
import { NAME_PILL } from "@/lib/ui/chrome";
import { useTechSlots } from "@/components/tech-slots-provider";
import { displayNameOnly, type TechNameMap } from "@/lib/tech-labels";
import { NO_HOA_TECH } from "@/lib/hoa/constants";
import { DualBars } from "@/components/sales/status-card";
import { CorrectionFeed } from "@/components/chat/correction-feed";
import { hoaStageIndex, HOA_STAGES, stageIndexFromJob } from "@/lib/sales/friendly-status";
import { JobFeesPanel } from "./job-fees-panel"; import { markPermitPrinted } from "@/lib/permit-custody/actions";
import { assignAccountManager } from "@/app/(app)/install/actions";
import { DateField } from "@/components/ui/date-field";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Job = Tables<"jobs">;
type JobFile = Tables<"job_files">;
type AccountManager = { id: string; email: string; role: string; user_id: string | null; display_name: string | null; company_name: string | null };

function shortDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" });
}

function DatePill({
  label,
  value,
  closed,
  late,
  onSave,
  labeled = true,
}: {
  label: string;
  value: string | null | undefined;
  closed?: string | null;
  late?: boolean;
  onSave: (next: string) => void;
  labeled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const stored = (value ?? "").slice(0, 10);
  const cls = !value
    ? DATE_PILL_EMPTY
    : late
      ? DATE_TONE_SLOT.late
      : DATE_TONE_SLOT[reviewDateTone(value, closed)];

  useEffect(() => {
    if (!editing) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    try {
      el.showPicker();
    } catch {
      /* native input still works */
    }
  }, [editing]);

  const control = editing ? (
    <input
      ref={ref}
      type="date"
      defaultValue={stored}
      aria-label={label}
      onChange={(e) => {
        const next = e.target.value;
        if (next && next !== stored) onSave(next);
        setEditing(false);
      }}
      className="h-8 w-full min-w-0 rounded-full border border-border bg-background px-1 text-center text-xs"
    />
  ) : (
    <button type="button" className={cls.replace("text-xs", "text-sm")} onClick={() => setEditing(true)} aria-label={label}>
      {value ? shortDate(value) : "—"}
    </button>
  );

  return (
    <span
      className={labeled ? "grid w-[6.9rem] grid-cols-[1.9rem_minmax(0,1fr)] items-center gap-1" : "flex w-full min-w-0 items-center justify-center overflow-hidden"}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {labeled ? <span className="text-[11px] font-medium">{label}</span> : null}
      {control}
    </span>
  );
}

const PERMIT_STATUS_LABEL: Record<string, string> = {
  not_printed: "Not printed yet",
  in_library: "In library — ready for pickup",
  checked_out: "Checked out",
  checked_in: "Checked in at job site",
};

const RECORD_TRIGGER =
  "h-auto min-h-0 w-auto max-w-full justify-start gap-1 rounded-none border-0 bg-transparent p-0 py-0 text-left text-base font-semibold shadow-none outline-none ring-0 focus-visible:border-transparent focus-visible:ring-0 data-[size=default]:h-auto data-[size=sm]:h-auto dark:bg-transparent dark:hover:bg-transparent [&>svg]:size-3.5 [&>svg]:opacity-40";

const FIELD_ROW = "grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5";
const PILL =
  "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold shadow-sm sm:h-9";
const PARCEL_PILL = `${PILL} bg-primary text-primary-foreground hover:bg-primary/90`;
const ATTACH_PILL = `${PILL} bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-500`;
const STICKER_PILL = `${PILL} bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500`;
const UPLOAD_PILL = `${PILL} bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500`;
const FEES_PILL = `${PILL} bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500`;
const COUNTY_PILL =
  "h-11 w-auto min-w-0 justify-start gap-1.5 rounded-full border border-border bg-background px-3.5 text-sm font-semibold shadow-sm sm:h-9 data-[size=default]:h-11 data-[size=sm]:h-9 dark:bg-background";
const JOB_BTN =
  "inline-flex h-8 w-full items-center justify-center rounded-full bg-primary px-2 text-sm font-semibold tabular-nums text-primary-foreground shadow-sm hover:opacity-90";
const STATUS_PILL =
  "inline-flex h-8 w-full min-w-0 items-center justify-center truncate rounded-full px-2 text-sm font-semibold leading-none shadow-sm";
export const JOB_ROW_GRID = "grid w-full min-w-0 grid-cols-[1.25rem_1.25rem_5.75rem_4.75rem_minmax(8rem,12rem)_minmax(5.5rem,8.5rem)_minmax(7rem,1fr)_10rem_repeat(5,5.5rem)_5.25rem] items-center gap-x-1.5 overflow-hidden";
const STATUS_TONE: Record<string, string> = STATUS_FILL;
const EDIT_BTN =
  `inline-flex h-8 items-center gap-1 rounded-full px-3 text-sm font-semibold shadow-sm ${FILL_BLUE} hover:opacity-90`;

function StatusPicker({
  value,
  options,
  tone,
  onChange,
}: {
  value: string;
  options: readonly string[];
  tone: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node) && !(menu.current && menu.current.contains(e.target as Node))) setOpen(false);
    }
    const close = () => setOpen(false); document.addEventListener("mousedown", onDoc); window.addEventListener("scroll", close, true);
    return () => { document.removeEventListener("mousedown", onDoc); window.removeEventListener("scroll", close, true); };
  }, [open]);
  return (
    <div
      ref={wrap}
      className="relative w-full min-w-0"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button type="button" title={value} className={`${STATUS_PILL} ${tone} cursor-pointer`} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - 200)) }); setOpen((v) => !v); }}>
        {value}
      </button>
      {open ? createPortal(
        <ul  ref={menu} style={{ position: "fixed", top: pos.top, left: pos.left, right: "auto", marginTop: 0, zIndex: 100 }} className="absolute right-0 z-50 mt-1 max-h-64 min-w-[12rem] overflow-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg">
          {options.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                className={`flex w-full rounded-lg px-3 py-1.5 text-left text-sm hover:bg-muted ${opt === value ? "font-semibold" : ""}`}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      , document.body) : null}
    </div>
  );
}

export function JobRow({
  job,
  onUpdate,
  onDelete,
  jurisdictionOptions: _jurisdictionOptions,
  files,
  onUploadFile,
  onDownloadFile,
  onDeleteFile,
  techNames,
  defaultCollapsed = true,
}: {
  job: Job;
  onUpdate: (patch: TablesUpdate<"jobs">, force?: boolean) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  jurisdictionOptions: string[];
  files: JobFile[];
  onUploadFile: (file: File) => Promise<void>;
  onDownloadFile: (file: JobFile) => void | Promise<void>;
  onDeleteFile: (file: JobFile) => void | Promise<void>;
  techNames?: TechNameMap;
  defaultCollapsed?: boolean;
}) {
  void _jurisdictionOptions;
  const { permitTechs } = useTechSlots();
  const flagged = isFlagged(job);
  const [open, setOpen] = useState(!defaultCollapsed);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showFees, setShowFees] = useState(false); const [jurisdictionDraft, setJurisdictionDraft] = useState(job.jurisdiction ?? "");
  const [countyDraft, setCountyDraft] = useState<string>(countyOf(job.jurisdiction) ?? "");
  const [permitStatus, setPermitStatus] = useState<{ status: string; current_holder_name: string | null } | null>(null);
  const [permitFile, setPermitFile] = useState<{ file_name: string; storage_path: string } | null>(null);
  const [uploadingPermit, setUploadingPermit] = useState(false);
  const [accountManagers, setAccountManagers] = useState<AccountManager[]>([]);
  const [accountManagerId, setAccountManagerId] = useState<string | null>(null);
  const [hoaStatus, setHoaStatus] = useState<string | null>(null);
  useEffect(() => {
    setJurisdictionDraft(job.jurisdiction ?? "");
  }, [job.id, job.jurisdiction]);

  async function loadPermitCustody() {
    const supabase = createClient();
    const db = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => { eq: (a: string, b: string) => { maybeSingle: () => Promise<{ data: { status: string; current_holder_name: string | null } | null }> } };
      };
    };
    const [{ data: custody }, { data: latestFile }] = await Promise.all([
      db.from("permit_custody").select("status, current_holder_name").eq("job_id", job.id).maybeSingle(),
      supabase
        .from("job_files")
        .select("file_name, storage_path")
        .eq("job_id", job.id)
        .eq("category", "permit_printed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setPermitStatus(custody ?? { status: "not_printed", current_holder_name: null });
    setPermitFile(latestFile ?? null);
  }

  async function loadHoaStatus() {
    const supabase = createClient();
    const { data } = await supabase.from("hoa_jobs").select("status").eq("job_id", job.id).maybeSingle();
    setHoaStatus(data?.status ?? null);
  }

  async function loadAccountManager() {
    const supabase = createClient();
    const db = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => { eq: (a: string, b: string) => Promise<{ data: Record<string, unknown>[] | null }> };
      };
    };
    const [{ data: roster }, { data: assignments }] = await Promise.all([
      db.from("install_members").select("id, email, role, user_id, display_name, company_name").eq("org_id", job.org_id),
      db.from("install_job_assignments").select("job_id, account_manager_id").eq("job_id", job.id),
    ]);
    setAccountManagers(((roster ?? []) as unknown as AccountManager[]).filter((m) => m.role === "account_manager"));
    const row = (assignments ?? [])[0] as { account_manager_id: string | null } | undefined;
    setAccountManagerId(row?.account_manager_id ?? null);
  }

  async function selectAccountManager(id: string) {
    const nextId = accountManagerId === id ? "" : id;
    setAccountManagerId(nextId || null);
    const formData = new FormData();
    formData.set("jobId", job.id);
    formData.set("jobNumber", job.job_number);
    formData.set("accountManagerId", nextId);
    await assignAccountManager(formData);
    await loadAccountManager();
  }

  useEffect(() => {
    void loadPermitCustody();
    void loadAccountManager();
    void loadHoaStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id, job.org_id]);

  async function uploadPrintedPermit(file: File) {
    setUploadingPermit(true);
    const supabase = createClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${job.id}/permit/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("job-files").upload(storagePath, file);
    if (!uploadError) {
      await supabase.from("job_files").insert({
        job_id: job.id,
        org_id: job.org_id,
        category: "permit_printed",
        file_name: file.name,
        storage_path: storagePath,
        size_bytes: file.size,
      });
      await markPermitPrinted(job.id, job.job_number);
      await loadPermitCustody();
    }
    setUploadingPermit(false);
  }

  async function openPermitFile() {
    if (!permitFile) return;
    const supabase = createClient();
    const { data } = await supabase.storage.from("job-files").createSignedUrl(permitFile.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  const derivedCounty = countyOf(job.jurisdiction) || countyDraft;
  const notePreview = (job.notes ?? "").replace(/\s+/g, " ").trim();

  function setNoc(value: NocStatus) {
    onUpdate({ noc_status: job.noc_status === value ? "None" : value });
  }

  return (
    <div className={flagged ? "rounded-xl bg-destructive/5" : "rounded-xl"}>
        <div
          className={`${JOB_ROW_GRID} cursor-pointer rounded-xl px-2 py-1.5 hover:bg-muted/50`}
          title={[job.permit_number ? `#${job.permit_number}` : null, job.address, notePreview].filter(Boolean).join(" · ") || undefined}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          {flagged ? <TriangleAlert className="h-4 w-4 text-destructive" /> : <span />}
          <Link href={`/jobs/${job.id}`} onClick={(e) => e.stopPropagation()} className={JOB_BTN} title={job.permit_number ? `Permit #${job.permit_number}` : undefined}>
            {job.job_number}
          </Link>
          <span className="truncate text-sm font-medium tabular-nums text-primary">
            {job.contract_value != null ? currency(job.contract_value) : "—"}
          </span>
          <span className="min-w-0">
            <span className={NAME_PILL} title={job.client_name || undefined}>
              <span className="truncate">{job.client_name || "—"}</span>
            </span>
          </span>
          <span className="min-w-0 truncate text-sm text-muted-foreground" title={job.address || undefined}>
            {job.jurisdiction || job.city || "—"}
          </span>
          <span className="min-w-0 truncate text-center text-sm font-medium tabular-nums" title={job.permit_number || undefined}>
            {job.permit_number || "—"}
          </span>
          <StatusPicker
            value={job.sub_status}
            options={SUB_STATUSES}
            tone={STATUS_TONE[job.sub_status] ?? "bg-muted text-muted-foreground"}
            onChange={(sub_status) => onUpdate({ sub_status: sub_status as SubStatus })}
          />
          <DatePill labeled={false} label="Asgn" value={job.assigned_date} closed={job.submitted_date} onSave={(assigned_date) => void onUpdate({ assigned_date })} />
          <DatePill labeled={false} label="Sub" value={job.submitted_date} closed={job.approved_date} onSave={(submitted_date) => void onUpdate({ submitted_date })} />
          <DatePill labeled={false} label="Appr" value={job.approved_date} closed={job.approved_date} onSave={(approved_date) => void onUpdate({ approved_date })} />
          <DatePill labeled={false} label="Ord" value={job.ordered_date} closed={job.ordered_date} onSave={(ordered_date) => void onUpdate({ ordered_date })} />
          <DatePill
            labeled={false}
            label="ETA"
            value={job.material_eta}
            closed={job.material_eta}
            late={materialEtaIsSoon(job.material_eta)}
            onSave={(material_eta) => void onUpdate({ material_eta })}
          />
          <Button
            type="button"
            variant="ghost"
            className={`${EDIT_BTN} w-full justify-center`}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        </div>

        {open && (
          <div className="px-4 py-4">
            <DualBars
              permitIndex={stageIndexFromJob(job.sub_status, job.stage)}
              hoaIndex={hoaStageIndex(hoaStatus, job.hoa_tech !== NO_HOA_TECH)}
              hoaLabel={
                job.hoa_tech === NO_HOA_TECH
                  ? "Not needed"
                  : (HOA_STAGES[hoaStageIndex(hoaStatus, true)]?.short ?? "Getting ready")
              }
            />
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Label className={`${ATTACH_PILL} cursor-pointer`}>
                <Paperclip className="h-3.5 w-3.5" />
                {uploadingFile ? "Uploading…" : "Attach file"}
                <input
                  type="file"
                  className="hidden"
                  disabled={uploadingFile}
                  onChange={async (e) => {
                    const picked = e.target.files?.[0];
                    if (!picked) return;
                    setUploadingFile(true);
                    await onUploadFile(picked);
                    setUploadingFile(false);
                    e.target.value = "";
                  }}
                />
              </Label>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button type="button" className="ml-auto inline-flex h-11 items-center rounded-full px-3.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:h-9">
                    Delete job
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this job?</AlertDialogTitle>
                    <AlertDialogDescription>Delete {job.client_name} — Job {job.job_number}? This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={() => onDelete()}>Yes, delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <div className={`mt-3 ${FIELD_ROW}`}>
              <RecordSelect label="Job Status" value={job.stage} onValueChange={(stage) => onUpdate({ stage })}>
                {STAGES.map((stage) => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}
              </RecordSelect>
              <RecordSelect
                label="Permit Status"
                value={job.sub_status}
                onValueChange={(sub_status) => onUpdate({ sub_status: sub_status as SubStatus })}
              >
                {SUB_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
              </RecordSelect>
              <RecordText
                label="Permit Number"
                display={job.permit_number ?? ""}
                defaultValue={job.permit_number ?? ""}
                onSave={(raw) => {
                  const next = raw.trim() || null;
                  if (next !== (job.permit_number ?? null)) onUpdate({ permit_number: next });
                }}
              />
              <RecordText
                label="Contract Value"
                type="number"
                display={job.contract_value != null ? currency(job.contract_value) : ""}
                defaultValue={job.contract_value != null ? String(job.contract_value) : ""}
                placeholder="0"
                onSave={(raw) => {
                  const trimmed = raw.trim();
                  const next = trimmed === "" ? null : Number(trimmed);
                  if (next !== job.contract_value) onUpdate({ contract_value: Number.isFinite(next as number) ? next : null });
                }}
              />
              <RecordSelect
                label="Permit Tech"
                value={job.permit_tech}
                display={displayNameOnly(job.permit_tech, techNames)}
                onValueChange={(permit_tech) => onUpdate({ permit_tech })}
              >
                {permitTechs.map((tech) => <SelectItem key={tech} value={tech}>{displayNameOnly(tech, techNames)}</SelectItem>)}
              </RecordSelect>

              <RecordText
                label="Job Address"
                display={job.address ?? ""}
                defaultValue={job.address ?? ""}
                placeholder="Fills in from Form filler"
                readOnly
                onSave={(raw) => {
                  const next = raw.trim() || null;
                  if (next !== (job.address ?? null)) onUpdate({ address: next });
                }}
              />
              <RecordSelect label="Jurisdiction"
                value={jurisdictionDraft}
                placeholder="Fills in from Form filler"
                disabled
                onValueChange={(nextJur) => {
                  const canonical = canonicalJurisdiction(nextJur);
                  setJurisdictionDraft(canonical);
                  if (canonical !== (job.jurisdiction ?? "")) onUpdate({ jurisdiction: canonical || null });
                }}
              >
                {jurisdictionsInCounty(derivedCounty).map((j) => (
                  <SelectItem key={j} value={j}>{j}</SelectItem>
                ))}
              </RecordSelect>
              <RecordDate label="Assigned" value={job.assigned_date} onSave={(assigned_date) => onUpdate({ assigned_date }, assigned_date === null)} />
              <RecordDate label="Submitted" value={job.submitted_date} onSave={(submitted_date) => onUpdate({ submitted_date }, submitted_date === null)} />
              <RecordDate label="Approved" value={job.approved_date} onSave={(approved_date) => onUpdate({ approved_date }, approved_date === null)} />
              <RecordDate label="Job ordered" value={job.ordered_date} onSave={(ordered_date) => onUpdate({ ordered_date }, ordered_date === null)} />
              <RecordDate label="Material ETA" value={job.material_eta} onSave={(material_eta) => onUpdate({ material_eta }, material_eta === null)} />
              <div className="min-w-0 lg:col-span-2">
                <RecordLabel>NOC</RecordLabel>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5">
                  {NOC_STATUSES.filter((status) => status !== "None").map((status) => {
                    const active = job.noc_status === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setNoc(status)}
                        className={`inline-flex items-center gap-1 text-base ${active ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        {active ? <Check className="h-4 w-4 text-primary" /> : null}
                        {status}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="min-w-0">
                <RecordLabel>Account manager</RecordLabel>
                {accountManagers.length === 0 ? (
                  <p className="text-base text-muted-foreground">—</p>
                ) : (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-0.5">
                    {accountManagers.map((m) => {
                      const active = accountManagerId === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => void selectAccountManager(m.id)}
                          className={`text-base ${active ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          {m.display_name?.trim() || m.email}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <RecordLabel>Printed permit</RecordLabel>
                <p className="truncate text-base font-semibold">
                  {PERMIT_STATUS_LABEL[permitStatus?.status ?? "not_printed"] ?? "Not printed yet"}
                  {permitStatus?.status === "checked_out" && permitStatus.current_holder_name ? ` — with ${permitStatus.current_holder_name}` : ""}
                </p>
                {permitFile ? (
                  <button
                    type="button"
                    onClick={() => void openPermitFile()}
                    className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-[13px] text-primary hover:underline"
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" /> {permitFile.file_name}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 lg:grid-cols-5">
              <div className="min-w-0 lg:col-span-3">
                <RecordLabel>Notes</RecordLabel>
<JobNotesLog value={job.notes} onSave={(next) => onUpdate({ notes: next })} />
                <div className="mt-2">
                  <CorrectionFeed
                    jobId={job.id}
                    jobNumber={job.job_number}
                    jurisdiction={job.jurisdiction}
                    trade={job.trade_type}
                  />
                </div>
<div className="mt-3">
              <button
                type="button"
                className={FEES_PILL}
                onClick={() => setShowFees((v) => !v)}
              >
                <Receipt className="h-3.5 w-3.5" />
                Fees & Receipts
              </button>
</div>              </div>
              <div className="min-w-0 lg:col-span-2">
                <RecordLabel>Attached files{files.length > 0 ? ` (${files.length})` : ""}</RecordLabel>
                {files.length > 0 ? (
                  <ul className="space-y-0.5">
                    {files.map((file) => (
                      <li key={file.id} className="flex min-w-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onDownloadFile(file)}
                          className="min-w-0 truncate text-left text-base text-foreground hover:text-primary hover:underline"
                        >
                          {file.file_name}
                        </button>
                        <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                          {file.size_bytes != null ? `${Math.max(1, Math.round(file.size_bytes / 1024))} KB` : ""}
                        </span>
                        <button
                          type="button"
                          title="Remove file"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => { if (confirm(`Remove ${file.file_name}?`)) onDeleteFile(file); }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-base text-muted-foreground">—</p>
                )}
<div className="mt-3 flex flex-wrap gap-2">
              <a href={`/api/jobs/${job.id}/sticker`} target="_blank" rel="noreferrer" className={STICKER_PILL}>
                <Printer className="h-3.5 w-3.5" />
                Print sticker
              </a>
              <Label className={`${UPLOAD_PILL} cursor-pointer`}>
                <Upload className="h-3.5 w-3.5" />
                {uploadingPermit ? "Uploading…" : permitFile ? "Replace printed permit" : "Upload printed permit"}
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  disabled={uploadingPermit}
                  onChange={async (e) => {
                    const picked = e.target.files?.[0];
                    if (!picked) return;
                    await uploadPrintedPermit(picked);
                    e.target.value = "";
                  }}
                />
              </Label>
</div>              </div>
            </div>

            {showFees ? (
              <div className="mt-3">
                <JobFeesPanel job={job} techNames={techNames} />
              </div>
            ) : null}
          </div>
        )}
    </div>
  );
}

function RecordLabel({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{children}</p>;
}

function RecordSelect({
  label,
  value,
  onValueChange,
  disabled,
  placeholder,
  children,
  display,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  children: ReactNode;
  display?: string;
}) {
  return (
    <div className="min-w-0">
      <RecordLabel>{label}</RecordLabel>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className={RECORD_TRIGGER} size="sm">
          {display ? <SelectValue placeholder={placeholder ?? "—"}>{display}</SelectValue> : <SelectValue placeholder={placeholder ?? "—"} />}
        </SelectTrigger>
        <SelectContent position="popper">{children}</SelectContent>
      </Select>
    </div>
  );
}

function RecordText({
  label,
  display,
  defaultValue,
  onSave,
  type = "text",
  multiline = false,
  placeholder,
  readOnly = false,
}: {
  label: string;
  display: string;
  defaultValue: string;
  onSave: (raw: string) => void;
  type?: string;
  multiline?: boolean;
  placeholder?: string;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const empty = !display.trim();

  if (!editing) {
    return (
      <button type="button" className="min-w-0 text-left" onClick={() => !readOnly && setEditing(true)}>
        <RecordLabel>{label}</RecordLabel>
        <p className={empty ? "text-base text-muted-foreground" : multiline ? "whitespace-pre-wrap text-base" : "truncate text-base font-semibold"}>
          {empty ? (readOnly && placeholder ? placeholder : "—") : display}
        </p>
      </button>
    );
  }

  function commit(raw: string) {
    onSave(raw);
    setEditing(false);
  }

  if (multiline) {
    return (
      <div className="min-w-0">
        <RecordLabel>{label}</RecordLabel>
        <Textarea
          autoFocus
          rows={2}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="min-h-16 border-0 bg-muted/40 px-2 shadow-none focus-visible:ring-0"
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <RecordLabel>{label}</RecordLabel>
      <Input
        autoFocus
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-8 rounded-none border-0 border-b border-input bg-transparent px-0 shadow-none focus-visible:ring-0"
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    </div>
  );
}

function RecordDate({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string | null;
  onSave: (next: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <button type="button" className="min-w-[6.5rem] text-left" onClick={() => setEditing(true)}>
        <RecordLabel>{label}</RecordLabel>
        <p className={value ? "text-base font-semibold" : "text-base text-muted-foreground"}>{shortDate(value)}</p>
      </button>
    );
  }
  return (
    <div className="min-w-[9rem]">
      <DateField
        label={label}
        value={value}
        onSave={(next) => {
          onSave(next);
          setEditing(false);
        }}
      />
    </div>
  );
}
