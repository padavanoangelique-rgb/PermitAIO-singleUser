"use client";

import { useMemo, useState, useTransition } from "react";
import { type FormCounty } from "@/lib/forms/folio";
import { ALL_JURISDICTIONS } from "@/lib/forms/jurisdictions";
import { DOC_TYPE_LABELS } from "@/lib/forms/match";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Pencil } from "lucide-react";
import {
  createPlatformRequirement,
  updatePlatformRequirement,
  deletePlatformRequirement,
} from "@/lib/actions/platform-requirements";

export interface RequirementRow {
  id: number;
  county: string | null;
  jurisdiction: string;
  jurisdiction_code: string | null;
  doc_type: string;
  title: string;
  notes: string | null;
  trade: string;
  visibility: string;
}

const DOC_TYPES = Object.keys(DOC_TYPE_LABELS);
const TRADES = ["windows_doors", "roofing", "general"] as const;

const COUNTYWIDE_SENTINEL = "__countywide__";

interface FormState {
  county: string;
  jurisdiction: string; // sentinel or a real jurisdiction name
  title: string;
  docType: string;
  trade: string;
  notes: string;
}

const emptyForm: FormState = {
  county: "",
  jurisdiction: "",
  title: "",
  docType: "other",
  trade: "windows_doors",
  notes: "",
};

function resolveJurisdiction(f: FormState): string {
  return f.jurisdiction === COUNTYWIDE_SENTINEL
    ? `${f.county} County`
    : f.jurisdiction.trim();
}

export function RequirementsManager({
  counties,
  rows,
}: {
  counties: readonly FormCounty[];
  rows: RequirementRow[];
}) {
  const [query, setQuery] = useState("");
  const [countyFilter, setCountyFilter] = useState<string>("all");
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<RequirementRow | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (countyFilter !== "all" && r.county !== countyFilter) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.jurisdiction.toLowerCase().includes(q) ||
        (r.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, countyFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, RequirementRow[]>();
    for (const r of filtered) {
      const key = r.county ?? "Uncategorized";
      const bucket = map.get(key);
      if (bucket) bucket.push(r);
      else map.set(key, [r]);
    }
    return map;
  }, [filtered]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="req-search" className="text-xs">
              Search
            </Label>
            <Input
              id="req-search"
              placeholder="Title, jurisdiction, notes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-72"
            />
          </div>
          <div>
            <Label className="text-xs">County</Label>
            <Select value={countyFilter} onValueChange={setCountyFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All counties</SelectItem>
                {counties.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{filtered.length} rows</Badge>
          <Button onClick={() => setOpenNew(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add requirement
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {grouped.size === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No requirements match. Add one, or clear filters.
          </div>
        ) : (
          Array.from(grouped.entries()).map(([county, list]) => (
            <div key={county} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {county}
                <span className="ml-2 font-normal">({list.length})</span>
              </h2>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Jurisdiction</th>
                      <th className="px-3 py-2 font-medium">Title</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Trade</th>
                      <th className="px-3 py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-3 py-2 align-top">{r.jurisdiction}</td>
                        <td className="px-3 py-2 align-top">
                          <div className="font-medium">{r.title}</div>
                          {r.notes && (
                            <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {r.notes}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Badge variant="secondary" className="whitespace-nowrap">
                            {DOC_TYPE_LABELS[r.doc_type] ?? r.doc_type}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Badge variant="outline" className="whitespace-nowrap">
                            {r.trade}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setEditing(r)}
                              aria-label="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <DeleteButton id={r.id} title={r.title} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      <RequirementDialog
        open={openNew}
        onOpenChange={setOpenNew}
        mode="new"
        counties={counties}
      />
      <RequirementDialog
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
        mode="edit"
        counties={counties}
        row={editing}
      />
    </>
  );
}

function DeleteButton({ id, title }: { id: number; title: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="icon"
      variant="ghost"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`Delete "${title}"? This affects every organization.`)) return;
        startTransition(async () => {
          const res = await deletePlatformRequirement(id);
          if (res.error) toast.error(res.error);
          else toast.success("Deleted");
        });
      }}
      aria-label="Delete"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4 text-destructive" />
      )}
    </Button>
  );
}

function RequirementDialog({
  open,
  onOpenChange,
  mode,
  counties,
  row,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "new" | "edit";
  counties: readonly FormCounty[];
  row?: RequirementRow | null;
}) {
  // Seed the form from the row on each open. useState with initializer
  // only runs once, so keep it in sync via a keyed component: we
  // re-derive on every open via the `open` toggle in a small effect.
  const initial: FormState =
    mode === "edit" && row
      ? {
          county: row.county ?? "",
          jurisdiction:
            row.county && row.jurisdiction === `${row.county} County`
              ? COUNTYWIDE_SENTINEL
              : row.jurisdiction,
          title: row.title,
          docType: row.doc_type,
          trade: row.trade,
          notes: row.notes ?? "",
        }
      : emptyForm;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      // Force a fresh RequirementForm mount on each open so `useState`
      // picks up the current `row` seed cleanly without a useEffect.
      key={mode === "edit" ? `edit-${row?.id ?? "none"}-${open}` : `new-${open}`}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "new" ? "Add requirement" : "Edit requirement"}
          </DialogTitle>
          <DialogDescription>
            Platform-wide row — every organization sees this on the
            Requirements &amp; Forms page.
          </DialogDescription>
        </DialogHeader>
        <RequirementForm
          initial={initial}
          counties={counties}
          onCancel={() => onOpenChange(false)}
          onSubmit={async (state) => {
            const jurisdiction = resolveJurisdiction(state);
            if (!state.county) return "Pick a county.";
            if (!jurisdiction) return "Pick a jurisdiction.";
            if (!state.title.trim()) return "Enter a title.";
            const payload = {
              county: state.county,
              jurisdiction,
              title: state.title,
              docType: state.docType,
              trade: state.trade,
              notes: state.notes,
            };
            const res =
              mode === "new"
                ? await createPlatformRequirement(payload)
                : await updatePlatformRequirement(row!.id, payload);
            if (res.error) return res.error;
            onOpenChange(false);
            return null;
          }}
          submitLabel={mode === "new" ? "Add requirement" : "Save changes"}
        />
      </DialogContent>
    </Dialog>
  );
}

function RequirementForm({
  initial,
  counties,
  onCancel,
  onSubmit,
  submitLabel,
}: {
  initial: FormState;
  counties: readonly FormCounty[];
  onCancel: () => void;
  onSubmit: (state: FormState) => Promise<string | null>;
  submitLabel: string;
}) {
  const [state, setState] = useState<FormState>(initial);
  const [isPending, startTransition] = useTransition();

  const jurisdictionOptions =
    state.county && state.county in ALL_JURISDICTIONS
      ? ALL_JURISDICTIONS[state.county as FormCounty]
      : [];

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setState((s) => ({ ...s, [k]: v }));
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const err = await onSubmit(state);
          if (err) toast.error(err);
          else toast.success("Saved");
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">County</Label>
          <Select
            value={state.county}
            onValueChange={(v) => {
              setField("county", v);
              // Reset jurisdiction when county changes so it doesn't
              // stay on a city that belongs to a different county.
              setField("jurisdiction", "");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pick a county" />
            </SelectTrigger>
            <SelectContent>
              {counties.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Jurisdiction</Label>
          <Select
            value={state.jurisdiction}
            onValueChange={(v) => setField("jurisdiction", v)}
            disabled={!state.county}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pick a jurisdiction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={COUNTYWIDE_SENTINEL}>
                {state.county ? `${state.county} County (countywide)` : "County-wide"}
              </SelectItem>
              {jurisdictionOptions.map((j) => (
                <SelectItem key={j} value={j}>
                  {j}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Title</Label>
        <Input
          placeholder="e.g. Coral Springs Windows & Doors Retrofit Permit Application Checklist"
          value={state.title}
          onChange={(e) => setField("title", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Doc type</Label>
          <Select value={state.docType} onValueChange={(v) => setField("docType", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map((d) => (
                <SelectItem key={d} value={d}>
                  {DOC_TYPE_LABELS[d]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Trade</Label>
          <Select value={state.trade} onValueChange={(v) => setField("trade", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRADES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Notes</Label>
        <Textarea
          placeholder="Contact info, checklist details, source URLs — anything you'd want the org user to see on the Requirements & Forms page."
          value={state.notes}
          onChange={(e) => setField("notes", e.target.value)}
          rows={6}
        />
        <p className="text-xs text-muted-foreground">
          Paste URLs directly — they auto-linkify on the public page.
        </p>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
