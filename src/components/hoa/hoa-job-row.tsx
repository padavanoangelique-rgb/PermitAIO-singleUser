"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, FileText, Pencil, Send, Upload, X } from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateField } from "@/components/ui/date-field";
import { STATUS_FILL, FILL_BLUE, jobStatusFill } from "@/lib/ui/fills";
import { NAME_PILL } from "@/lib/ui/chrome";
import { HOA_JOB_STATUSES } from "@/lib/hoa/constants";
import { STAGES, stageWhenOrdered } from "@/lib/inventory/constants";
import { hoaDocJobIdFromPath, hoaDocPath } from "@/lib/hoa/documents";
import { saveHoaJobNotes, sendHoaApplication } from "@/app/(app)/hoa/actions";
import { displayNameOnly } from "@/lib/tech-labels";
import { useTechSlots, useTechLabel } from "@/components/tech-slots-provider";
import { materialEtaIsSoon, reviewDateTone, DATE_PILL_EMPTY, DATE_TONE_SLOT } from "@/lib/inventory/eta";
import { DualBars } from "@/components/sales/status-card";
import { hoaStageIndex, HOA_STAGES, stageIndexFromJob } from "@/lib/sales/friendly-status";
import { HoaCombobox, type HoaOption } from "./hoa-combobox";
import { HoaModal } from "./hoa-modal";

type Hoa = Tables<"hoas">;
type HoaJob = Tables<"hoa_jobs">;
type HoaDocument = Tables<"hoa_documents">;

const JOB_BTN =
  "inline-flex h-8 w-full items-center justify-center rounded-full bg-primary px-2 text-sm font-semibold tabular-nums text-primary-foreground shadow-sm hover:opacity-90";
const STATUS_PILL =
  "inline-flex h-8 w-full min-w-0 max-w-full items-center justify-center truncate rounded-full px-2.5 text-xs font-semibold shadow-sm";
const EDIT_BTN =
  `inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold shadow-sm ${FILL_BLUE} hover:opacity-90`;
const ACTION_BTN =
  "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold text-white";
export const HOA_JOB_GRID =
  "grid w-full min-w-0 grid-cols-[1.25rem_5.75rem_minmax(8rem,12rem)_minmax(0,1fr)_7rem_8.25rem_repeat(5,5.5rem)_5.25rem] items-center gap-x-1.5 overflow-hidden";
const FIELD_ROW = "grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5";
const RECORD_TRIGGER =
  "h-auto min-h-0 w-auto max-w-full justify-start gap-1 rounded-none border-0 bg-transparent p-0 py-0 text-left text-base font-semibold shadow-none outline-none ring-0 focus-visible:border-transparent focus-visible:ring-0 data-[size=default]:h-auto data-[size=sm]:h-auto dark:bg-transparent dark:hover:bg-transparent [&>svg]:size-3.5 [&>svg]:opacity-40";

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
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div
      ref={wrap}
      className="relative w-full min-w-0"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button type="button" className={`${STATUS_PILL} ${tone} cursor-pointer`} onClick={() => setOpen((v) => !v)}>
        {value}
      </button>
      {open ? (
        <ul className="absolute right-0 z-50 mt-1 max-h-64 min-w-[12rem] overflow-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg">
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
      ) : null}
    </div>
  );
}

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
  onSave?: (next: string) => void;
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

  const control = editing && onSave ? (
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
    <button type="button" className={cls} disabled={!onSave} aria-label={label} onClick={() => onSave && setEditing(true)}>
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

export function HoaJobRow({
  job,
  hoa,
  dates,
  documents,
  orgId,
  hoas,
  onHoaCreated,
  onDocsChanged,
  onJobPatched,
  onLinkedDates,
}: {
  job: HoaJob;
  hoa: Hoa | undefined;
  dates: { ordered: string | null; eta: string | null; sub_status: string | null; stage: string | null } | null;
  documents: HoaDocument[];
  orgId: string;
  hoas: HoaOption[];
  onHoaCreated: (hoa: Hoa) => void;
  onDocsChanged: () => void;
  onJobPatched: (next: HoaJob) => void;
  onLinkedDates?: (
    jobId: string,
    next: { ordered: string | null; eta: string | null; sub_status: string | null; stage: string | null },
  ) => void;
}) {
  const { hoaTechs, hoaNames } = useTechSlots();
  const { hoaLabel } = useTechLabel();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(job.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [addHoaOpen, setAddHoaOpen] = useState(false);
  const [addHoaName, setAddHoaName] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const apps = documents.filter((d) => hoaDocJobIdFromPath(d.storage_path) === job.id);

  async function patch(next: Partial<HoaJob>) {
    const previous = job;
    onJobPatched({ ...job, ...next });
    const supabase = createClient();
    const { error } = await supabase.from("hoa_jobs").update(next).eq("id", job.id).eq("org_id", orgId);
    if (error) {
      onJobPatched(previous);
      return alert(`Couldn't save that change: ${error.message}`);
    }
    if (job.job_id && "assigned_to" in next) {
      await supabase.from("jobs").update({ hoa_tech: next.assigned_to || "" }).eq("id", job.job_id);
    }
  }

  async function patchLinked(next: Partial<{ ordered: string | null; eta: string | null; stage: string | null }>) {
    if (!job.job_id) return;
    const current = dates ?? { ordered: null, eta: null, sub_status: null, stage: null };
    const merged = { ...current, ...next };
    const payload: { ordered_date?: string | null; material_eta?: string | null; stage?: string } = {};
    if ("ordered" in next) payload.ordered_date = next.ordered ?? null;
    if ("eta" in next) payload.material_eta = next.eta ?? null;
    if ("stage" in next && next.stage) payload.stage = next.stage;
    if ("ordered" in next && next.ordered && !("stage" in next)) {
      const nextStage = stageWhenOrdered(current.stage);
      if (nextStage !== current.stage) {
        payload.stage = nextStage;
        merged.stage = nextStage;
      }
    }
    onLinkedDates?.(job.job_id, merged);
    const supabase = createClient();
    await supabase.from("jobs").update(payload).eq("id", job.job_id);
  }

  async function saveNotes() {
    setSavingNotes(true);
    const result = await saveHoaJobNotes(job.id, notes);
    setSavingNotes(false);
    if ("error" in result && result.error) return alert(result.error);
    onJobPatched({ ...job, notes });
  }

  async function uploadApplication(file: File | undefined) {
    if (!file || !job.hoa_id) return;
    setUploading(true);
    const supabase = createClient();
    const path = hoaDocPath({ orgId, hoaId: job.hoa_id, kind: "application", fileName: file.name, jobId: job.id });
    const { error: upErr } = await supabase.storage.from("hoa-documents").upload(path, file);
    if (upErr) {
      setUploading(false);
      return alert(`Couldn't upload that file: ${upErr.message}`);
    }
    const { error: dbErr } = await supabase.from("hoa_documents").insert({
      org_id: orgId,
      hoa_id: job.hoa_id,
      file_name: file.name,
      storage_path: path,
    });
    setUploading(false);
    if (dbErr) return alert(`Couldn't save that file: ${dbErr.message}`);
    onDocsChanged();
  }

  async function download(doc: HoaDocument) {
    const win = window.open("", "_blank");
    const supabase = createClient();
    const { data, error } = await supabase.storage.from("hoa-documents").createSignedUrl(doc.storage_path, 60);
    if (error || !data) {
      win?.close();
      return alert(`Couldn't open that file: ${error?.message ?? "unknown error"}`);
    }
    if (win) win.location.href = data.signedUrl;
    else window.open(data.signedUrl, "_blank");
  }

  async function removeDoc(doc: HoaDocument) {
    const supabase = createClient();
    await supabase.storage.from("hoa-documents").remove([doc.storage_path]);
    await supabase.from("hoa_documents").delete().eq("id", doc.id).eq("org_id", orgId);
    onDocsChanged();
  }

  async function send(doc: HoaDocument) {
    setSendingId(doc.id);
    const result = await sendHoaApplication({ hoaJobId: job.id, documentId: doc.id });
    setSendingId(null);
    if ("error" in result && result.error) return alert(result.error);
    alert(`Sent to ${result.sentTo}. Replies go to the email agent.`);
    onDocsChanged();
  }

  return (
    <div className="rounded-xl">
      <div
        className={`${HOA_JOB_GRID} cursor-pointer rounded-xl px-2 py-1.5 hover:bg-muted/50`}
        title={[job.address, job.assigned_to ? displayNameOnly(job.assigned_to, hoaNames) : null].filter(Boolean).join(" · ") || undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        {job.job_id ? (
          <Link href={`/jobs/${job.job_id}`} onClick={(e) => e.stopPropagation()} className={JOB_BTN}>
            {job.job_number || "—"}
          </Link>
        ) : (
          <span className={JOB_BTN}>{job.job_number || "—"}</span>
        )}
        <span className="min-w-0">
          <span className={NAME_PILL} title={job.job_name || undefined}>
            <span className="truncate">{job.job_name || "—"}</span>
          </span>
        </span>
        <span className="min-w-0 truncate text-sm text-muted-foreground" title={job.address || undefined}>
          {hoa?.name ?? "Unlinked"}
        </span>
        <StatusPicker
          value={job.status || HOA_JOB_STATUSES[0]}
          options={HOA_JOB_STATUSES}
          tone={STATUS_FILL[job.status ?? ""] ?? "bg-muted text-muted-foreground"}
          onChange={(status) => void patch({ status })}
        />
        {job.job_id ? (
          <StatusPicker
            value={dates?.stage || STAGES[0]}
            options={STAGES}
            tone={jobStatusFill(dates?.stage)}
            onChange={(stage) => void patchLinked({ stage })}
          />
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
        <DatePill labeled={false} label="Asgn" value={job.assigned_date} closed={job.date_submitted} onSave={(assigned_date) => void patch({ assigned_date })} />
        <DatePill labeled={false} label="Sub" value={job.date_submitted} closed={job.date_approved} onSave={(date_submitted) => void patch({ date_submitted })} />
        <DatePill labeled={false} label="Appr" value={job.date_approved} closed={job.date_approved} onSave={(date_approved) => void patch({ date_approved })} />
        <DatePill
          labeled={false}
          label="Ord"
          value={dates?.ordered}
          closed={dates?.ordered}
          onSave={job.job_id ? (ordered) => void patchLinked({ ordered }) : undefined}
        />
        <DatePill
          labeled={false}
          label="ETA"
          value={dates?.eta}
          closed={dates?.eta}
          late={materialEtaIsSoon(dates?.eta)}
          onSave={job.job_id ? (eta) => void patchLinked({ eta }) : undefined}
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

      {open ? (
        <div className="space-y-4 px-4 py-4" onClick={(e) => e.stopPropagation()}>
          <DualBars
            permitIndex={stageIndexFromJob(dates?.sub_status, dates?.stage)}
            hoaIndex={hoaStageIndex(job.status, true)}
            hoaLabel={HOA_STAGES[hoaStageIndex(job.status, true)]?.short ?? "Getting ready"}
          />
          <div className={FIELD_ROW}>
            <div className="min-w-0 lg:col-span-2">
              <RecordLabel>HOA / Community</RecordLabel>
              <HoaCombobox
                hoas={hoas}
                value={job.hoa_id}
                onChange={(hoa_id) => void patch({ hoa_id })}
                onCreateNew={(name) => {
                  setAddHoaName(name);
                  setAddHoaOpen(true);
                }}
              />
            </div>
            <RecordSelect
              label="HOA status"
              value={job.status || HOA_JOB_STATUSES[0]}
              onValueChange={(status) => void patch({ status })}
            >
              {HOA_JOB_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </RecordSelect>
            <RecordSelect
              label="HOA tech"
              value={job.assigned_to || "unassigned"}
              display={job.assigned_to ? hoaLabel(job.assigned_to) : "Unassigned"}
              onValueChange={(v) => void patch({ assigned_to: v === "unassigned" ? "" : v })}
            >
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {hoaTechs.map((tech) => (
                <SelectItem key={tech} value={tech}>
                  {hoaLabel(tech)}
                </SelectItem>
              ))}
            </RecordSelect>
            <RecordText
              label="Client"
              display={job.job_name ?? ""}
              defaultValue={job.job_name ?? ""}
              onSave={(raw) => {
                const next = raw.trim();
                if (next !== (job.job_name ?? "")) void patch({ job_name: next });
              }}
            />
            <RecordText
              label="Job address"
              display={job.address ?? ""}
              defaultValue={job.address ?? ""}
              onSave={(raw) => {
                const next = raw.trim();
                if (next !== (job.address ?? "")) void patch({ address: next });
              }}
            />
            <RecordDate
              label="Assigned"
              value={job.assigned_date}
              onSave={(assigned_date) => void patch({ assigned_date })}
            />
            <RecordDate
              label="Submitted"
              value={job.date_submitted}
              onSave={(date_submitted) => void patch({ date_submitted })}
            />
            <RecordDate
              label="Approved"
              value={job.date_approved}
              onSave={(date_approved) => void patch({ date_approved })}
            />
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
            <Textarea
              className="mt-1 min-h-[88px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes for this HOA job…"
            />
            <Button size="sm" className="mt-2 rounded-full" disabled={savingNotes} onClick={() => void saveNotes()}>
              {savingNotes ? "Saving…" : "Save notes"}
            </Button>
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">HOA application</p>
              <button
                type="button"
                disabled={uploading || !job.hoa_id}
                onClick={() => fileInput.current?.click()}
                className={`${ACTION_BTN} bg-violet-600 hover:bg-violet-700`}
              >
                <Upload className="h-3.5 w-3.5" />
                {uploading ? "Uploading…" : "Upload application"}
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  void uploadApplication(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
            {apps.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No application on this job yet.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {apps.map((doc) => (
                  <li key={doc.id} className="flex flex-wrap items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-muted/40">
                    <button type="button" onClick={() => void download(doc)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-medium">{doc.file_name}</span>
                    </button>
                    <button
                      type="button"
                      disabled={sendingId === doc.id || !hoa?.email}
                      onClick={() => void send(doc)}
                      className={`${ACTION_BTN} bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50`}
                      title={hoa?.email ? `Send to ${hoa.email}` : "Add an HOA email first"}
                    >
                      <Send className="h-3.5 w-3.5" />
                      {sendingId === doc.id ? "Sending…" : "Send to HOA"}
                    </button>
                    <button type="button" onClick={() => void removeDoc(doc)} className="text-destructive hover:opacity-70">
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Send goes to {hoa?.email || "the HOA email on file"}. Replies land on the email agent for this job number.
            </p>
          </div>
        </div>
      ) : null}

      <HoaModal
        open={addHoaOpen}
        onOpenChange={setAddHoaOpen}
        orgId={orgId}
        hoa={null}
        initialName={addHoaName}
        onSaved={(created) => {
          onHoaCreated(created);
          void patch({ hoa_id: created.id });
        }}
      />
    </div>
  );
}

function RecordLabel({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{children}</p>;
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

function RecordSelect({
  label,
  value,
  onValueChange,
  children,
  display,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  display?: string;
}) {
  return (
    <div className="min-w-0">
      <RecordLabel>{label}</RecordLabel>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={RECORD_TRIGGER} size="sm">
          {display ? <SelectValue>{display}</SelectValue> : <SelectValue />}
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
}: {
  label: string;
  display: string;
  defaultValue: string;
  onSave: (raw: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const empty = !display.trim();
  if (!editing) {
    return (
      <button type="button" className="min-w-0 text-left" onClick={() => setEditing(true)}>
        <RecordLabel>{label}</RecordLabel>
        <p className={`truncate text-base font-semibold ${empty ? "text-muted-foreground" : ""}`}>{empty ? "—" : display}</p>
      </button>
    );
  }
  return (
    <div className="min-w-0">
      <RecordLabel>{label}</RecordLabel>
      <Input
        autoFocus
        defaultValue={defaultValue}
        className="h-8"
        onBlur={(e) => {
          onSave(e.target.value);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    </div>
  );
}
