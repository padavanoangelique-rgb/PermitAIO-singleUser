"use client";

import { createElement as h, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/client";
import { loadNoaLibraryEffective } from "@/lib/noa/load";
import { downloadPdfFromSignedUrl } from "@/lib/noa/download-pdf";
import type { Tables } from "@/lib/supabase/types";
import {
  groupScheduleByProduct,
  matchMullions,
  matchNoaLibrary,
  matchRoofingComponents,
  noaExpiryStatus,
  tradeMatchesJob,
  type FloorPlanMullion,
  type FloorPlanWindow,
  type NoaLibraryRow,
  type RoofingComponentMatch,
  type ScheduleGroup,
} from "@/lib/noa/match";
import { isRoofingTrade, ROOFING_COMPONENT_TYPE_LABELS, tradeLabel } from "@/lib/jobs/trade";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileWarning, Loader2, PackageOpen, PenLine, ShieldCheck } from "lucide-react";
import { NoaAnnotator, type NoaAnnotatorOpening } from "./noa-annotator";
import { groupOpeningsByNoa } from "@/lib/permit-package/checklist-pdf";
import type { ScheduleWindowRow } from "@/lib/permit-package/schedule-pdf";

type Job = Tables<"jobs">;

interface PlanData {
  windows?: ScheduleWindowRow[];
  mullions?: FloorPlanMullion[];
}

function buildAnnotationMap(rows: { noa_library_id: string; storage_path: string }[] | null | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of rows ?? []) map.set(r.noa_library_id, r.storage_path);
  return map;
}

function expiryBadge(row: NoaLibraryRow) {
  const status = noaExpiryStatus(row);
  if (status === "expired") return <Badge variant="destructive" className="text-xs">Expired</Badge>;
  if (status === "expiring")
    return <Badge className="bg-amber-500 text-xs text-white hover:bg-amber-500">Expiring soon</Badge>;
  return null;
}

export function JobNoaPanel({ job }: { job: Job }) {
  const isRoofing = isRoofingTrade(job.trade_type);
  const [loading, setLoading] = useState(true);
  const [hasFloorPlan, setHasFloorPlan] = useState(false);
  const [groups, setGroups] = useState<ScheduleGroup[]>([]);
  const [mullionGroups, setMullionGroups] = useState<ReturnType<typeof matchMullions>>([]);
  const [roofingMatches, setRoofingMatches] = useState<RoofingComponentMatch[]>([]);
  const [library, setLibrary] = useState<NoaLibraryRow[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Map<string, string>>(new Map());
  const [checklistGroups, setChecklistGroups] = useState<ReturnType<typeof groupOpeningsByNoa>["groups"]>([]);
  const [annotateTarget, setAnnotateTarget] = useState<{ row: NoaLibraryRow; title: string; openings: NoaAnnotatorOpening[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    if (isRoofing) {
            const [componentsRes, lib, annRes] = await Promise.all([
                      supabase
                        .from("job_roofing_components")
                        .select("*")
                        .eq("job_id", job.id)
                        .order("sort_order", { ascending: true }),
                      loadNoaLibraryEffective(supabase),
                      supabase.from("job_noa_annotations").select("noa_library_id, storage_path").eq("job_id", job.id),
                    ]);
            setLibrary(lib as NoaLibraryRow[]);
            setAnnotations(buildAnnotationMap(annRes.data));
            setRoofingMatches(matchRoofingComponents(componentsRes.data ?? [], lib));
            setHasFloorPlan(false);
            setGroups([]);
            setMullionGroups([]);
            setLoading(false);
            return;
    }

        const [planRes, planLib, annRes] = await Promise.all([
                supabase
                  .from("floor_plans")
                  .select("plan_data")
                  .eq("job_id", job.id)
                  .order("updated_at", { ascending: false })
                  .limit(1)
                  .maybeSingle(),
                loadNoaLibraryEffective(supabase),
                supabase.from("job_noa_annotations").select("noa_library_id, storage_path").eq("job_id", job.id),
              ]);
        setLibrary(planLib as NoaLibraryRow[]);
        setAnnotations(buildAnnotationMap(annRes.data));

    const plan = planRes.data?.plan_data as PlanData | undefined;
    const windows = plan?.windows ?? [];
    const mullions = plan?.mullions ?? [];
    setHasFloorPlan(Boolean(planRes.data) && windows.length > 0);
    setGroups(matchNoaLibrary(groupScheduleByProduct(windows), planLib));
    setMullionGroups(matchMullions(mullions, planLib));
    setChecklistGroups(groupOpeningsByNoa(windows, planLib as NoaLibraryRow[]).groups);
    setLoading(false);
  }, [job.id, job.org_id, isRoofing]);
  useEffect(() => {
    void load();
  }, [load]);

  const browseLibrary = useMemo(
    () => library.filter((row) => tradeMatchesJob(row.trade, job.trade_type)),
    [library, job.trade_type],
  );

  const matchedFiles = useMemo(() => {
    const files = new Map<string, NoaLibraryRow>();
    for (const g of groups) {
      const best = g.matches.find((m) => m.storage_path);
      if (best) files.set(best.id, best);
    }
    for (const m of mullionGroups) {
      const best = m.matches.find((mm) => mm.storage_path);
      if (best) files.set(best.id, best);
    }
    for (const c of roofingMatches) {
      const best = c.matches.find((m) => m.storage_path);
      if (best) files.set(best.id, best);
    }
    return Array.from(files.values());
  }, [groups, mullionGroups, roofingMatches]);

  function openingsFor(row: NoaLibraryRow): NoaAnnotatorOpening[] {
    const group = checklistGroups.find((g) => g.noaNumber === row.noa_number && g.manufacturer === row.manufacturer);
    if (!group) return [];
    return group.openings.map((o) => ({
      id: o.id,
      location: o.location || `#${o.id}`,
      size: o.width && o.height ? `${o.width}" × ${o.height}"` : "size not set",
    }));
  }
  
  async function handleDownloadOne(row: NoaLibraryRow) {
        const annotatedPath = annotations.get(row.id);
        const bucket = annotatedPath ? "job-noa-annotations" : "noa-library";
        const path = annotatedPath ?? row.storage_path;
        if (!path) return;
        setDownloadingId(row.id);
        setError(null);
        const supabase = createClient();
        const { data, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
        if (signErr || !data) {
                setDownloadingId(null);
                setError(`Couldn't open that file: ${signErr?.message ?? "unknown error"}`);
                return;
        }
        try {
                const name = row.file_name || `${row.manufacturer}-${row.noa_number}.pdf`;
                await downloadPdfFromSignedUrl(data.signedUrl, name);
        } catch {
                setError("Couldn't save that PDF.");
        }
        setDownloadingId(null);
  }

  async function handleDownloadAllMatched() {
    if (matchedFiles.length === 0) return;
    setZipping(true);
    setError(null);
    try {
      const supabase = createClient();
      const zip = new JSZip();
      const usedNames = new Set<string>();
      for (const row of matchedFiles) {
                  const annotatedPath = annotations.get(row.id);
                  const bucket = annotatedPath ? "job-noa-annotations" : "noa-library";
                  const path = annotatedPath ?? row.storage_path;
                  if (!path) continue;
                  const { data, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(path, 120);
        if (signErr || !data) continue;
        const res = await fetch(data.signedUrl);
        const blob = await res.blob();
        let name = row.file_name || `${row.manufacturer}-${row.noa_number}.pdf`;
        if (usedNames.has(name)) {
          const parts = name.split(".");
          const ext = parts.length > 1 ? `.${parts.pop()}` : "";
          name = `${parts.join(".")}-${row.id.slice(0, 6)}${ext}`;
        }
        usedNames.add(name);
        zip.file(name, blob);
      }
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${job.job_number}-NOAs.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Couldn't build the ZIP. Try downloading the NOAs individually instead.");
    } finally {
      setZipping(false);
    }
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
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="font-heading text-base">
              {isRoofing
                ? "Matched to this job's roofing materials"
                : "Matched to this job's window/door schedule"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {isRoofing ? (
                <>
                  Every material entered on the Roofing Details tab, checked
                  against your org's{" "}
                  <Link href="/libraries?tab=noa" className="underline">
                    NOA Library
                  </Link>
                  .
                </>
              ) : (
                <>
                  Every manufacturer/series used on the Floor Plans tab, checked
                  against your org's{" "}
                  <Link href="/libraries?tab=noa" className="underline">
                    NOA Library
                  </Link>
                  .
                </>
              )}
            </p>
          </div>
          {matchedFiles.length > 0 && (
            <Button size="sm" onClick={handleDownloadAllMatched} disabled={zipping}>
              <PackageOpen className="h-3.5 w-3.5" />
              {zipping ? "Zipping…" : `Download all matched (${matchedFiles.length})`}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {isRoofing ? (
            roofingMatches.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
                <FileWarning className="h-6 w-6" />
                <p className="text-sm">
                  No materials entered yet. Add them in the Roofing Details
                  tab and their NOAs will be matched here automatically.
                </p>
              </div>
            ) : (
              roofingMatches.map((c) => (
                <div key={c.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">
                          {c.manufacturer}
                          {c.product ? ` — ${c.product}` : ""}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {ROOFING_COMPONENT_TYPE_LABELS[c.componentType] ?? c.componentType}
                        </Badge>
                      </div>
                    </div>
                    {c.matches.length > 0 && c.matches[0].storage_path ? (
                      <div className="flex items-center gap-2">
                        <Badge className="gap-1 text-xs">
                          <ShieldCheck className="h-3 w-3" /> {c.matches[0].noa_number}
                        </Badge>
                        {expiryBadge(c.matches[0])}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={downloadingId === c.matches[0].id}
                          onClick={() => handleDownloadOne(c.matches[0])}
                        >
                          <Download className="h-3.5 w-3.5" /> Download
                        </Button>
                        {h(Button, { variant: "outline", size: "sm", onClick: () => setAnnotateTarget({ row: c.matches[0], title: `${c.matches[0].manufacturer}${c.matches[0].series ? " — " + c.matches[0].series : ""} — NOA ${c.matches[0].noa_number}`, openings: [] }) }, h(PenLine, { className: "h-3.5 w-3.5" }), annotations.has(c.matches[0].id) ? "Edit markup" : "Open in Permitaio")}
                      </div>
                    ) : c.matches.length > 0 ? (
                      <Badge variant="secondary" className="text-xs">
                        On file — no PDF uploaded yet
                      </Badge>
                    ) : (
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/libraries?tab=noa">Add NOA to library</Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )
          ) : !hasFloorPlan ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <FileWarning className="h-6 w-6" />
              <p className="text-sm">
                No window/door openings yet. Add them in the Floor Plans tab
                and their NOAs will be matched here automatically.
              </p>
            </div>
          ) : groups.length === 0 && mullionGroups.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              None of this job's openings have a manufacturer/series set
              yet on the Floor Plans tab.
            </p>
          ) : (
            <>
              {groups.map((g) => (
                <div key={g.key} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">
                          {g.manufacturer}
                          {g.series ? ` — ${g.series}` : ""}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {g.openings.length} opening{g.openings.length === 1 ? "" : "s"}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {g.openings.map((o) => o.location).join(", ")}
                      </p>
                    </div>
                    {g.matches.length > 0 && g.matches[0].storage_path ? (
                      <div className="flex items-center gap-2">
                        <Badge className="gap-1 text-xs">
                          <ShieldCheck className="h-3 w-3" /> {g.matches[0].noa_number}
                        </Badge>
                        {expiryBadge(g.matches[0])}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={downloadingId === g.matches[0].id}
                          onClick={() => handleDownloadOne(g.matches[0])}
                        >
                          <Download className="h-3.5 w-3.5" /> Download
                        </Button>
                        {h(Button, { variant: "outline", size: "sm", onClick: () => setAnnotateTarget({ row: g.matches[0], title: `${g.matches[0].manufacturer}${g.matches[0].series ? " — " + g.matches[0].series : ""} — NOA ${g.matches[0].noa_number}`, openings: openingsFor(g.matches[0]) }) }, h(PenLine, { className: "h-3.5 w-3.5" }), annotations.has(g.matches[0].id) ? "Edit markup" : "Open in Permitaio")}
                      </div>
                    ) : g.matches.length > 0 ? (
                      <Badge variant="secondary" className="text-xs">
                        On file — no PDF uploaded yet
                      </Badge>
                    ) : (
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/libraries?tab=noa">Add NOA to library</Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {mullionGroups.map((m) => (
                <div key={`mullion-${m.id}`} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">Mullion — {m.size}</p>
                        <Badge variant="outline" className="text-xs">
                          FL# {m.flNumber}
                        </Badge>
                      </div>
                    </div>
                    {m.matches.length > 0 && m.matches[0].storage_path ? (
                      <div className="flex items-center gap-2">
                        <Badge className="gap-1 text-xs">
                          <ShieldCheck className="h-3 w-3" /> {m.matches[0].noa_number}
                        </Badge>
                        {expiryBadge(m.matches[0])}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={downloadingId === m.matches[0].id}
                          onClick={() => handleDownloadOne(m.matches[0])}
                        >
                          <Download className="h-3.5 w-3.5" /> Download
                        </Button>
                        {h(Button, { variant: "outline", size: "sm", onClick: () => setAnnotateTarget({ row: m.matches[0], title: `${m.matches[0].manufacturer}${m.matches[0].series ? " — " + m.matches[0].series : ""} — NOA ${m.matches[0].noa_number}`, openings: openingsFor(m.matches[0]) }) }, h(PenLine, { className: "h-3.5 w-3.5" }), annotations.has(m.matches[0].id) ? "Edit markup" : "Open in Permitaio")}
                      </div>
                    ) : m.matches.length > 0 ? (
                      <Badge variant="secondary" className="text-xs">
                        On file — no PDF uploaded yet
                      </Badge>
                    ) : (
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/libraries?tab=noa">Add NOA to library</Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base">
            Browse the full NOA library
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {job.trade_type
              ? `Every NOA on file that applies to ${tradeLabel(job.trade_type)} jobs, in case you need one that isn't on the schedule.`
              : "Every NOA currently on file for this organization."}
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {browseLibrary.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No NOAs on file yet — add some from the{" "}
              <Link href="/libraries?tab=noa" className="underline">
                NOA Library
              </Link>
              .
            </p>
          ) : (
            browseLibrary.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-2.5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">
                      {row.manufacturer}
                      {row.series ? ` — ${row.series}` : ""}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {row.noa_number}
                    </Badge>
                    {expiryBadge(row)}
                  </div>
                </div>
                {row.storage_path ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={downloadingId === row.id}
                    onClick={() => handleDownloadOne(row)}
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    No PDF uploaded yet
                  </Badge>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {annotateTarget &&
        h(NoaAnnotator, {
          jobId: job.id,
          orgId: job.org_id,
          noaLibraryId: annotateTarget.row.id,
          storagePath: annotateTarget.row.storage_path ?? "",
          title: annotateTarget.title,
          openings: annotateTarget.openings,
          onClose: () => setAnnotateTarget(null),
          onSaved: () => { void load(); },
        })}
    </div>
  );
}
