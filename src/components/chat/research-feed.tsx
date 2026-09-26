"use client";

import { useState } from "react";
import { feedResearchReport } from "@/lib/actions/research-reports";
import { FILL_BLUE, FILL_PURPLE } from "@/lib/ui/fills";

export function ResearchFeed() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex h-9 items-center rounded-full px-3.5 text-sm font-semibold shadow-sm ${FILL_BLUE}`}
      >
        Feed a research report
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
        const result = await feedResearchReport(new FormData(form));
        setBusy(false);
        if (result.error) {
          setNote(result.error);
          return;
        }
        setNote(result.message ?? "Saved.");
        form.reset();
      }}
    >
      <p className="text-sm font-semibold">Initial report</p>
      <p className="text-xs text-muted-foreground">
        Paste what Investigator or the Permit Form Specialist compiled. It waits for Add to database before any desk can use it.
      </p>
      <select name="agent" className="h-10 w-full rounded-full border border-border px-3 text-sm" defaultValue="investigator">
        <option value="investigator">Investigator</option>
        <option value="forms_specialist">Permit Form Specialist</option>
      </select>
      <input name="county" placeholder="County (Broward, Miami-Dade, Palm Beach)" className="h-10 w-full rounded-full border border-border px-3 text-sm" />
      <input name="jurisdiction" placeholder="City (optional)" className="h-10 w-full rounded-full border border-border px-3 text-sm" />
      <input name="title" placeholder="Report title" className="h-10 w-full rounded-full border border-border px-3 text-sm" />
      <textarea name="body" rows={8} placeholder="Paste the report…" className="w-full rounded-2xl border border-border px-3 py-2 text-sm" required />
      {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={`h-9 rounded-full px-4 text-sm font-semibold ${FILL_PURPLE} disabled:opacity-50`}>
          {busy ? "Saving…" : "Submit for review"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-full px-3 text-sm text-muted-foreground">
          Close
        </button>
      </div>
    </form>
  );
}
