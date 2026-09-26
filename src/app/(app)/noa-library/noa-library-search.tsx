"use client";

import { useMemo, useState } from "react";
import type { MergedNoaEntry } from "@/lib/noa/merge";
import { ShieldCheck } from "lucide-react";
import { noaExpiryStatus } from "@/lib/noa/match";
import { NoaRowActions } from "./noa-row-actions";
import { FILL_BLUE, FILL_PURPLE } from "@/lib/ui/fills";
import { DATE_TONE_PILL, expireDateTone, formatEtaDate } from "@/lib/inventory/eta";
import { CountyFold, LIB_PILL, LibrarySearch } from "@/components/libraries/county-fold";
import { NoaPressureEdit } from "./noa-pressure-edit";

export function NoaLibrarySearch({
  entries,
  isAdmin,
}: {
  entries: MergedNoaEntry[];
  isAdmin: boolean;
}) {
  const [q, setQ] = useState("");
  const [openMfrs, setOpenMfrs] = useState<Set<string>>(new Set());

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((e) => {
      const hay = [e.manufacturer, e.window_type, e.series, e.model_number, e.noa_number, e.file_name, e.notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [entries, q]);

  const groups = useMemo(() => {
    const map = new Map<string, MergedNoaEntry[]>();
    for (const e of visible) {
      const key = (e.manufacturer || "Unfiled").trim() || "Unfiled";
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [visible]);

  const expanded = q.trim() ? new Set(groups.map(([name]) => name)) : openMfrs;

  function toggle(name: string) {
    setOpenMfrs((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <LibrarySearch value={q} onChange={setQ} placeholder="Search manufacturer, series, model #, NOA#" />
      <p className="text-sm text-muted-foreground">
        Showing {visible.length} of {entries.length}
        {entries.length === 1 ? " NOA" : " NOAs"}.
      </p>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matches.</p>
      ) : (
        <div className="space-y-1">
          {groups.map(([name, rows]) => (
            <CountyFold
              key={name}
              title={name}
              countLabel={`${rows.length} ${rows.length === 1 ? "NOA" : "NOAs"}`}
              open={expanded.has(name)}
              onToggle={() => toggle(name)}
              tone={FILL_BLUE}
            >
              {rows.map((entry) => (
                <NoaRow key={entry.id} entry={entry} isAdmin={isAdmin} />
              ))}
            </CountyFold>
          ))}
        </div>
      )}
    </div>
  );
}

function NoaRow({ entry, isAdmin }: { entry: MergedNoaEntry; isAdmin: boolean }) {
  const status = noaExpiryStatus(entry);
  const exp = entry.expiration_date;
  const dateTone = exp ? (status === "expired" ? "late" : expireDateTone(exp)) : null;
  return (
    <div className="flex w-full min-w-0 items-center gap-2 rounded-2xl px-2 py-1.5 hover:bg-muted/40">
      <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className={`${LIB_PILL} ${FILL_PURPLE} max-w-[9rem] shrink-0 truncate`}>{entry.noa_number}</span>
      <span className="min-w-0 flex-1 truncate text-sm">
        {entry.series || "All series"}
        {entry.model_number ? ` · ${entry.model_number}` : ""}
        {entry.window_type ? ` · ${entry.window_type}` : ""}
      </span>
      <NoaPressureEdit entry={entry} />
      {exp && dateTone ? (
        <span className={`${DATE_TONE_PILL} shrink-0`}>{formatEtaDate(exp)}</span>
      ) : null}
      {entry.visibility === "org" ? (
        <span className={`${LIB_PILL} shrink-0 bg-muted text-muted-foreground`}>Private</span>
      ) : null}
      {status === "expiring" ? (
        <span className={`${LIB_PILL} shrink-0 bg-amber-500 text-white`}>Expiring</span>
      ) : null}
      {status === "expired" ? (
        <span className={`${LIB_PILL} shrink-0 bg-red-600 text-white`}>Expired</span>
      ) : null}
      <NoaRowActions entry={entry} isAdmin={isAdmin} />
    </div>
  );
}
