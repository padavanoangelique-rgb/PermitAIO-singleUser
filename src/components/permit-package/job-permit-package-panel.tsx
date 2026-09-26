"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/client";
import { loadNoaLibraryEffective } from "@/lib/noa/load";
import type { Tables } from "@/lib/supabase/types";
import { guessCountyFromText } from "@/lib/forms/folio";
import { isRoofingTrade } from "@/lib/jobs/trade";
import {
  groupScheduleByProduct,
  matchMullions,
  mullionNoaIssues,
  matchNoaLibrary,
  matchRoofingComponents,
  type FloorPlanMullion,
  type FloorPlanWindow,
} from "@/lib/noa/match";
import { buildPermitPackage } from "@/lib/permit-package/build";
import {
  savePermitPackage,
  markPermitPackageStatus,
  deletePermitPackage,
  raisePermitPackageCap,
} from "@/lib/actions/permit-package";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  CircleAlert,
  Download,
  Loader2,
  PackageCheck,
  ShieldCheck,
  Trash2,
} from "lucide-react";

type Job = Tables<"jobs">;
type PermitPackage = Tables<"permit_packages">;

interface Preflight {
  floorPlanCount: number;
  scheduleOpenings: number;
  county: string | null;
  jobFilesCount: number;
  noaMatchedCount: number;
  noaMissingCount: number;
  isRoofing: boolean;
  roofingComponentCount: number;
  roofingCoveringSet: boolean;
  mullionCount: number;
  /** Mullion marks (M1, M2...) with no NOA selected. */
  mullionMissing: string[];
  /** Mullion marks whose NOA in the library has expired. */
  mullionExpired: string[];
}

const STATUS_LABEL: Record<string, string> = {
  generated: "Generated",
  reviewed: "Reviewed",
  submitted: "Submitted",
};

const STATUS_VARIANT: Record<string, "secondary" | "default" | "outline"> = {
  generated: "secondary",
  reviewed: "default",
  submitted: "outline",
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function stripInternalZipFiles(zip: Blob): Promise<Blob> {
  const packed = await JSZip.loadAsync(zip);
  const drop: string[] = [];
  packed.forEach((path) => {
    const base = path.split("/").pop() ?? "";
    if (base === "DEBUG_READ_ME.json" || base === "README.txt") drop.push(path);
  });
  for (const path of drop) packed.remove(path);
  return packed.generateAsync({ type: "blob" });
}

async function stripNoaPdfsForStorage(zip: Blob): Promise<Blob> {
  const packed = await JSZip.loadAsync(zip);
  const drop: string[] = [];
  packed.forEach((path) => {
    if (/noa/i.test(path) && /\.pdf$/i.test(path)) drop.push(path);
  });
  for (const path of drop) packed.remove(path);
  return packed.generateAsync({ type: "blob" });
}

export function JobPermitPackagePanel({ job }: { job: Job }) {
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<PermitPackage[]>([]);
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progressStep, setProgressStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<PermitPackage | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewStatus, setReviewStatus] = useState<"reviewed" | "submitted">("reviewed");
  const [savingReview, setSavingReview] = useState(false);

  const isRoofing = isRoofingTrade(job.trade_type);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [pkgRes, planRes, jobFilesRes, lib, roofingDetailsRes, roofingComponentsRes] =
      await Promise.all([
        supabase
          .from("permit_packages")
          .select("*")
          .eq("job_id", job.id)
          .order("version", { ascending: false }),
        isRoofing
          ? Promise.resolve({ data: null })
          : supabase
              .from("floor_plans")
              .select("plan_data")
              .eq("job_id", job.id)
              .order("updated_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
        supabase.from("job_files").select("id").eq("job_id", job.id),
        loadNoaLibraryEffective(supabase),
        isRoofing
          ? supabase.from("job_roofing_details").select("roof_covering_type").eq("job_id", job.id).maybeSingle()
          : Promise.resolve({ data: null }),
        isRoofing
          ? supabase.from("job_roofing_components").select("*").eq("job_id", job.id)
          : Promise.resolve({ data: null }),
      ]);
    setPackages(pkgRes.data ?? []);
    const plan = (planRes.data?.plan_data ?? {}) as {
      windows?: FloorPlanWindow[];
      mullions?: FloorPlanMullion[];
    };
    const windows = plan.windows ?? [];
    const mullions = plan.mullions ?? [];
    const matched = new Set<string>();
    let missing = 0;
    if (isRoofing) {
      for (const c of matchRoofingComponents(roofingComponentsRes.data ?? [], lib)) {
        const best = c.matches.find((m) => m.storage_path);
        if (best) matched.add(best.id);
        else missing += 1;
      }
    } else {
      for (const g of matchNoaLibrary(groupScheduleByProduct(windows), lib)) {
        const best = g.matches.find((m) => m.storage_path);
        if (best) matched.add(best.id);
        else missing += 1;
      }
      for (const m of matchMullions(mullions, lib)) {
        const best = m.matches.find((mm) => mm.storage_path);
        if (best) matched.add(best.id);
        else missing += 1;
      }
    }
    const mullionIssues = isRoofing ? { missing: [], expired: [] } : mullionNoaIssues(mullions, lib);
    setPreflight({
      mullionCount: isRoofing ? 0 : mullions.length,
      mullionMissing: mullionIssues.missing,
      mullionExpired: mullionIssues.expired,
      floorPlanCount: windows.length,
      scheduleOpenings: windows.length,
      county: guessCountyFromText(job.jurisdiction),
      jobFilesCount: jobFilesRes.data?.length ?? 0,
      noaMatchedCount: matched.size,
      noaMissingCount: missing,
      isRoofing,
      roofingComponentCount: roofingComponentsRes.data?.length ?? 0,
      roofingCoveringSet: Boolean(roofingDetailsRes.data?.roof_covering_type),
    });
    setLoading(false);
  }, [job.id, job.org_id, job.jurisdiction, isRoofing]);
  useEffect(() => {
    void load();
  }, [load]);

  const nextVersion = useMemo(
    () => (packages.length > 0 ? Math.max(...packages.map((p) => p.version)) + 1 : 1),
    [packages],
  );

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    const safeJobNumber = job.job_number.replace(/[/\\:*?"<>|]/g, "-");
    const zipName = `${safeJobNumber} Permit Package v${nextVersion}.zip`;
    try {
      setProgressStep("Raising storage cap…");
      await raisePermitPackageCap();

      setProgressStep("Capturing floor plan, filling forms, and matching NOAs…");
      const { zip: rawZip, manifest } = await buildPermitPackage(job, nextVersion);
      const fullZip = await stripInternalZipFiles(rawZip);

      setProgressStep("Saving package to this job…");
      const supabase = createClient();
      const storagePath = `${job.org_id}/${job.id}/v${nextVersion}-${Date.now()}.zip`;
      let uploadZip = fullZip;
      let uploadError = (await supabase.storage
        .from("permit-packages")
        .upload(storagePath, uploadZip, { contentType: "application/zip" })).error;

      if (uploadError && /maximum allowed size|payload too large|exceeded/i.test(uploadError.message)) {
        uploadZip = await stripNoaPdfsForStorage(fullZip);
        uploadError = (await supabase.storage
          .from("permit-packages")
          .upload(storagePath, uploadZip, { contentType: "application/zip" })).error;
        if (!uploadError) {
          downloadBlob(fullZip, zipName);
        }
      }

      if (uploadError) {
        downloadBlob(fullZip, zipName);
        throw new Error(
          `Could not save the package on the job (${uploadError.message}). The full ZIP downloaded to your computer.`,
        );
      }

      setProgressStep("Saving version history…");
      const res = await savePermitPackage({
        jobId: job.id,
        version: nextVersion,
        storagePath,
        manifest,
      });
      if (res.error) throw new Error(res.error);

      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate the permit package.");
    } finally {
      setGenerating(false);
      setProgressStep(null);
    }
  }

  async function handleDownload(pkg: PermitPackage) {
    setDownloadingId(pkg.id);
    setError(null);
    try {
      const { zip: rawZip } = await buildPermitPackage(job, pkg.version);
      const zip = await stripInternalZipFiles(rawZip);
      const safeJobNumber = job.job_number.replace(/[/\\:*?"<>|]/g, "-");
      downloadBlob(zip, `${safeJobNumber} Permit Package v${pkg.version}.zip`);
    } catch (e) {
      if (!pkg.storage_path) {
        setError(`Couldn't download that package: ${e instanceof Error ? e.message : "unknown error"}`);
        setDownloadingId(null);
        return;
      }
      const supabase = createClient();
      const { data, error: signErr } = await supabase.storage
        .from("permit-packages")
        .createSignedUrl(pkg.storage_path, 120);
      if (signErr || !data) {
        setError(`Couldn't open that package: ${signErr?.message ?? "unknown error"}`);
        setDownloadingId(null);
        return;
      }
      try {
        const res = await fetch(data.signedUrl);
        if (!res.ok) throw new Error(`download failed (${res.status})`);
        const blob = await res.blob();
        const safeJobNumber = job.job_number.replace(/[/\\:*?"<>|]/g, "-");
        downloadBlob(blob, `${safeJobNumber} Permit Package v${pkg.version}.zip`);
      } catch (inner) {
        setError(`Couldn't download that package: ${inner instanceof Error ? inner.message : "unknown error"}`);
      }
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDelete(pkg: PermitPackage) {
    if (!confirm(`Delete v${pkg.version} of this permit package? This can't be undone.`)) return;
    setDeletingId(pkg.id);
    const res = await deletePermitPackage(pkg.id, job.id);
    setDeletingId(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    await load();
  }

  function openReview(pkg: PermitPackage, status: "reviewed" | "submitted") {
    setReviewTarget(pkg);
    setReviewStatus(status);
    setReviewNotes(pkg.review_notes ?? "");
  }

  async function handleSaveReview() {
    if (!reviewTarget) return;
    setSavingReview(true);
    const res = await markPermitPackageStatus(reviewTarget.id, job.id, reviewStatus, reviewNotes);
    setSavingReview(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setReviewTarget(null);
    await load();
  }

  if (loading || !preflight) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const checklist = preflight.isRoofing
    ? [
        {
          label: "Roofing details",
          ok: preflight.roofingCoveringSet,
          detail: preflight.roofingCoveringSet
            ? "Roof covering type set"
            : "No covering type set yet — fill in the Roofing Details tab",
        },
        {
          label: "Materials",
          ok: preflight.roofingComponentCount > 0,
          detail:
            preflight.roofingComponentCount > 0
              ? `${preflight.roofingComponentCount} material(s) on file`
              : "No materials entered yet — add them in the Roofing Details tab",
        },
      ]
    : [
        {
          label: "Floor plan",
          ok: preflight.floorPlanCount > 0,
          detail:
            preflight.floorPlanCount > 0
              ? `${preflight.floorPlanCount} opening(s) on file`
              : "No floor plan yet — add one in the Floor Plans tab",
        },
      ];
  const inventoryJurisdictionName = (job.jurisdiction ?? "").split(",")[0].trim() || null;
  const noaDetail =
    preflight.noaMatchedCount > 0
      ? `${preflight.noaMatchedCount} NOA PDF(s) matched to this job — only those go in the package` +
        (preflight.noaMissingCount
          ? ` (${preflight.noaMissingCount} opening group(s) have no match)`
          : "")
      : preflight.noaMissingCount > 0
        ? "No matching NOA PDFs for this job's openings yet"
        : "No openings to match yet";
  if (preflight.mullionCount > 0) {
    const mullionProblems = [
      preflight.mullionMissing.length > 0 ? `${preflight.mullionMissing.join(", ")}: no NOA selected` : "",
      preflight.mullionExpired.length > 0 ? `${preflight.mullionExpired.join(", ")}: NOA expired` : "",
    ].filter(Boolean);
    checklist.push({
      label: "Mullion NOAs",
      ok: mullionProblems.length === 0,
      detail:
        mullionProblems.length === 0
          ? `${preflight.mullionCount} mullion(s), each with a current NOA`
          : mullionProblems.join("; "),
    });
  }
  checklist.push(
    {
      label: "County",
      ok: Boolean(preflight.county),
      detail: preflight.county
        ? `${preflight.county} — will be filled into the permit application`
        : "Pick a jurisdiction on the Permit Inventory row — County derives from it",
    },
    {
      label: "Jurisdiction",
      ok: Boolean(inventoryJurisdictionName) && !/county$/i.test(inventoryJurisdictionName ?? ""),
      detail:
        inventoryJurisdictionName && !/county$/i.test(inventoryJurisdictionName)
          ? `${inventoryJurisdictionName} — controls which forms populate`
          : "Pick a specific building department on the Permit Inventory row (e.g. Sunrise, not just Broward County)",
    },
    {
      label: "NOAs for this job",
      ok: preflight.noaMatchedCount > 0,
      detail: noaDetail,
    },
    {
      label: "Supporting documents",
      ok: true,
      detail: `${preflight.jobFilesCount} file(s) will be included`,
    },
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="font-heading text-base">Permit Package Generator</CardTitle>
            <p className="text-sm text-muted-foreground">
              {preflight.isRoofing
                ? `One-click ZIP of the roofing details, matched forms, matched NOAs, and supporting documents for ${job.job_number}.`
                : `One-click ZIP of the floor plan, matched forms, window/door schedule, matched NOAs, and supporting documents for ${job.job_number}.`}
            </p>
          </div>
          <Button onClick={handleGenerate} disabled={generating}>
            <PackageCheck className="h-3.5 w-3.5" />
            {generating ? progressStep ?? "Generating…" : `Generate v${nextVersion}`}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {checklist.map((item) => (
            <div key={item.label} className="flex items-center gap-2.5 text-sm">
              {item.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <CircleAlert className="h-4 w-4 shrink-0 text-amber-500" />
              )}
              <span className="font-medium">{item.label}</span>
              <span className="text-muted-foreground">— {item.detail}</span>
            </div>
          ))}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base">Version history</CardTitle>
        </CardHeader>
        <CardContent>
          {packages.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No packages generated yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Review notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packages.map((pkg) => (
                  <TableRow key={pkg.id}>
                    <TableCell className="font-medium">v{pkg.version}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(pkg.generated_at).toLocaleString("en-US")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[pkg.status] ?? "secondary"}>
                        {STATUS_LABEL[pkg.status] ?? pkg.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                      {pkg.review_notes || "\u2014"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={downloadingId === pkg.id}
                          onClick={() => void handleDownload(pkg)}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        {pkg.status === "generated" && (
                          <Button variant="outline" size="sm" onClick={() => openReview(pkg, "reviewed")}>
                            <ShieldCheck className="h-3.5 w-3.5" /> Mark reviewed
                          </Button>
                        )}
                        {pkg.status === "reviewed" && (
                          <Button variant="outline" size="sm" onClick={() => openReview(pkg, "submitted")}>
                            Mark submitted
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          disabled={deletingId === pkg.id}
                          onClick={() => void handleDelete(pkg)}
                          title={`Delete v${pkg.version}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={reviewTarget !== null} onOpenChange={(open) => !open && setReviewTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewStatus === "reviewed" ? "Mark reviewed" : "Mark submitted"} — v
              {reviewTarget?.version}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              placeholder="Optional review notes…"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveReview} disabled={savingReview}>
              {savingReview ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
