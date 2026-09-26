"use client";

import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { addInstallNote } from "./note-actions";
import { checkInstallJob, checkoutInstallPermit, updateInstallPayment } from "./actions";
import type { InstallAssignment, InstallJob, InstallMember } from "./install-dashboard";
import { BTN_BLUE, BTN_GREEN, BTN_PURPLE, FIELD } from "./install-ui";

function formatStamp(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Chip({ children, tone }: { children: React.ReactNode; tone: "blue" | "ink" | "sky" | "muted" | "rose" | "emerald" }) {
  const tones = {
    blue: "bg-primary text-primary-foreground",
    ink: "bg-foreground text-background",
    sky: "border border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100",
    muted: "bg-muted text-muted-foreground",
    rose: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100",
    emerald: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

function personName(m?: InstallMember) {
  if (!m) return "Unassigned";
  return m.display_name?.trim() || m.email.split("@")[0] || m.email;
}

type Note = { id: string; message: string; created_at: string; user_id: string | null; activity_type: string };
type Photo = { id: string; file_name: string; storage_path: string; url: string; uploaded_at: string };

function MoneyRow({
  label,
  checkedName,
  checked,
  amountName,
  amount,
  dateName,
  date,
}: {
  label: string;
  checkedName: string;
  checked: boolean;
  amountName?: string;
  amount?: number | null;
  dateName?: string;
  date?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl px-1 py-1.5">
      <label className="flex min-w-[10rem] flex-1 items-center gap-2 text-sm font-medium">
        <input type="checkbox" name={checkedName} defaultChecked={checked} className="h-4 w-4 rounded border-input" />
        {label}
      </label>
      {amountName ? (
        <label className="text-xs text-muted-foreground">
          Amount
          <input
            type="number"
            step="0.01"
            name={amountName}
            defaultValue={amount ?? ""}
            placeholder="$"
            className={FIELD}
          />
        </label>
      ) : null}
      {dateName ? (
        <label className="text-xs text-muted-foreground">
          Date
          <input
            type="date"
            name={dateName}
            defaultValue={date ?? ""}
            className={FIELD}
          />
        </label>
      ) : null}
    </div>
  );
}

function MoneySection({ job, assignment }: { job: InstallJob; assignment?: InstallAssignment }) {
  return (
    <section className="space-y-3 px-1 py-2">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Money</h2>
      <form action={updateInstallPayment} className="space-y-2">
        <input type="hidden" name="jobId" value={job.id} />
        <input type="hidden" name="jobNumber" value={job.job_number} />
        <MoneyRow
          label="Deposit collected"
          checkedName="depositCollected"
          checked={!!assignment?.deposit_collected}
          amountName="depositAmount"
          amount={assignment?.deposit_amount}
          dateName="depositDate"
          date={assignment?.deposit_date}
        />
        <MoneyRow label="Change order" checkedName="changeOrder" checked={!!assignment?.change_order} />
        <MoneyRow label="Contract signed" checkedName="contractSigned" checked={!!assignment?.contract_signed} />
        <MoneyRow
          label="Final payment collected"
          checkedName="finalPaymentCollected"
          checked={!!assignment?.final_payment_collected}
          amountName="finalPaymentAmount"
          amount={assignment?.final_payment_amount}
          dateName="finalPaymentDate"
          date={assignment?.final_payment_date}
        />
        <button type="submit" className={BTN_BLUE}>
          Save money
        </button>
      </form>
    </section>
  );
}

export function InstallJobDetail({
  job,
  assignment,
  installer,
  pm,
  orgId,
  canManage,
  canCheck,
  onBack,
  embedded,
}: {
  job: InstallJob;
  assignment?: InstallAssignment;
  installer?: InstallMember;
  pm?: InstallMember;
  orgId: string;
  canManage: boolean;
  canCheck: boolean;
  onBack?: () => void;
  embedded?: boolean;
}) {
  const [officeNotes, setOfficeNotes] = useState<Note[]>([]);
  const [installerNotes, setInstallerNotes] = useState<Note[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [officeDraft, setOfficeDraft] = useState("");
  const [installerDraft, setInstallerDraft] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const insp = assignment?.inspection_date
    ? /^\d{4}-\d{2}-\d{2}$/.test(assignment.inspection_date)
      ? assignment.inspection_date
      : new Date(assignment.inspection_date).toISOString().slice(0, 10)
    : "";

  useEffect(() => {
    void load();
  }, [job.id]);

  async function load() {
    const supabase = createClient();
    const { data: notes } = await supabase
      .from("job_activity")
      .select("id, message, created_at, user_id, activity_type")
      .eq("org_id", orgId)
      .eq("job_id", job.id)
      .in("activity_type", ["office_note", "installer_note"])
      .order("created_at", { ascending: false });
    setOfficeNotes((notes ?? []).filter((n) => n.activity_type === "office_note"));
    setInstallerNotes((notes ?? []).filter((n) => n.activity_type === "installer_note"));
    const { data: files } = await supabase
      .from("job_files")
      .select("id, file_name, storage_path, uploaded_at")
      .eq("org_id", orgId)
      .eq("job_id", job.id)
      .eq("category", "install-photo")
      .order("uploaded_at", { ascending: false });
    const next: Photo[] = [];
    for (const file of files ?? []) {
      const { data } = await supabase.storage.from("job-files").createSignedUrl(file.storage_path, 3600);
      if (data?.signedUrl) {
        next.push({
          id: file.id,
          file_name: file.file_name,
          storage_path: file.storage_path,
          url: data.signedUrl,
          uploaded_at: file.uploaded_at,
        });
      }
    }
    setPhotos(next);
  }

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    setBusy("Uploading…");
    const supabase = createClient();
    const safe = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${job.id}/install-photos/${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage.from("job-files").upload(path, file, { contentType: file.type });
    if (upErr) {
      setBusy(upErr.message);
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    const { error: insErr } = await supabase.from("job_files").insert({
      org_id: orgId,
      job_id: job.id,
      file_name: caption.trim() || file.name,
      storage_path: path,
      size_bytes: file.size,
      uploaded_by: auth.user?.id ?? null,
      category: "install-photo",
    });
    setBusy(insErr?.message ?? "");
    setCaption("");
    await load();
  }

  return (
    <div className="space-y-5">
      {onBack && !embedded ? (
        <button type="button" onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">
          ← Overview
        </button>
      ) : null}
      {embedded ? null : (
        <header>
          <p className="font-mono text-xs tabular-nums text-muted-foreground">{job.job_number}</p>
          <h1 className="font-heading text-3xl">{job.client_name}</h1>
          <p className="text-sm text-muted-foreground">{[job.address, job.city].filter(Boolean).join(", ") || "No address"}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {assignment?.permit_checked_out_at ? <Chip tone="blue">Permit out</Chip> : <Chip tone="muted">Permit in office</Chip>}
            {assignment?.pm_checked_at ? <Chip tone="ink">PM checked in</Chip> : <Chip tone="muted">No PM check</Chip>}
            {assignment?.inspection_result === "passed" ? (
              <Chip tone="emerald">Passed</Chip>
            ) : assignment?.inspection_result === "failed" ? (
              <Chip tone="rose">Failed</Chip>
            ) : insp ? (
              <Chip tone="sky">Inspection {insp}</Chip>
            ) : (
              <Chip tone="muted">No inspection</Chip>
            )}
            {assignment?.final_payment_collected ? (
              <Chip tone="emerald">Paid in full</Chip>
            ) : assignment?.deposit_collected ? (
              <Chip tone="sky">Deposit in</Chip>
            ) : (
              <Chip tone="muted">No payment yet</Chip>
            )}
          </div>
        </header>
      )}
      <div className="flex flex-wrap gap-2">
        {canManage ? (
          <form action={checkoutInstallPermit}>
            <input type="hidden" name="jobId" value={job.id} />
            <input type="hidden" name="jobNumber" value={job.job_number} />
            <button className={BTN_PURPLE} type="submit">
              {assignment?.permit_checked_out_at ? "Permit already out" : "Checked out permit"}
            </button>
          </form>
        ) : null}
        {canCheck ? (
          <form action={checkInstallJob}>
            <input type="hidden" name="jobId" value={job.id} />
            <input type="hidden" name="jobNumber" value={job.job_number} />
            <button className={BTN_GREEN} type="submit">
              {assignment?.pm_checked_at ? "PM check again" : "PM check in"}
            </button>
          </form>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="px-1 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Installer</p>
          <p className="mt-1 font-heading text-lg">{personName(installer)}</p>
          <p className="text-sm text-muted-foreground">{installer?.company_name || "Unassigned"}</p>
        </div>
        <div className="px-1 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Project manager</p>
          <p className="mt-1 font-heading text-lg">{personName(pm)}</p>
          <p className="text-sm text-muted-foreground">
            {assignment?.pm_checked_at ? `In ${formatStamp(assignment.pm_checked_at)}` : "No check-in yet"}
          </p>
        </div>
        <div className="px-1 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Permit</p>
          <p className="mt-1 font-heading text-lg">{assignment?.permit_checked_out_at ? "Out" : "In office"}</p>
          <p className="text-sm text-muted-foreground">
            {assignment?.permit_checked_out_at
              ? `Checked out ${formatStamp(assignment.permit_checked_out_at)}`
              : "Install manager stamps when the card leaves the office"}
          </p>
        </div>
      </div>
      {canManage ? <MoneySection job={job} assignment={assignment} /> : null}
      <NoteBlock title="Office notes" placeholder="Gate codes, dogs, HOA color hold…" button="Add office note" draft={officeDraft} setDraft={setOfficeDraft} notes={officeNotes} jobId={job.id} kind="office" />
      <NoteBlock title="Installer notes" placeholder="Site conditions, missing material, opening notes…" button="Add installer note" draft={installerDraft} setDraft={setInstallerDraft} notes={installerNotes} jobId={job.id} kind="installer" />
      <section className="space-y-3 px-1 py-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Photos</h2>
        <div className="flex flex-wrap gap-2">
          <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption — opening number, room" className="min-w-[16rem] flex-1 rounded-full border border-border bg-background px-3 py-2 text-sm" />
          <button type="button" onClick={() => fileRef.current?.click()} className={BTN_BLUE}>
            <Camera className="h-4 w-4" /> Add photo
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { void uploadPhoto(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        {busy ? <p className="text-xs text-muted-foreground">{busy}</p> : null}
        {photos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No photos on this job yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {photos.map((photo) => (
              <figure key={photo.id} className="overflow-hidden rounded-lg border">
                <img src={photo.url} alt={photo.file_name} className="aspect-video w-full object-cover bg-muted" />
                <figcaption className="px-3 py-2 text-sm">
                  <p className="font-medium">{photo.file_name}</p>
                  <p className="text-xs text-muted-foreground">{formatStamp(photo.uploaded_at)}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>
      <section className="space-y-2 px-1 py-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Check-ins</h2>
        {assignment?.pm_checked_at || assignment?.permit_checked_out_at ? (
          <ul className="mt-3 divide-y text-sm">
            {assignment?.pm_checked_at ? (
              <li className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">PM checked job</p>
                  <p className="text-muted-foreground">{assignment.pm_checked_by || personName(pm)}</p>
                </div>
                <div className="text-right">
                  <Chip tone="ink">PM</Chip>
                  <p className="mt-1 text-xs text-muted-foreground">{formatStamp(assignment.pm_checked_at)}</p>
                </div>
              </li>
            ) : null}
            {assignment?.permit_checked_out_at ? (
              <li className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">Permit checked out</p>
                  <p className="text-muted-foreground">{assignment.permit_checked_out_by || "Install manager"}</p>
                </div>
                <div className="text-right">
                  <Chip tone="blue">Permit</Chip>
                  <p className="mt-1 text-xs text-muted-foreground">{formatStamp(assignment.permit_checked_out_at)}</p>
                </div>
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No stamps yet.</p>
        )}
      </section>
    </div>
  );
}

function NoteBlock({
  title, placeholder, button, draft, setDraft, notes, jobId, kind,
}: {
  title: string; placeholder: string; button: string; draft: string; setDraft: (v: string) => void; notes: Note[]; jobId: string; kind: "office" | "installer";
}) {
  return (
    <section className="space-y-3 px-1 py-2">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
      <form action={addInstallNote} className="space-y-2">
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="kind" value={kind} />
        <textarea name="message" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <button type="submit" className={BTN_BLUE}>{button}</button>
      </form>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No {kind} notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <p>{note.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatStamp(note.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
