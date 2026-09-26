"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Hand,
  MousePointer2,
  PenLine,
  DoorOpen,
  Ruler,
  Undo2,
  ZoomIn,
  ZoomOut,
  Maximize,
  RotateCw,
  Trash2,
  Check,
  Upload,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FILL_GREEN } from "@/lib/ui/fills";
import {
  DEFAULT_FENCE_PROJECT,
  FENCE_JURISDICTIONS,
  FENCE_LOCATIONS,
  FENCE_MATERIALS,
  computeTotals,
  fenceDocuments,
  fenceInspections,
  fenceJurisdiction,
  fencePermitPath,
  fenceWarnings,
  formatFeet,
  guessFenceJurisdiction,
  runSegments,
  segLen,
  type FenceJurisdictionId,
  type FenceLocation,
  type FenceProject,
} from "@/lib/tools/fence-rules";
import {
  EMPTY_DRAWING,
  exportMarkupJpeg,
  pxPerFoot,
  rescaleDrawing,
  rotateDrawing90,
  type FenceDrawing,
  type Pt,
} from "@/lib/tools/fence-markup";
import { isPdf, loadSurvey, rotateCanvas90 } from "@/lib/tools/fence-survey";
import { buildFencePackagePdf } from "@/lib/tools/fence-package-pdf";
import { FenceSurveyCanvas, type FenceCanvasHandle, type FenceTool } from "./fence-survey-canvas";

const FIELD = "mt-1";
const SELECT = "mt-1 block h-11 w-full rounded-full border border-input bg-background px-3 text-sm";

type JobLite = {
  id: string;
  job_number: string;
  client_name: string;
  address: string | null;
  city: string | null;
  jurisdiction: string | null;
  contract_value: number | null;
};

type SurveyState = {
  canvas: HTMLCanvasElement;
  file: Blob;
  fileName: string;
  pageCount: number;
  page: number;
  rotation: 0 | 90 | 180 | 270;
  /** Set once the original survey is in storage, so re-saves don't re-upload it. */
  storagePath: string | null;
};

type SavedPlan = {
  version: 1;
  savedAt: string;
  project: FenceProject;
  drawing: FenceDrawing;
  showX: boolean;
  survey: {
    path: string;
    name: string;
    type: string;
    page: number;
    rotation: 0 | 90 | 180 | 270;
    width: number;
    height: number;
  } | null;
};

const TOOLS: { id: FenceTool; label: string; icon: typeof PenLine; hint: string }[] = [
  { id: "draw", label: "Draw fence", icon: PenLine, hint: "Click each corner. Click the first point to close the loop. Double-click or Enter to finish an open run. Hold Shift for straight 45°/90° lines." },
  { id: "edit", label: "Edit", icon: MousePointer2, hint: "Drag a point to move it (it snaps to other corners). Double-click a line to add a bend. Click a run to select it." },
  { id: "gate", label: "Gate", icon: DoorOpen, hint: "Click on the fence line to drop a gate. Click a gate to edit its width and swing." },
  { id: "scale", label: "Set scale", icon: Ruler, hint: "Click both ends of a dimension printed on the survey (a property line is best), then type its length." },
  { id: "pan", label: "Move", icon: Hand, hint: "Drag to move around. Scroll or use the zoom buttons to zoom." },
];

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-xl px-2 py-1.5 hover:bg-muted/50">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 accent-primary"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm">
        {label}
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}

function parseFeet(raw: string): number | null {
  const v = raw.trim();
  if (!v) return null;
  const ftIn = v.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft)?\s*(?:-?\s*(\d+(?:\.\d+)?)\s*(?:"|in)?)?$/i);
  if (ftIn) {
    const ft = parseFloat(ftIn[1]);
    const inches = ftIn[2] ? parseFloat(ftIn[2]) : 0;
    const total = ft + inches / 12;
    return total > 0 ? total : null;
  }
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function FenceBuilder({ orgId }: { orgId: string }) {
  const [jobNumber, setJobNumber] = useState("");
  const [job, setJob] = useState<JobLite | null>(null);
  const [savedPlanPath, setSavedPlanPath] = useState<string | null>(null);
  const [project, setProject] = useState<FenceProject>(DEFAULT_FENCE_PROJECT);
  const [survey, setSurvey] = useState<SurveyState | null>(null);
  const [drawing, setDrawing] = useState<FenceDrawing>(EMPTY_DRAWING);
  const [history, setHistory] = useState<FenceDrawing[]>([]);
  const [tool, setTool] = useState<FenceTool>("draw");
  const [showX, setShowX] = useState(true);
  const [showDims, setShowDims] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedGateId, setSelectedGateId] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [pendingScale, setPendingScale] = useState<{ a: Pt; b: Pt } | null>(null);
  const [scaleInput, setScaleInput] = useState("");
  const [defaultLocation, setDefaultLocation] = useState<FenceLocation>("rear");
  const [busy, setBusy] = useState("");
  const [mail, setMail] = useState("");
  const [lastPackageJobId, setLastPackageJobId] = useState<string | null>(null);
  const canvasRef = useRef<FenceCanvasHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = useCallback(<K extends keyof FenceProject>(key: K, value: FenceProject[K]) => {
    setProject((p) => ({ ...p, [key]: value }));
  }, []);

  // Drawing edits go through here so Undo can step back. Transient edits
  // (a point being dragged) update the drawing without adding undo steps.
  const drawingRef = useRef(drawing);
  drawingRef.current = drawing;
  const historyRef = useRef(history);
  historyRef.current = history;

  const commitDrawing = useCallback((next: FenceDrawing, opts?: { transient?: boolean }) => {
    if (!opts?.transient) setHistory([...historyRef.current.slice(-60), drawingRef.current]);
    drawingRef.current = next;
    setDrawing(next);
  }, []);

  function undo() {
    const h = historyRef.current;
    if (!h.length) return;
    setDrawing(h[h.length - 1]);
    setHistory(h.slice(0, -1));
    setActiveRunId(null);
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const ppf = pxPerFoot(drawing.scale);
  const totals = useMemo(() => computeTotals(drawing.runs, drawing.gates, ppf), [drawing, ppf]);
  const path = useMemo(() => fencePermitPath(project), [project]);
  const docs = useMemo(() => fenceDocuments(project, totals), [project, totals]);
  const warnings = useMemo(() => fenceWarnings(project, totals, drawing.runs), [project, totals, drawing.runs]);
  const inspections = useMemo(() => fenceInspections(project), [project]);
  const juris = fenceJurisdiction(project.jurisdiction);
  const selectedRun = drawing.runs.find((r) => r.id === selectedRunId) ?? null;
  const selectedGate = drawing.gates.find((g) => g.id === selectedGateId) ?? null;
  const activeTool = TOOLS.find((t) => t.id === tool)!;

  // ── Job lookup (same pattern as the patio checklist) ─────────────────────
  async function findJob(): Promise<JobLite | null> {
    const q = jobNumber.trim();
    if (!q) return null;
    const supabase = createClient();
    const cols = "id, job_number, client_name, address, city, jurisdiction, contract_value";
    const exact = await supabase.from("jobs").select(cols).eq("org_id", orgId).eq("job_number", q).maybeSingle();
    if (exact.data) return exact.data as JobLite;
    const fuzzy = await supabase
      .from("jobs")
      .select(cols)
      .eq("org_id", orgId)
      .ilike("job_number", `${q}%`)
      .limit(1)
      .maybeSingle();
    return (fuzzy.data as JobLite | null) ?? null;
  }

  async function lookupJob() {
    setMail("");
    setBusy("Finding job…");
    const found = await findJob();
    setBusy("");
    if (!found) {
      setJob(null);
      setSavedPlanPath(null);
      setMail("No job with that number in PermitAIO. You can still build and download the package.");
      return;
    }
    setJob(found);
    setJobNumber(found.job_number);
    setProject((p) => ({
      ...p,
      jurisdiction: guessFenceJurisdiction(found.jurisdiction, found.city),
      job_value: found.contract_value ?? p.job_value,
    }));
    // Look for a saved drawing for this job.
    const supabase = createClient();
    const { data } = await supabase.storage.from("job-files").list(found.id, {
      search: "fence-plan-",
      sortBy: { column: "created_at", order: "desc" },
      limit: 5,
    });
    const latest = (data ?? []).filter((f) => f.name.startsWith("fence-plan-") && f.name.endsWith(".json"))[0];
    setSavedPlanPath(latest ? `${found.id}/${latest.name}` : null);
  }

  async function loadSavedPlan() {
    if (!savedPlanPath) return;
    setBusy("Opening saved drawing…");
    setMail("");
    try {
      const supabase = createClient();
      const { data: planBlob, error } = await supabase.storage.from("job-files").download(savedPlanPath);
      if (error || !planBlob) throw new Error(error?.message ?? "Could not read the saved drawing.");
      const plan = JSON.parse(await planBlob.text()) as SavedPlan;
      setProject({ ...DEFAULT_FENCE_PROJECT, ...plan.project });
      setShowX(plan.showX ?? true);
      if (plan.survey) {
        const { data: sBlob, error: sErr } = await supabase.storage.from("job-files").download(plan.survey.path);
        if (sErr || !sBlob) throw new Error(sErr?.message ?? "Could not read the saved survey.");
        const loaded = await loadSurvey(sBlob, plan.survey.page, plan.survey.name);
        let canvas = loaded.canvas;
        for (let r = 0; r < plan.survey.rotation; r += 90) canvas = rotateCanvas90(canvas);
        const factor = plan.survey.width ? canvas.width / plan.survey.width : 1;
        setSurvey({
          canvas,
          file: sBlob,
          fileName: plan.survey.name,
          pageCount: loaded.pageCount,
          page: loaded.page,
          rotation: plan.survey.rotation,
          storagePath: plan.survey.path,
        });
        setDrawing(rescaleDrawing(plan.drawing, factor));
      } else {
        setDrawing(plan.drawing);
      }
      setHistory([]);
      setMail(`Opened the drawing saved ${new Date(plan.savedAt).toLocaleString("en-US", { timeZone: "America/New_York" })}.`);
    } catch (e) {
      setMail(e instanceof Error ? e.message : "Could not open the saved drawing.");
    }
    setBusy("");
  }

  // ── Survey upload ────────────────────────────────────────────────────────
  async function onSurveyFile(file: File | undefined) {
    if (!file) return;
    if (drawing.runs.length && !confirm("Replace the survey? The fence you drew will be cleared.")) return;
    setBusy(isPdf(file) ? "Reading survey PDF…" : "Reading survey…");
    setMail("");
    try {
      const loaded = await loadSurvey(file, 1);
      setSurvey({
        canvas: loaded.canvas,
        file,
        fileName: file.name,
        pageCount: loaded.pageCount,
        page: loaded.page,
        rotation: 0,
        storagePath: null,
      });
      setDrawing(EMPTY_DRAWING);
      setHistory([]);
      setActiveRunId(null);
      setSelectedRunId(null);
      setSelectedGateId(null);
      setTool("scale");
      setMail("Survey loaded. Set the scale first: click both ends of a dimension on the survey.");
    } catch (e) {
      setMail(e instanceof Error ? e.message : "Could not read that survey.");
    }
    setBusy("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function changePage(page: number) {
    if (!survey) return;
    if (drawing.runs.length && !confirm("Switch survey page? The fence you drew will be cleared.")) return;
    setBusy("Reading page…");
    const loaded = await loadSurvey(survey.file, page, survey.fileName);
    setSurvey({ ...survey, canvas: loaded.canvas, page: loaded.page, rotation: 0 });
    setDrawing(EMPTY_DRAWING);
    setHistory([]);
    setBusy("");
  }

  function rotate() {
    if (!survey) return;
    const srcH = survey.canvas.height;
    setSurvey({
      ...survey,
      canvas: rotateCanvas90(survey.canvas),
      rotation: ((survey.rotation + 90) % 360) as SurveyState["rotation"],
    });
    setDrawing((d) => rotateDrawing90(d, srcH));
    setHistory([]);
  }

  // ── Scale ────────────────────────────────────────────────────────────────
  function applyScale() {
    if (!pendingScale) return;
    const feet = parseFeet(scaleInput);
    if (!feet) {
      setMail("Type the length printed on the survey, like 75 or 75.5 or 75'-6\".");
      return;
    }
    commitDrawing({ ...drawing, scale: { ...pendingScale, feet } });
    setPendingScale(null);
    setScaleInput("");
    setTool("draw");
    setMail(`Scale set: ${formatFeet(feet)}. Now draw the fence line.`);
  }

  // ── Run / gate edits ─────────────────────────────────────────────────────
  function updateRun(id: string, patch: Partial<{ height_ft: number; location: FenceLocation }>) {
    commitDrawing({ ...drawing, runs: drawing.runs.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  }
  function deleteRun(id: string) {
    commitDrawing({
      ...drawing,
      runs: drawing.runs.filter((r) => r.id !== id),
      gates: drawing.gates.filter((g) => g.runId !== id),
    });
    setSelectedRunId(null);
    if (activeRunId === id) setActiveRunId(null);
  }
  function updateGate(id: string, patch: Partial<{ width_ft: number; swing: "in" | "out" | "sliding"; electrical: boolean }>) {
    commitDrawing({ ...drawing, gates: drawing.gates.map((g) => (g.id === id ? { ...g, ...patch } : g)) });
  }
  function deleteGate(id: string) {
    commitDrawing({ ...drawing, gates: drawing.gates.filter((g) => g.id !== id) });
    setSelectedGateId(null);
  }

  function runLengthFt(id: string): number | null {
    const run = drawing.runs.find((r) => r.id === id);
    if (!run || !ppf) return null;
    return Math.round((runSegments(run).reduce((s, [a, b]) => s + segLen(a, b), 0) / ppf) * 10) / 10;
  }

  // ── Package ──────────────────────────────────────────────────────────────
  async function buildPdf(): Promise<Uint8Array> {
    const markup = survey ? await exportMarkupJpeg(survey.canvas, drawing, { showX, showDims }) : null;
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    return buildFencePackagePdf({
      jobNumber: job?.job_number ?? (jobNumber.trim() || null),
      clientName: job?.client_name ?? null,
      address: job ? [job.address, job.city].filter(Boolean).join(", ") || null : null,
      jurisdictionLabel: juris.label,
      portal: juris.portal,
      project: { ...project },
      path,
      totals,
      runs: drawing.runs,
      gates: drawing.gates,
      pxPerFt: ppf,
      scaleFeet: drawing.scale?.feet ?? null,
      docs,
      warnings,
      inspections,
      markup,
      preparedBy: auth.user?.email ?? null,
    });
  }

  function download(bytes: Uint8Array, name: string) {
    const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadOnly() {
    setBusy("Building package…");
    setMail("");
    try {
      const bytes = await buildPdf();
      download(bytes, `${job?.job_number ?? (jobNumber.trim() || "fence")}-fence-permit-package.pdf`);
      setMail("Package downloaded.");
    } catch (e) {
      setMail(e instanceof Error ? e.message : "Could not build the package.");
    }
    setBusy("");
  }

  async function saveToJob() {
    setMail("");
    setBusy("Finding job…");
    const target = job ?? (await findJob());
    if (!target) {
      setBusy("");
      setMail("Type a job number that exists in PermitAIO, or use Download PDF.");
      return;
    }
    if (!job) setJob(target);
    try {
      const supabase = createClient();
      const stamp = Date.now();

      // 1) Original survey (once) — kept in storage only so the drawing can reopen.
      let surveyPath = survey?.storagePath ?? null;
      if (survey && (!surveyPath || !surveyPath.startsWith(`${target.id}/`))) {
        setBusy("Saving survey…");
        const ext = survey.fileName.includes(".") ? survey.fileName.split(".").pop()!.toLowerCase() : "pdf";
        surveyPath = `${target.id}/fence-survey-${stamp}.${ext}`;
        const { error } = await supabase.storage.from("job-files").upload(surveyPath, survey.file, {
          contentType: isPdf({ name: survey.fileName, type: survey.file.type }) ? "application/pdf" : survey.file.type || "image/jpeg",
          upsert: false,
        });
        if (error) throw new Error(error.message);
        setSurvey({ ...survey, storagePath: surveyPath });
      }

      // 2) Editable drawing.
      setBusy("Saving drawing…");
      const plan: SavedPlan = {
        version: 1,
        savedAt: new Date().toISOString(),
        project,
        drawing,
        showX,
        survey:
          survey && surveyPath
            ? {
                path: surveyPath,
                name: survey.fileName,
                type: survey.file.type,
                page: survey.page,
                rotation: survey.rotation,
                width: survey.canvas.width,
                height: survey.canvas.height,
              }
            : null,
      };
      const planPath = `${target.id}/fence-plan-${stamp}.json`;
      const { error: planErr } = await supabase.storage
        .from("job-files")
        .upload(planPath, new Blob([JSON.stringify(plan)], { type: "application/json" }), {
          contentType: "application/json",
          upsert: false,
        });
      if (planErr) throw new Error(planErr.message);
      setSavedPlanPath(planPath);

      // 3) Package PDF → job Documents (feeds the Permit Package Generator).
      setBusy("Building package…");
      const bytes = await buildPdf();
      const pdfPath = `${target.id}/fence-package-${stamp}.pdf`;
      const { error: upErr } = await supabase.storage.from("job-files").upload(pdfPath, new Uint8Array(bytes), {
        contentType: "application/pdf",
        upsert: false,
      });
      if (upErr) throw new Error(upErr.message);
      const { data: auth } = await supabase.auth.getUser();
      const { error: insErr } = await supabase.from("job_files").insert({
        org_id: orgId,
        job_id: target.id,
        file_name: `${target.job_number}-fence-permit-package.pdf`,
        storage_path: pdfPath,
        size_bytes: bytes.byteLength,
        uploaded_by: auth.user?.id ?? null,
        category: "fence-package",
      });
      if (insErr) {
        await supabase.storage.from("job-files").remove([pdfPath]);
        throw new Error(insErr.message);
      }
      download(bytes, `${target.job_number}-fence-permit-package.pdf`);
      setLastPackageJobId(target.id);
      setMail(`Saved to job ${target.job_number}. The package is in the job's Documents, and the drawing reopens from here.`);
    } catch (e) {
      setMail(e instanceof Error ? e.message : "Could not save the package.");
    }
    setBusy("");
  }

  const mdc = project.jurisdiction === "mdc";
  const pbc = project.jurisdiction === "pbc";
  const wellington = project.jurisdiction === "wellington";

  // ── UI ───────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <Link href="/tools" className="text-sm text-muted-foreground hover:text-foreground">
          ← Tools
        </Link>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">Fence permit package</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Upload the field survey, trace the fence line around the perimeter, and get the permit path, the exact
          checklist for the jurisdiction, and a marked-up survey page ready to submit.
        </p>
      </div>

      {/* 1 — Job */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">1 · Job &amp; jurisdiction</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <Label htmlFor="fence-job">Job number</Label>
              <Input
                id="fence-job"
                className={FIELD}
                value={jobNumber}
                onChange={(e) => setJobNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void lookupJob();
                }}
                placeholder="92300-1"
              />
            </div>
            <Button type="button" variant="outline" onClick={() => void lookupJob()} disabled={!!busy || !jobNumber.trim()}>
              Find job
            </Button>
          </div>
          {job ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm">
              <div>
                <span className="font-semibold">{job.job_number}</span> · {job.client_name}
                {job.address ? <span className="text-muted-foreground"> · {job.address}{job.city ? `, ${job.city}` : ""}</span> : null}
              </div>
              {savedPlanPath ? (
                <Button type="button" size="sm" variant="outline" onClick={() => void loadSavedPlan()} disabled={!!busy}>
                  Open saved drawing
                </Button>
              ) : null}
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="fence-juris">Jurisdiction</Label>
              <select
                id="fence-juris"
                className={SELECT}
                value={project.jurisdiction}
                onChange={(e) => set("jurisdiction", e.target.value as FenceJurisdictionId)}
              >
                {(["Miami-Dade", "Broward", "Palm Beach", null] as const).map((county) => (
                  <optgroup key={county ?? "other"} label={county ?? "Other"}>
                    {FENCE_JURISDICTIONS.filter((j) => j.county === county).map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="fence-use">Property use</Label>
              <select id="fence-use" className={SELECT} value={project.use} onChange={(e) => set("use", e.target.value as FenceProject["use"])}>
                <option value="residential">Residential (1–2 family)</option>
                <option value="commercial">Commercial / multifamily</option>
              </select>
            </div>
            <div>
              <Label htmlFor="fence-applicant">Applicant</Label>
              <select
                id="fence-applicant"
                className={SELECT}
                value={project.applicant}
                onChange={(e) => set("applicant", e.target.value as FenceProject["applicant"])}
              >
                <option value="contractor">Contractor</option>
                <option value="owner_builder">Owner-builder</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2 — Fence */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">2 · Fence details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <Label htmlFor="fence-action">Work</Label>
              <select id="fence-action" className={SELECT} value={project.action} onChange={(e) => set("action", e.target.value as FenceProject["action"])}>
                <option value="new">New fence</option>
                <option value="replace">Replace</option>
                <option value="repair">Repair</option>
              </select>
            </div>
            <div>
              <Label htmlFor="fence-mat">Material</Label>
              <select id="fence-mat" className={SELECT} value={project.material} onChange={(e) => set("material", e.target.value as FenceProject["material"])}>
                {FENCE_MATERIALS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="fence-h">Height (ft)</Label>
              <Input
                id="fence-h"
                className={FIELD}
                type="number"
                min={1}
                step={0.5}
                value={project.default_height_ft}
                onChange={(e) => set("default_height_ft", Math.max(0, parseFloat(e.target.value) || 0))}
              />
            </div>
            <div>
              <Label htmlFor="fence-val">Job value ($)</Label>
              <Input
                id="fence-val"
                className={FIELD}
                type="number"
                min={0}
                value={project.job_value ?? ""}
                onChange={(e) => set("job_value", e.target.value === "" ? null : Math.max(0, parseFloat(e.target.value) || 0))}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="fence-noa">NOA / FL product approval #</Label>
              <Input id="fence-noa" className={FIELD} value={project.product_approval} onChange={(e) => set("product_approval", e.target.value)} placeholder="Optional for wood / chain link" />
            </div>
            <div>
              <Label htmlFor="fence-survey-date">Survey date</Label>
              <Input id="fence-survey-date" className={FIELD} type="date" value={project.survey_date} onChange={(e) => set("survey_date", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="fence-setback">Closest setback to property line (ft)</Label>
              <Input
                id="fence-setback"
                className={FIELD}
                type="number"
                min={0}
                step={0.5}
                value={project.min_setback_ft ?? ""}
                onChange={(e) => set("min_setback_ft", e.target.value === "" ? null : Math.max(0, parseFloat(e.target.value) || 0))}
              />
            </div>
          </div>
          <div className="grid gap-1 sm:grid-cols-2">
            <Toggle checked={project.pool_on_site} onChange={(v) => set("pool_on_site", v)} label="Pool on the property" />
            <Toggle checked={project.is_pool_barrier} onChange={(v) => set("is_pool_barrier", v)} label="This fence is the pool barrier" />
            <Toggle checked={project.on_easement} onChange={(v) => set("on_easement", v)} label="Fence is in an easement" hint="Utility, drainage, or canal easement" />
            {project.on_easement ? (
              <div className="px-2">
                <Label htmlFor="fence-sunshine">Sunshine 811 ticket #</Label>
                <Input id="fence-sunshine" className={FIELD} value={project.sunshine_ticket} onChange={(e) => set("sunshine_ticket", e.target.value)} />
              </div>
            ) : null}
            <Toggle checked={project.hoa} onChange={(v) => set("hoa", v)} label="HOA / condo association approval needed" />
            <Toggle
              checked={project.in_sight_triangle}
              onChange={(v) => set("in_sight_triangle", v)}
              label="Part of the fence is in a sight triangle or within 10 ft of a driveway"
            />
            <Toggle checked={project.finished_side_out} onChange={(v) => set("finished_side_out", v)} label="Finished side faces out" />
            {mdc ? (
              <Toggle
                checked={project.height_extension_plus2}
                onChange={(v) => set("height_extension_plus2", v)}
                label="+2 ft height extension (neighbor affidavit)"
              />
            ) : null}
            {pbc && project.action !== "new" ? (
              <Toggle checked={project.existing_permitted} onChange={(v) => set("existing_permitted", v)} label="Existing fence was permitted" />
            ) : null}
            {pbc ? (
              <Toggle
                checked={project.zero_lot_line_or_safe_corner}
                onChange={(v) => set("zero_lot_line_or_safe_corner", v)}
                label="Zero-lot-line or safe-site corner lot"
              />
            ) : null}
            {wellington && project.action === "repair" ? (
              <Toggle
                checked={project.over_20_percent_of_section}
                onChange={(v) => set("over_20_percent_of_section", v)}
                label="Repair is more than 20% of a section"
              />
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* 3 — Survey */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
          <CardTitle className="text-base">3 · Survey &amp; fence line</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="hidden"
              onChange={(e) => void onSurveyFile(e.target.files?.[0])}
            />
            <Button type="button" size="sm" variant={survey ? "outline" : "default"} onClick={() => fileRef.current?.click()} disabled={!!busy}>
              <Upload className="mr-1.5 h-4 w-4" />
              {survey ? "Replace survey" : "Upload survey"}
            </Button>
            {survey && survey.pageCount > 1 ? (
              <select
                className="h-8 rounded-full border border-input bg-background px-3 text-sm"
                value={survey.page}
                onChange={(e) => void changePage(parseInt(e.target.value, 10))}
              >
                {Array.from({ length: survey.pageCount }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Page {i + 1} of {survey.pageCount}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!survey ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-56 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm text-muted-foreground hover:bg-muted/40"
            >
              <Upload className="h-6 w-6" />
              Upload the field survey — PDF, JPG, or PNG
              <span className="text-xs">Then set the scale from a printed dimension and trace the fence.</span>
            </button>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                {TOOLS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTool(t.id)}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold shadow-sm ${
                        tool === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t.label}
                    </button>
                  );
                })}
                <span className="mx-1 h-5 w-px bg-border" />
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" title="Undo" onClick={undo} disabled={!history.length}>
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" title="Zoom in" onClick={() => canvasRef.current?.zoomBy(1.25)}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" title="Zoom out" onClick={() => canvasRef.current?.zoomBy(0.8)}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" title="Fit" onClick={() => canvasRef.current?.fit()}>
                  <Maximize className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" title="Rotate survey 90°" onClick={rotate}>
                  <RotateCw className="h-4 w-4" />
                </Button>
                {activeRunId ? (
                  <Button type="button" size="sm" className="ml-auto h-8" onClick={() => canvasRef.current?.finishRun()}>
                    <Check className="mr-1 h-4 w-4" />
                    Finish line
                  </Button>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="min-w-0 flex-1">{activeTool.hint}</span>
                {tool === "draw" ? (
                  <label className="flex items-center gap-1.5">
                    New runs are
                    <select
                      className="h-7 rounded-full border border-input bg-background px-2 text-xs"
                      value={defaultLocation}
                      onChange={(e) => setDefaultLocation(e.target.value as FenceLocation)}
                    >
                      {FENCE_LOCATIONS.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" className="accent-primary" checked={showX} onChange={(e) => setShowX(e.target.checked)} />
                  X marks
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" className="accent-primary" checked={showDims} onChange={(e) => setShowDims(e.target.checked)} />
                  Dimensions
                </label>
              </div>

              <div className="relative">
              {pendingScale ? (
                <div className="absolute inset-x-3 top-3 z-10 flex flex-wrap items-end gap-2 rounded-xl border bg-emerald-50/95 px-3 py-2 shadow-lg dark:bg-emerald-950/90">
                  <div className="min-w-48 flex-1">
                    <Label htmlFor="fence-scale">Length of the line you picked (as printed on the survey)</Label>
                    <Input
                      id="fence-scale"
                      autoFocus
                      className={FIELD}
                      value={scaleInput}
                      onChange={(e) => setScaleInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") applyScale();
                      }}
                      placeholder={`75.00 or 75'-0"`}
                    />
                  </div>
                  <Button type="button" onClick={applyScale}>
                    Set scale
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setPendingScale(null)}>
                    Cancel
                  </Button>
                </div>
              ) : null}

              <FenceSurveyCanvas
                ref={canvasRef}
                survey={survey.canvas}
                drawing={drawing}
                onChange={commitDrawing}
                tool={tool}
                showX={showX}
                showDims={showDims}
                defaultHeight={project.default_height_ft}
                defaultLocation={defaultLocation}
                defaultGateFt={4}
                selectedRunId={selectedRunId}
                selectedGateId={selectedGateId}
                onSelectRun={setSelectedRunId}
                onSelectGate={setSelectedGateId}
                onScalePicked={(a, b) => {
                  setPendingScale({ a, b });
                  setScaleInput("");
                }}
                activeRunId={activeRunId}
                onActiveRunChange={setActiveRunId}
              />
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  ["Total length", totals.linear_ft != null ? `${totals.linear_ft} LF` : "Set scale"],
                  ["Runs", String(drawing.runs.filter((r) => r.points.length > 1).length)],
                  ["Gates", totals.gate_count ? `${totals.gate_count} · ${formatFeet(totals.gate_ft)}` : "0"],
                  ["Scale", drawing.scale ? `${formatFeet(drawing.scale.feet)} ref` : "Not set"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-muted/50 px-3 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{k}</div>
                    <div className="font-heading text-base font-semibold">{v}</div>
                  </div>
                ))}
              </div>

              {drawing.runs.length ? (
                <div className="divide-y rounded-xl border">
                  {drawing.runs.map((run, i) => (
                    <div
                      key={run.id}
                      className={`grid items-center gap-2 px-3 py-2 text-sm sm:grid-cols-[4rem_1fr_1fr_6rem_auto] ${
                        run.id === selectedRunId ? "bg-amber-50 dark:bg-amber-950/30" : ""
                      }`}
                      onClick={() => setSelectedRunId(run.id)}
                    >
                      <span className="font-semibold text-rose-600">F{i + 1}</span>
                      <select
                        className="h-8 rounded-full border border-input bg-background px-2 text-sm"
                        value={run.location}
                        onChange={(e) => updateRun(run.id, { location: e.target.value as FenceLocation })}
                      >
                        {FENCE_LOCATIONS.map((l) => (
                          <option key={l.value} value={l.value}>
                            {l.label}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-2">
                        <span className="text-muted-foreground">Height</span>
                        <Input
                          className="h-8 w-20"
                          type="number"
                          min={1}
                          step={0.5}
                          value={run.height_ft}
                          onChange={(e) => updateRun(run.id, { height_ft: Math.max(0, parseFloat(e.target.value) || 0) })}
                        />
                        <span className="text-muted-foreground">ft</span>
                      </label>
                      <span className="text-muted-foreground">
                        {runLengthFt(run.id) != null ? `${runLengthFt(run.id)} LF` : `${Math.max(0, run.points.length - 1)} seg`}
                        {run.closed ? " · closed" : ""}
                      </span>
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" title="Delete run" onClick={() => deleteRun(run.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}

              {selectedGate ? (
                <div className="flex flex-wrap items-end gap-3 rounded-xl border border-blue-200 bg-blue-50/60 px-3 py-2 dark:border-blue-900 dark:bg-blue-950/30">
                  <span className="self-center text-sm font-semibold text-blue-700 dark:text-blue-300">
                    G{drawing.gates.indexOf(selectedGate) + 1}
                  </span>
                  <div>
                    <Label htmlFor="gate-w">Width (ft)</Label>
                    <Input
                      id="gate-w"
                      className="mt-1 h-9 w-24"
                      type="number"
                      min={1}
                      step={0.5}
                      value={selectedGate.width_ft}
                      onChange={(e) => updateGate(selectedGate.id, { width_ft: Math.max(1, parseFloat(e.target.value) || 1) })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="gate-swing">Type</Label>
                    <select
                      id="gate-swing"
                      className="mt-1 block h-9 rounded-full border border-input bg-background px-3 text-sm"
                      value={selectedGate.swing}
                      onChange={(e) => updateGate(selectedGate.id, { swing: e.target.value as "in" | "out" | "sliding" })}
                    >
                      <option value="in">Swing — one side</option>
                      <option value="out">Swing — other side</option>
                      <option value="sliding">Sliding / rolling</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 pb-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={selectedGate.electrical}
                      onChange={(e) => updateGate(selectedGate.id, { electrical: e.target.checked })}
                    />
                    Electric operator
                  </label>
                  <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={() => deleteGate(selectedGate.id)}>
                    <Trash2 className="mr-1 h-4 w-4" />
                    Remove gate
                  </Button>
                </div>
              ) : null}
              {selectedRun && !selectedGate && tool === "edit" ? (
                <p className="text-xs text-muted-foreground">
                  F{drawing.runs.indexOf(selectedRun) + 1} selected — drag its points, or double-click a line to add a bend.
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {/* 4 — Path & checklist */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">4 · Permit path &amp; checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`rounded-xl px-3 py-2 ${path.exempt ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-muted/50"}`}>
            <div className="font-heading text-base font-semibold">{path.title}</div>
            <p className="mt-0.5 text-sm text-muted-foreground">{path.reason}</p>
            {juris.portal ? (
              <a href={juris.portal.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm font-medium text-primary hover:underline">
                {juris.portal.label} ↗
              </a>
            ) : null}
          </div>

          {warnings.length ? (
            <ul className="space-y-1.5">
              {warnings.map((w, i) => (
                <li
                  key={i}
                  className={`rounded-xl px-3 py-2 text-sm ${
                    w.level === "error"
                      ? "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
                      : w.level === "warn"
                        ? "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                        : "bg-muted/50 text-muted-foreground"
                  }`}
                >
                  {w.text} <span className="text-xs opacity-70">— {w.source}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {docs.length ? (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Submittal checklist</p>
              <ul className="divide-y rounded-xl border">
                {docs.map((doc, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      {doc.url ? (
                        <a href={doc.url} target="_blank" rel="noreferrer" className="font-medium hover:text-primary hover:underline">
                          {doc.title} ↗
                        </a>
                      ) : (
                        <span className="font-medium">{doc.title}</span>
                      )}
                      {doc.note ? <span className="block text-xs text-muted-foreground">{doc.note}</span> : null}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        doc.kind === "required" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {doc.kind === "required" ? "Required" : "If applicable"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {inspections.length ? (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Inspections</p>
              <ul className="list-disc space-y-0.5 pl-5 text-sm">
                {inspections.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="button" className={FILL_GREEN} onClick={() => void saveToJob()} disabled={!!busy}>
          {busy || "Save package to job"}
        </Button>
        <Button type="button" variant="outline" onClick={() => void downloadOnly()} disabled={!!busy}>
          Download PDF only
        </Button>
        {lastPackageJobId ? (
          <Button asChild variant="outline">
            <Link href={`/jobs/${lastPackageJobId}?tab=documents`}>Open job documents</Link>
          </Button>
        ) : null}
      </div>
      {mail ? <p className="text-sm text-muted-foreground">{mail}</p> : null}
    </div>
  );
}
