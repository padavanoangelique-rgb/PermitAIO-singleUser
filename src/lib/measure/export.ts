import { detectRooms } from "./rooms";
import { renderPlan, type Theme } from "./render";
import { boundsOf } from "./geometry";
import { scheduleCsv } from "./schedule";
import { PX_PER_FOOT, type Plan } from "./types";
import { buildMeasurePayload } from "@/lib/measure/integration";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function fileBase(plan: Plan): string {
  const job = plan.jobNumber.replace(/[^\w-]+/g, "").trim();
  const name = plan.name.replace(/[^\w\- ]+/g, "").trim() || "measure";
  return job ? `job-${job}-${name}` : name;
}

export async function exportPlanPng(plan: Plan, theme: Theme): Promise<void> {
  const blob = await renderPlanBlob(plan, theme);
  if (!blob) return;
  const filename = `${fileBase(plan)}.png`;
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: plan.jobNumber || plan.name });
      return;
    } catch {
      /* cancelled */
    }
  }
  downloadBlob(blob, filename);
}

export async function exportScheduleCsv(plan: Plan): Promise<void> {
  const csv = scheduleCsv(plan);
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${fileBase(plan)}-schedule.csv`);
}

export async function exportMeasureJson(plan: Plan): Promise<void> {
  const payload = buildMeasurePayload(plan);
  const text = JSON.stringify(payload, null, 2);
  downloadBlob(
    new Blob([text], { type: "application/json" }),
    `${fileBase(plan)}.json`,
  );
}

async function renderPlanBlob(plan: Plan, theme: Theme): Promise<Blob | null> {
  const b = boundsOf(plan.walls);
  const pad = 4;
  const minX = b ? b.minX - pad : -2;
  const minY = b ? b.minY - pad : -2;
  const maxX = b ? b.maxX + pad : 32;
  const maxY = b ? b.maxY + pad : 24;
  const worldW = Math.max(12, maxX - minX);
  const worldH = Math.max(12, maxY - minY);
  const scale = 36;
  const width = Math.round(worldW * scale);
  const height = Math.round(worldH * scale);
  const canvas = document.createElement("canvas");
  const dpr = 2;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  renderPlan(ctx, {
    width,
    height,
    dpr,
    camera: {
      zoom: scale / PX_PER_FOOT,
      panX: -minX * scale,
      panY: -minY * scale,
    },
    plan,
    rooms: detectRooms(plan.walls, plan.labels),
    selection: null,
    showGrid: false,
    showDims: true,
    theme,
  });
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
