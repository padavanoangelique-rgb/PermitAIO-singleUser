/**
 * Draws the fence markup (clean fence line, X marks, gates, dimensions) over
 * a survey. One renderer for both the on-screen editor and the exported
 * permit page, so what the tech sees is exactly what prints.
 */

import {
  formatFeet,
  runSegments,
  segLen,
  type FenceGate,
  type FenceRun,
} from "@/lib/tools/fence-rules";

export type Pt = { x: number; y: number };

export type FenceScale = { a: Pt; b: Pt; feet: number };

export type FenceDrawing = {
  runs: FenceRun[];
  gates: FenceGate[];
  scale: FenceScale | null;
};

export const EMPTY_DRAWING: FenceDrawing = { runs: [], gates: [], scale: null };

export const FENCE_COLOR = "#e11d48";
export const GATE_COLOR = "#2563eb";

export type MarkupOptions = {
  /** Image-px → output-px factor (the editor's zoom; 1 on export). */
  zoom: number;
  imageWidth: number;
  imageHeight: number;
  showX: boolean;
  showDims: boolean;
  color?: string;
  selectedRunId?: string | null;
  selectedGateId?: string | null;
  showHandles?: boolean;
};

export function pxPerFoot(scale: FenceScale | null): number | null {
  if (!scale || !(scale.feet > 0)) return null;
  const px = segLen(scale.a, scale.b);
  return px > 0 ? px / scale.feet : null;
}

/** Base stroke unit in image pixels, so markup looks the same on any survey resolution. */
export function markupUnit(w: number, h: number) {
  return Math.max(w, h) / 1000;
}

function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Gate span on its segment as [t0, t1]. */
export function gateSpan(gate: FenceGate, a: Pt, b: Pt, ppf: number | null, unit: number): [number, number] {
  const len = segLen(a, b) || 1;
  const widthPx = ppf ? gate.width_ft * ppf : 30 * unit;
  const half = Math.min(0.5, widthPx / len / 2);
  const t0 = Math.max(0, gate.t - half);
  const t1 = Math.min(1, gate.t + half);
  return [t0, t1];
}

function haloText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  ctx.font = `600 ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = size * 0.28;
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/**
 * Draws in image coordinates. The caller sets the transform
 * (ctx.setTransform(zoom,0,0,zoom,ox,oy)) — widths are divided by zoom so
 * strokes keep a readable minimum size on screen.
 */
export function drawFenceMarkup(ctx: CanvasRenderingContext2D, drawing: FenceDrawing, opts: MarkupOptions) {
  const u = markupUnit(opts.imageWidth, opts.imageHeight);
  const minPx = (px: number) => px / opts.zoom;
  const lw = Math.max(3 * u, minPx(2.5));
  const color = opts.color ?? FENCE_COLOR;
  const ppf = pxPerFoot(drawing.scale);
  const fontSize = Math.max(13 * u, minPx(12));

  drawing.runs.forEach((run, runIndex) => {
    const segs = runSegments(run);
    const selected = run.id === opts.selectedRunId;

    segs.forEach(([a, b], si) => {
      const gates = drawing.gates
        .filter((g) => g.runId === run.id && g.segment === si)
        .map((g) => ({ g, span: gateSpan(g, a, b, ppf, u) }))
        .sort((x, y) => x.span[0] - y.span[0]);

      // Solid fence pieces between gates.
      const pieces: [number, number][] = [];
      let cursor = 0;
      for (const { span } of gates) {
        if (span[0] > cursor) pieces.push([cursor, span[0]]);
        cursor = Math.max(cursor, span[1]);
      }
      if (cursor < 1) pieces.push([cursor, 1]);

      ctx.lineCap = "round";
      if (selected) {
        ctx.strokeStyle = "rgba(250, 204, 21, 0.55)";
        ctx.lineWidth = lw * 3.2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      for (const [t0, t1] of pieces) {
        const p0 = lerp(a, b, t0);
        const p1 = lerp(a, b, t1);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();

        if (opts.showX) {
          const len = segLen(p0, p1);
          const spacing = Math.max(38 * u, minPx(26));
          const size = Math.max(5.5 * u, minPx(5));
          const count = Math.floor(len / spacing);
          const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
          ctx.lineWidth = Math.max(1.8 * u, minPx(1.6));
          for (let k = 1; k <= count; k++) {
            const c = lerp(p0, p1, (k - 0.5) / Math.max(count, 1));
            for (const off of [Math.PI / 4, -Math.PI / 4]) {
              const dx = Math.cos(ang + off) * size;
              const dy = Math.sin(ang + off) * size;
              ctx.beginPath();
              ctx.moveTo(c.x - dx, c.y - dy);
              ctx.lineTo(c.x + dx, c.y + dy);
              ctx.stroke();
            }
          }
          ctx.lineWidth = lw;
        }
      }

      // Gates: posts + swing arc (or slide track).
      for (const { g, span } of gates) {
        const p0 = lerp(a, b, span[0]);
        const p1 = lerp(a, b, span[1]);
        const w = segLen(p0, p1);
        const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
        const sel = g.id === opts.selectedGateId;
        ctx.strokeStyle = sel ? "#f59e0b" : GATE_COLOR;
        ctx.fillStyle = sel ? "#f59e0b" : GATE_COLOR;
        ctx.lineWidth = Math.max(2 * u, minPx(2));
        const post = Math.max(3.5 * u, minPx(3.5));
        for (const p of [p0, p1]) {
          ctx.fillRect(p.x - post, p.y - post, post * 2, post * 2);
        }
        if (g.swing === "sliding") {
          const nx = -Math.sin(ang) * post * 2.2;
          const ny = Math.cos(ang) * post * 2.2;
          ctx.setLineDash([post * 1.6, post * 1.2]);
          ctx.beginPath();
          ctx.moveTo(p0.x + nx, p0.y + ny);
          ctx.lineTo(p1.x + nx + (p1.x - p0.x) * 0.6, p1.y + ny + (p1.y - p0.y) * 0.6);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          const dir = g.swing === "in" ? 1 : -1;
          const leafAng = ang + (dir * Math.PI) / 2;
          const tip = { x: p0.x + Math.cos(leafAng) * w, y: p0.y + Math.sin(leafAng) * w };
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(tip.x, tip.y);
          ctx.stroke();
          ctx.setLineDash([post * 1.2, post * 1.0]);
          ctx.beginPath();
          ctx.arc(p0.x, p0.y, w, Math.min(ang, leafAng), Math.max(ang, leafAng), false);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        const gi = drawing.gates.indexOf(g) + 1;
        const mid = lerp(p0, p1, 0.5);
        // Opposite side from the segment dimension, clear of the swing arc.
        const off = g.swing === "sliding" ? fontSize * 1.4 : Math.max(fontSize * 1.4, w * 0.55);
        const nx = Math.sin(ang) * off;
        const ny = -Math.cos(ang) * off;
        haloText(ctx, `G${gi} ${formatFeet(g.width_ft)}${g.electrical ? " ⚡" : ""}`, mid.x + nx, mid.y + ny, fontSize * 0.9, GATE_COLOR);
      }

      // Segment dimension.
      if (opts.showDims && ppf) {
        const ft = segLen(a, b) / ppf;
        if (ft >= 1) {
          const mid = lerp(a, b, 0.5);
          const ang = Math.atan2(b.y - a.y, b.x - a.x);
          const off = fontSize * 1.1;
          const tx = mid.x - Math.sin(ang) * off;
          const ty = mid.y + Math.cos(ang) * off;
          ctx.save();
          ctx.translate(tx, ty);
          let rot = ang;
          if (rot > Math.PI / 2) rot -= Math.PI;
          if (rot < -Math.PI / 2) rot += Math.PI;
          ctx.rotate(rot);
          haloText(ctx, formatFeet(ft), 0, 0, fontSize, "#111827");
          ctx.restore();
        }
      }
    });

    // Run tag at the first point.
    if (run.points.length > 0) {
      const p = run.points[0];
      haloText(ctx, `F${runIndex + 1} · ${formatFeet(run.height_ft)} H`, p.x, p.y - fontSize * 1.4, fontSize, color);
    }

    if (opts.showHandles) {
      const r = Math.max(4 * u, minPx(5));
      run.points.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? color : "#ffffff";
        ctx.fill();
        ctx.lineWidth = Math.max(1.5 * u, minPx(1.5));
        ctx.strokeStyle = color;
        ctx.stroke();
      });
    }
  });

  // Scale reference.
  if (drawing.scale && opts.showHandles) {
    const { a, b } = drawing.scale;
    ctx.strokeStyle = "#059669";
    ctx.lineWidth = Math.max(2 * u, minPx(2));
    ctx.setLineDash([minPx(8), minPx(5)]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    const mid = lerp(a, b, 0.5);
    haloText(ctx, `scale ${formatFeet(drawing.scale.feet)}`, mid.x, mid.y - fontSize, fontSize * 0.9, "#059669");
  }
}

/** Renders survey + markup at full resolution and returns JPEG bytes for the PDF. */
export async function exportMarkupJpeg(
  survey: HTMLCanvasElement,
  drawing: FenceDrawing,
  opts: { showX: boolean; showDims: boolean },
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const canvas = document.createElement("canvas");
  canvas.width = survey.width;
  canvas.height = survey.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(survey, 0, 0);
  drawFenceMarkup(ctx, drawing, {
    zoom: 1,
    imageWidth: survey.width,
    imageHeight: survey.height,
    showX: opts.showX,
    showDims: opts.showDims,
  });
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new Error("Could not export the survey markup.");
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
}

/** Rotates every drawing coordinate 90° clockwise to follow a rotated survey of the given (pre-rotation) height. */
export function rotateDrawing90(drawing: FenceDrawing, srcHeight: number): FenceDrawing {
  const r = (p: Pt): Pt => ({ x: srcHeight - p.y, y: p.x });
  return {
    runs: drawing.runs.map((run) => ({ ...run, points: run.points.map(r) })),
    gates: drawing.gates,
    scale: drawing.scale ? { ...drawing.scale, a: r(drawing.scale.a), b: r(drawing.scale.b) } : null,
  };
}

/** Rescales coordinates when a saved drawing is reopened on a survey rasterized at a different size. */
export function rescaleDrawing(drawing: FenceDrawing, factor: number): FenceDrawing {
  if (Math.abs(factor - 1) < 1e-6) return drawing;
  const s = (p: Pt): Pt => ({ x: p.x * factor, y: p.y * factor });
  return {
    runs: drawing.runs.map((run) => ({ ...run, points: run.points.map(s) })),
    gates: drawing.gates,
    scale: drawing.scale ? { ...drawing.scale, a: s(drawing.scale.a), b: s(drawing.scale.b) } : null,
  };
}
