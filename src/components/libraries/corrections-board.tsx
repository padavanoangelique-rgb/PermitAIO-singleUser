"use client";

import { useState } from "react";
import { proposeLibraryCorrection } from "@/lib/actions/proposed-updates";
import { FILL_AMBER, FILL_PURPLE } from "@/lib/ui/fills";

export type CorrectionRow = {
  id: string;
  jurisdiction: string | null;
  correction: string;
  resolution: string | null;
  job_number: string | null;
  cross_ref: string | null;
  original_submission: string | null;
  approval_ground_truth: string | null;
  scope: string;
  status: string;
  version: number;
  author_label: string | null;
  updated_at: string;
};

export type VersionRow = {
  entry_id: string;
  version: number;
  change_note: string | null;
  author_label: string | null;
  created_at: string;
  snapshot: Record<string, unknown>;
};

const FIELD = "w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm";

export function CorrectionsBoard({ rows, versions }: { rows: CorrectionRow[]; versions: VersionRow[] }) {
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const published = rows.filter((row) => row.status === "published");
  const held = rows.filter((row) => row.status === "held");

  async function submit(form: HTMLFormElement) {
    setBusy(true);
    setNote(null);
    const result = await proposeLibraryCorrection(new FormData(form));
    setBusy(false);
    if (result.error) {
      setNote(result.error);
      return;
    }
    setNote(result.message ?? "Submitted.");
    form.reset();
  }

  return (
    <div className="space-y-6">
      <form
        className="space-y-3 rounded-2xl border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(e.currentTarget);
        }}
      >
        <div>
          <h2 className="text-sm font-semibold">New correction</h2>
          <p className="text-xs text-muted-foreground">
            This does not publish. A person adds it or skips it. Job corrections stay on that job. Flag a jurisdiction lesson only when the same mistake repeats.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="jurisdiction" placeholder="Jurisdiction (Miramar, Wellington, Palm Beach County Unincorporated)" className={FIELD} />
          <input name="jobNumber" placeholder="Job number" className={FIELD} />
        </div>
        <textarea name="correction" required rows={3} placeholder="What the correction is" className={FIELD} />
        <textarea name="resolution" rows={3} placeholder="How it was resolved" className={FIELD} />
        <textarea name="crossRef" rows={2} placeholder="Cross-reference if other jurisdictions share this requirement" className={FIELD} />
        <textarea name="originalSubmission" rows={2} placeholder="Original submission — what was in the ZIP / what was filed" className={FIELD} />
        <textarea name="approvalGroundTruth" rows={2} placeholder="Approved permit ground truth, including conditions on the approval letter" className={FIELD} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="scope" value="jurisdiction" />
          Flag as a jurisdiction lesson
        </label>
        <input type="hidden" name="action" value="create" />
        <input type="hidden" name="why" value="New corrections library entry." />
        <button type="submit" disabled={busy} className={`h-9 rounded-full px-4 text-sm font-semibold ${FILL_PURPLE} disabled:opacity-50`}>
          {busy ? "Submitting…" : "Submit for review"}
        </button>
        {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
      </form>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Published ({published.length})</h2>
        {published.length === 0 ? <p className="text-sm text-muted-foreground">Nothing published for this company yet.</p> : null}
        {published.map((row) => (
          <CorrectionCard key={row.id} row={row} versions={versions.filter((v) => v.entry_id === row.id)} />
        ))}
      </section>

      {held.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Held by the weekly check ({held.length})</h2>
          <p className="text-xs text-muted-foreground">Desks cannot see these until a corrected copy is added.</p>
          {held.map((row) => (
            <CorrectionCard key={row.id} row={row} versions={versions.filter((v) => v.entry_id === row.id)} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function CorrectionCard({ row, versions }: { row: CorrectionRow; versions: VersionRow[] }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  return (
    <article className="space-y-2 rounded-2xl border p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {row.jurisdiction || "Jurisdiction not tagged"} · {row.scope === "jurisdiction" ? "jurisdiction lesson" : "this job"} · v{row.version}
        {row.job_number ? ` · job ${row.job_number}` : ""}
      </p>
      <p className="text-sm">{row.correction}</p>
      <p className="text-sm text-muted-foreground">{row.resolution || "How it was resolved is not on file."}</p>
      {row.cross_ref ? <p className="text-xs">Cross-reference: {row.cross_ref}</p> : null}
      {row.original_submission ? <p className="text-xs">Original submission: {row.original_submission}</p> : null}
      {row.approval_ground_truth ? <p className="text-xs">Approval letter: {row.approval_ground_truth}</p> : null}
      <p className="text-xs text-muted-foreground">
        {row.author_label || "Unknown author"} · {row.updated_at ? new Date(row.updated_at).toLocaleString() : ""}
      </p>
      {versions.length ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {versions.map((version) => (
            <li key={`${version.entry_id}-${version.version}`}>
              v{version.version} · {version.author_label || "unknown"} · {new Date(version.created_at).toLocaleString()}
              {version.change_note ? ` · ${version.change_note}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" onClick={() => setOpen((v) => !v)} className={`h-8 rounded-full px-3 text-xs font-semibold ${FILL_AMBER}`}>
        {open ? "Close" : "Propose a change"}
      </button>
      {open ? (
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const result = await proposeLibraryCorrection(new FormData(form));
            setNote(result.error || result.message || "Submitted.");
            if (!result.error) setOpen(false);
          }}
        >
          <input type="hidden" name="entryId" value={row.id} />
          <input type="hidden" name="action" value="update" />
          <input type="hidden" name="why" value={`Update version ${row.version}.`} />
          <input name="jurisdiction" defaultValue={row.jurisdiction ?? ""} className={FIELD} />
          <input name="jobNumber" defaultValue={row.job_number ?? ""} className={FIELD} />
          <textarea name="correction" required defaultValue={row.correction} rows={3} className={FIELD} />
          <textarea name="resolution" defaultValue={row.resolution ?? ""} rows={2} className={FIELD} />
          <textarea name="crossRef" defaultValue={row.cross_ref ?? ""} rows={2} className={FIELD} />
          <textarea name="originalSubmission" defaultValue={row.original_submission ?? ""} rows={2} className={FIELD} />
          <textarea name="approvalGroundTruth" defaultValue={row.approval_ground_truth ?? ""} rows={2} className={FIELD} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="scope" value="jurisdiction" defaultChecked={row.scope === "jurisdiction"} />
            Jurisdiction lesson
          </label>
          <button type="submit" className={`h-9 rounded-full px-4 text-sm font-semibold ${FILL_PURPLE}`}>
            Submit change for review
          </button>
        </form>
      ) : null}
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </article>
  );
}
