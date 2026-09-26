"use client";

import { useState } from "react";
import { feedCorrectionLesson } from "@/lib/actions/correction-lessons";
import { FILL_AMBER, FILL_PURPLE } from "@/lib/ui/fills";

export function CorrectionFeed({
  jobId,
  jobNumber,
  jurisdiction,
  trade,
}: {
  jobId?: string | null;
  jobNumber?: string | null;
  jurisdiction?: string | null;
  trade?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex h-9 items-center rounded-full px-3.5 text-sm font-semibold shadow-sm ${FILL_AMBER}`}
      >
        Feed a correction
      </button>
    );
  }

  return (
    <form
      className="space-y-2 rounded-2xl border bg-background p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setNote(null);
        const form = e.currentTarget;
        const result = await feedCorrectionLesson(new FormData(form));
        setBusy(false);
        if (result.error) {
          setNote(result.error);
          return;
        }
        setNote(result.message ?? "Saved.");
        form.reset();
      }}
    >
      <p className="text-sm font-semibold">Feed a correction</p>
      <p className="text-xs text-muted-foreground">
        The note and the letter go on the job now. The library copy waits for Add to database. Check the box only if this same mistake should be a jurisdiction lesson.
      </p>
      {jobId ? <input type="hidden" name="jobId" value={jobId} /> : null}
      {jurisdiction ? <input type="hidden" name="jurisdiction" value={jurisdiction} /> : null}
      {trade ? <input type="hidden" name="trade" value={trade} /> : null}
      {!jobId ? (
        <input
          name="jobNumber"
          placeholder="Job #"
          defaultValue={jobNumber ?? ""}
          className="h-10 w-full rounded-full border border-border px-3 text-sm"
        />
      ) : (
        <input type="hidden" name="jobNumber" value={jobNumber ?? ""} />
      )}
      <textarea
        name="asked"
        rows={3}
        placeholder="What the city asked…"
        className="w-full rounded-2xl border border-border px-3 py-2 text-sm"
      />
      <textarea
        name="cleared"
        rows={2}
        placeholder="What cleared it (if you know)…"
        className="w-full rounded-2xl border border-border px-3 py-2 text-sm"
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="jurisdictionLesson" value="yes" />
        Flag as a jurisdiction lesson (same mistake on more than this job)
      </label>
      <input name="letter" type="file" accept="application/pdf,image/*,.doc,.docx,.txt" className="block w-full text-sm" />
      {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className={`h-9 rounded-full px-4 text-sm font-semibold ${FILL_PURPLE} disabled:opacity-50`}
        >
          {busy ? "Saving…" : "Submit for review"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-9 rounded-full px-3 text-sm text-muted-foreground"
        >
          Close
        </button>
      </div>
    </form>
  );
}
