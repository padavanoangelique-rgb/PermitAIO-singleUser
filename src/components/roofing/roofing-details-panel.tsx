"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { loadNoaLibraryEffective } from "@/lib/noa/load";
import type { Tables } from "@/lib/supabase/types";
import {
  ROOF_COVERING_TYPES,
  ROOF_SHAPES,
  ROOFING_COMPONENT_TYPE_LABELS,
  ROOFING_COMPONENT_TYPES_BY_COVERING,
  roofCoveringFromTrade,
  type RoofCoveringType,
} from "@/lib/jobs/trade";
import { matchRoofingComponents, noaExpiryStatus, type NoaLibraryRow } from "@/lib/noa/match";
import { upsertJobRoofingDetails, saveJobRoofingComponents } from "@/lib/actions/roofing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HardHat, Loader2, Plus, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";

type Job = Tables<"jobs">;
type JobRoofingComponent = Tables<"job_roofing_components">;

interface ComponentRow {
  id: string;
  component_type: string;
  manufacturer: string;
  product: string;
  noa_number_hint: string;
}

function defaultComponentsFor(covering: RoofCoveringType | ""): ComponentRow[] {
  if (!covering) return [];
  return ROOFING_COMPONENT_TYPES_BY_COVERING[covering].map((t) => ({
    id: crypto.randomUUID(),
    component_type: t.value,
    manufacturer: "",
    product: "",
    noa_number_hint: "",
  }));
}

function expiryBadge(row: NoaLibraryRow) {
  const status = noaExpiryStatus(row);
  if (status === "expired") return <Badge variant="destructive" className="text-xs">Expired</Badge>;
  if (status === "expiring")
    return <Badge className="bg-amber-500 text-xs text-white hover:bg-amber-500">Expiring soon</Badge>;
  return null;
}

export function RoofingDetailsPanel({ job }: { job: Job }) {
  const [loading, setLoading] = useState(true);
  const [covering, setCovering] = useState<RoofCoveringType | "">("");
  const [shape, setShape] = useState("");
  const [height, setHeight] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<ComponentRow[]>([]);
  const [library, setLibrary] = useState<NoaLibraryRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [detailsRes, componentsRes, lib] = await Promise.all([
      supabase.from("job_roofing_details").select("*").eq("job_id", job.id).maybeSingle(),
      supabase
        .from("job_roofing_components")
        .select("*")
        .eq("job_id", job.id)
        .order("sort_order", { ascending: true }),
      // Platform + this-org rows, with private pressure overrides merged in.
      loadNoaLibraryEffective(supabase),
    ]);

    const d = detailsRes.data;
    const inferredCovering = roofCoveringFromTrade(job.trade_type);
    const resolvedCovering = (d?.roof_covering_type as RoofCoveringType | null) ?? inferredCovering ?? "";
    setCovering(resolvedCovering);
    setShape(d?.roof_shape ?? "");
    setHeight(d?.mean_roof_height ?? "");
    setNotes(d?.notes ?? "");

    const existing: JobRoofingComponent[] = componentsRes.data ?? [];
    if (existing.length > 0) {
      setRows(
        existing.map((c) => ({
          id: c.id,
          component_type: c.component_type,
          manufacturer: c.manufacturer ?? "",
          product: c.product ?? "",
          noa_number_hint: c.noa_number_hint ?? "",
        })),
      );
    } else {
      setRows(defaultComponentsFor(resolvedCovering));
    }

    setLibrary(lib as NoaLibraryRow[]);
    setLoading(false);
  }, [job.id, job.org_id, job.trade_type]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleCoveringChange(next: RoofCoveringType) {
    setCovering(next);
    // Only replace the rows with the covering's defaults if nothing has
    // been filled in yet, so switching covering type by mistake doesn't
    // wipe data the user already entered.
    const hasData = rows.some((r) => r.manufacturer.trim() || r.product.trim() || r.noa_number_hint.trim());
    if (!hasData) setRows(defaultComponentsFor(next));
  }

  function addRow() {
    setRows((r) => [
      ...r,
      { id: crypto.randomUUID(), component_type: "fasteners", manufacturer: "", product: "", noa_number_hint: "" },
    ]);
  }

  function removeRow(id: string) {
    setRows((r) => r.filter((row) => row.id !== id));
  }

  function updateRow(id: string, patch: Partial<ComponentRow>) {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  const matched = useMemo(
    () =>
      matchRoofingComponents(
        rows.map((r) => ({
          id: r.id,
          component_type: r.component_type,
          manufacturer: r.manufacturer,
          product: r.product,
          noa_number_hint: r.noa_number_hint,
        })),
        library,
      ),
    [rows, library],
  );
  const matchById = useMemo(() => new Map(matched.map((m) => [m.id, m])), [matched]);

  const componentTypeOptions = covering ? ROOFING_COMPONENT_TYPES_BY_COVERING[covering] : [];

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    const detailsRes = await upsertJobRoofingDetails(job.id, {
      roof_covering_type: covering,
      roof_shape: shape,
      mean_roof_height: height,
      notes,
    });
    if (detailsRes.error) {
      setSaving(false);
      setSaveError(detailsRes.error);
      return;
    }
    const componentsRes = await saveJobRoofingComponents(
      job.id,
      rows.map((r, i) => ({
        id: r.id,
        component_type: r.component_type,
        manufacturer: r.manufacturer,
        product: r.product,
        noa_number_hint: r.noa_number_hint,
        sort_order: i,
      })),
    );
    setSaving(false);
    if (componentsRes.error) {
      setSaveError(componentsRes.error);
      return;
    }
    setSavedAt(Date.now());
    void load();
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="gap-2 py-4">
        <CardHeader className="px-5 py-0">
          <CardTitle className="flex items-center gap-2 text-base font-heading">
            <HardHat className="h-4 w-4 text-muted-foreground" />
            Roofing Details
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Tile, shingle, and metal roofs each have different permit
            requirements. Set the covering type below, then fill in the
            materials so the NOA Downloader can match them automatically.
            HVHZ-specific fields for Broward, Miami-Dade, and Palm Beach will
            be added here once those county forms are uploaded.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 px-5 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Roof covering type
            </Label>
            <Select value={covering || undefined} onValueChange={(v) => handleCoveringChange(v as RoofCoveringType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select covering type" />
              </SelectTrigger>
              <SelectContent>
                {ROOF_COVERING_TYPES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Roof shape
            </Label>
            <Select value={shape || undefined} onValueChange={setShape}>
              <SelectTrigger>
                <SelectValue placeholder="Hip / Gable / Flat" />
              </SelectTrigger>
              <SelectContent>
                {ROOF_SHAPES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Mean roof height
            </Label>
            <Input value={height} onChange={(e) => setHeight(e.target.value)} placeholder="e.g. 22 ft" />
          </div>
        </CardContent>
        <CardContent className="px-5 pt-0">
          <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            HVHZ notes (temporary — will be replaced with structured fields)
          </Label>
          <Textarea
            className="mt-1.5"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Deck type, layers, tear-off vs. recover, or anything else the HVHZ forms will need"
          />
        </CardContent>
      </Card>

      {!covering ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <TriangleAlert className="h-6 w-6" />
            <p className="text-sm">Pick a roof covering type above to add materials and match NOAs.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-2 py-4">
          <CardHeader className="px-5 py-0">
            <CardTitle className="text-base font-heading">Materials &amp; NOA matching</CardTitle>
            <p className="text-sm text-muted-foreground">
              Enter the manufacturer and product/series for each component —
              matched automatically against your{" "}
              <Link href="/libraries?tab=noa" className="underline">
                NOA Library
              </Link>
              , the same way window/door schedules are matched.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 px-5">
            {rows.map((row) => {
              const match = matchById.get(row.id);
              const bestMatch = match?.matches.find((m) => m.storage_path) ?? match?.matches[0];
              return (
                <div key={row.id} className="rounded-lg border p-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_1.3fr_1.3fr_1fr_auto]">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Component
                      </Label>
                      <Select
                        value={row.component_type}
                        onValueChange={(v) => updateRow(row.id, { component_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[...componentTypeOptions, { value: "fasteners", label: "Fasteners" }].map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Manufacturer
                      </Label>
                      <Input
                        value={row.manufacturer}
                        onChange={(e) => updateRow(row.id, { manufacturer: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Product / series
                      </Label>
                      <Input value={row.product} onChange={(e) => updateRow(row.id, { product: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        NOA # (if known)
                      </Label>
                      <Input
                        value={row.noa_number_hint}
                        onChange={(e) => updateRow(row.id, { noa_number_hint: e.target.value })}
                        placeholder="optional"
                      />
                    </div>
                    <div className="flex items-end justify-end">
                      <Button variant="ghost" size="icon" onClick={() => removeRow(row.id)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {ROOFING_COMPONENT_TYPE_LABELS[row.component_type] ?? row.component_type}
                    </Badge>
                    {bestMatch && bestMatch.storage_path ? (
                      <>
                        <Badge className="gap-1 text-xs">
                          <ShieldCheck className="h-3 w-3" /> {bestMatch.noa_number}
                        </Badge>
                        {expiryBadge(bestMatch)}
                      </>
                    ) : bestMatch ? (
                      <Badge variant="secondary" className="text-xs">
                        On file — no PDF uploaded yet
                      </Badge>
                    ) : row.manufacturer.trim() || row.product.trim() ? (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        No NOA on file for this manufacturer/series yet
                      </Badge>
                    ) : null}
                  </div>
                </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-3.5 w-3.5" /> Add component
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save roofing details"}
        </Button>
        {saveError && <p className="text-sm text-destructive">{saveError}</p>}
        {!saveError && savedAt && <p className="text-sm text-muted-foreground">Saved.</p>}
      </div>
    </div>
  );
}
