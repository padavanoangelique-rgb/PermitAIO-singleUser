"use client";

import { useState } from "react";
import { decideProposedUpdate } from "@/lib/actions/proposed-updates";
import { FILL_GREEN, FILL_AMBER } from "@/lib/ui/fills";

export type PendingUpdate = {
  id: string;
  kind: string;
  library: string;
  why: string;
  proposed: Record<string, unknown> | null;
  previous: Record<string, unknown> | null;
  author_label: string | null;
  created_at: string;
};

function show(value: Record<string, unknown> | null) {
  if (!value) return "Nothing on file yet.";
  return Object.entries(value)
    .filter(([key, item]) => key !== "action" && item != null && String(item).trim() !== "")
    .map(([key, item]) => `${key.replaceAll("_", " ")}: ${String(item)}`)
    .join("\n");
}

export function ReviewQueue({ rows }: { rows: PendingUpdate[] }) {
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [gone, setGone] = useState<string[]>([]);
  const visible = rows.filter((row) => !gone.includes(row.id));
  if (!visible.length) return null;

  async function decide(id: string, decision: "added" | "skipped") {
    setBusy(id + decision);
    setNote(null);
    const result = await decideProposedUpdate(id, decision);
    setBusy(null);
    if (result.error) {
      setNote(result.error);
      return;
    }
    setGone((ids) => [...ids, id]);
    setNote(result.message ?? "Done.");
  }

  return (
    <section className="space-y-3 rounded-2xl border border-amber-300/70 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/30">
      <div>
        <h2 className="text-sm font-semibold">Review before it goes in the library</h2>
        <p className="text-xs text-muted-foreground">
          Notes, dates, and Permit Scout pulls are already on the job. These are interpretations. Add to database, or skip.
        </p>
      </div>
      {visible.map((row) => (
        <article key={row.id} className="space-y-2 rounded-xl bg-background p-3">
          <p className="text-sm font-semibold">{row.why}</p>
          <p className="text-xs text-muted-foreground">
            {row.author_label || "Unknown author"} · {new Date(row.created_at).toLocaleString()} · {row.library}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <pre className="whitespace-pre-wrap rounded-xl bg-muted/50 p-2 text-xs">{`Was:\n${show(row.previous)}`}</pre>
            <pre className="whitespace-pre-wrap rounded-xl bg-muted/50 p-2 text-xs">{`Proposed:\n${show(row.proposed)}`}</pre>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void decide(row.id, "added")}
              className={`h-9 rounded-full px-3 text-sm font-semibold ${FILL_GREEN} disabled:opacity-50`}
            >
              {busy === row.id + "added" ? "Adding…" : "Add to database"}
            </button>
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void decide(row.id, "skipped")}
              className={`h-9 rounded-full px-3 text-sm font-semibold ${FILL_AMBER} disabled:opacity-50`}
            >
              Skip
            </button>
          </div>
        </article>
      ))}
      {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
    </section>
  );
}
