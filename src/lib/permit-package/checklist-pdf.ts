import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { NoaLibraryRow } from "@/lib/noa/match";
import type { ScheduleWindowRow } from "./schedule-pdf";

/**
 * "Permit Checklist" — the one-page submittal checklist that rides at the
 * top of every permit ZIP. Two jobs, both printed on the same PDF:
 *
 *  1. A checkbox list of every submittal item (Permit Application, NOC,
 *     Floor Plan, Window/Door Schedule, Fenestration Chart, Product
 *     Approvals). Every box is left blank on purpose so the field can
 *     mark them in — matches how the paper packet is walked through.
 *
 *  2. A per-NOA breakdown: every NOA referenced on the floor plan, with
 *     each opening's location / size / count / design pressures listed
 *     under it. If a manufacturer + series combo shows up on ten openings
 *     the reviewer sees one NOA block with ten sub-lines, not ten
 *     duplicated NOA rows.
 *
 * Kept as a single self-contained builder so it stays cheap to render on
 * every ZIP build — no template PDF, no external assets, no fonts to
 * embed beyond the two Helvetica standards.
 */

export interface ChecklistOpening {
  id: string | number;
  location: string;
  width: number | string | null;
  height: number | string | null;
  designPos: number | string | null;
  designNeg: number | string | null;
}

export interface ChecklistNoaGroup {
  manufacturer: string;
  series: string;
  modelNumber: string | null;
  noaNumber: string;
  windowType: string | null;
  pressurePos: number | string | null;
  pressureNeg: number | string | null;
  hasPdf: boolean;
  openings: ChecklistOpening[];
}

export interface BuildChecklistArgs {
  jobNumber: string;
  clientName: string;
  address: string;
  countyLabel: string;
  fenestrationChartName: string | null;
  scheduleFileName: string;
  noaGroups: ChecklistNoaGroup[];
  unmatchedOpeningCount: number;
  /**
   * Total openings on the floor plan and their combined glazing area
   * (square feet). Rendered under the title band as a quick sanity check
   * the field can eyeball before submitting. Both optional so older
   * callers keep compiling; missing values just skip that summary line.
   */
  totalOpenings?: number;
  totalSqFt?: number;
}

/**
 * Sums width × height / 144 across every opening that has both dimensions
 * as a positive number. Non-numeric or missing dimensions are skipped so
 * one bad row can't zero out the whole total.
 */
export function computeWindowTotals(
  windows: { width?: number | string | null; height?: number | string | null }[],
): { totalOpenings: number; totalSqFt: number } {
  let sqIn = 0;
  for (const w of windows) {
    const wNum = typeof w.width === "number" ? w.width : Number(w.width);
    const hNum = typeof w.height === "number" ? w.height : Number(w.height);
    if (Number.isFinite(wNum) && Number.isFinite(hNum) && wNum > 0 && hNum > 0) {
      sqIn += wNum * hNum;
    }
  }
  return {
    totalOpenings: windows.length,
    totalSqFt: Math.round((sqIn / 144) * 10) / 10,
  };
}

/**
 * Splits floor-plan openings into window vs. door counts by their type
 * label, using the same door-detection heuristic as the county schedule
 * builders (door/french/slider/overhead/garage in the type string).
  */
export function countWindowsAndDoors(
    openings: { type?: string | null }[],
  ): { windowCount: number; doorCount: number } {
    let doorCount = 0;
    for (const o of openings) {
      if (/door|french|slider|overhead|garage/i.test(String(o.type || ""))) doorCount++;
    }
    return { windowCount: openings.length - doorCount, doorCount };
}

/**
 * Groups the raw schedule + matched NOA rows into the shape the checklist
 * wants: one row per (manufacturer + series + noa#), openings nested
 * underneath. Matching is done on the floor plan already; here we just
 * fold openings into buckets so the checklist can print them.
 */
export function groupOpeningsByNoa(
  windows: ScheduleWindowRow[],
  matchedLibrary: NoaLibraryRow[],
): { groups: ChecklistNoaGroup[]; unmatched: number } {
  const byKey = new Map<string, ChecklistNoaGroup>();
  let unmatched = 0;

  // Build a lookup so an opening's manufacturer + series can find its NOA
  // row without doing a linear scan per opening.
  const libByKey = new Map<string, NoaLibraryRow>();
  for (const row of matchedLibrary) {
    const key = `${(row.manufacturer || "").toLowerCase()}|${(row.series || "").toLowerCase()}`;
    if (!libByKey.has(key)) libByKey.set(key, row);
  }

  for (const w of windows) {
    const mfr = (w.manufacturer || "").trim();
    const series = (w.series || "").trim();
    if (!mfr && !series) {
      unmatched += 1;
      continue;
    }
    const lookupKey = `${mfr.toLowerCase()}|${series.toLowerCase()}`;
    const noaRow = libByKey.get(lookupKey);
    const bucketKey = noaRow
      ? `noa:${noaRow.id}`
      : `open:${mfr}|${series}|${w.productApproval ?? ""}`;
    let bucket = byKey.get(bucketKey);
    if (!bucket) {
      bucket = {
        manufacturer: noaRow?.manufacturer ?? mfr,
        series: noaRow?.series ?? series,
        modelNumber: noaRow?.model_number ?? null,
        noaNumber:
          noaRow?.noa_number ??
          (typeof w.productApproval === "string" ? w.productApproval : "") ??
          "",
        windowType: noaRow?.window_type ?? (typeof w.type === "string" ? w.type : null),
        pressurePos: noaRow?.pressure_pos ?? w.designPos ?? null,
        pressureNeg: noaRow?.pressure_neg ?? w.designNeg ?? null,
        hasPdf: Boolean(noaRow?.storage_path),
        openings: [],
      };
      byKey.set(bucketKey, bucket);
    }
    bucket.openings.push({
      id: w.id,
      location: (w.location || "").toString(),
      width: (w.width ?? null) as ChecklistOpening["width"],
      height: (w.height ?? null) as ChecklistOpening["height"],
      designPos: (w.designPos ?? null) as ChecklistOpening["designPos"],
      designNeg: (w.designNeg ?? null) as ChecklistOpening["designNeg"],
    });
    if (!noaRow) unmatched += 0; // openings without a match still print, just under an "open" bucket
  }

  return {
    groups: Array.from(byKey.values()).sort((a, b) =>
      `${a.manufacturer} ${a.series}`.localeCompare(`${b.manufacturer} ${b.series}`),
    ),
    unmatched,
  };
}

export async function buildPermitChecklistPdf(args: BuildChecklistArgs): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function ensureSpace(needed: number) {
    if (y - needed < margin) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  }

  function drawText(text: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; x?: number } = {}) {
    const size = opts.size ?? 10;
    const useBold = opts.bold ?? false;
    const [r, g, b] = opts.color ?? [0.1, 0.1, 0.12];
    page.drawText(text, {
      x: opts.x ?? margin,
      y,
      size,
      font: useBold ? bold : font,
      color: rgb(r, g, b),
    });
  }

  function drawCheckbox(x: number, checkY: number, size = 10) {
    page.drawRectangle({
      x,
      y: checkY,
      width: size,
      height: size,
      borderColor: rgb(0.2, 0.2, 0.25),
      borderWidth: 1,
    });
  }

  function drawDivider() {
    page.drawLine({
      start: { x: margin, y },
      end: { x: margin + contentWidth, y },
      thickness: 0.5,
      color: rgb(0.75, 0.75, 0.78),
    });
    y -= 8;
  }

  // ---- Title band ------------------------------------------------------
  drawText("Permit Submittal Checklist", { size: 20, bold: true });
  y -= 24;
  drawText(`${args.jobNumber} — ${args.clientName}`, { size: 11, bold: true });
  y -= 14;
  if (args.address) {
    drawText(args.address, { size: 10, color: [0.35, 0.35, 0.4] });
    y -= 12;
  }
  drawText(`${args.countyLabel} · Generated ${new Date().toLocaleString("en-US")}`, {
    size: 9,
    color: [0.45, 0.45, 0.5],
  });
  y -= 18;

  // ---- Window totals summary (top-of-checklist quick sanity check) -----
  if (
    typeof args.totalOpenings === "number" &&
    typeof args.totalSqFt === "number"
  ) {
    const sqFtLabel = args.totalSqFt.toLocaleString("en-US", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    const openingsLabel = `${args.totalOpenings} opening${args.totalOpenings === 1 ? "" : "s"}`;
    drawText(`Windows on floor plan: ${openingsLabel} · ${sqFtLabel} sq ft`, {
      size: 10.5,
      bold: true,
    });
    y -= 16;
  }
  y -= 4;
  drawDivider();

  // ---- Submittal items -------------------------------------------------
  drawText("Submittal items", { size: 12, bold: true });
  y -= 18;
  const items: { label: string; sub?: string }[] = [
    { label: "Permit Application", sub: `${args.countyLabel} application form` },
    { label: "Notice of Commencement (NOC)", sub: "Leave blank — fill in after recording" },
    { label: "Floor Plan", sub: "See file: Floor Plan.pdf (top of this ZIP)" },
    { label: "Window / Door Schedule", sub: `See file: ${args.scheduleFileName}` },
    {
      label: "Fenestration Chart",
      sub: args.fenestrationChartName
        ? `See file: ${args.fenestrationChartName}`
        : "Not on file for this county yet — attach before submittal",
    },
    { label: "Product Approvals (NOAs / FL#)", sub: "See per-NOA list below and PDFs at ZIP root" },
  ];
  for (const it of items) {
    ensureSpace(28);
    drawCheckbox(margin, y - 2);
    drawText(it.label, { size: 10.5, bold: true, x: margin + 16 });
    y -= 12;
    if (it.sub) {
      drawText(it.sub, { size: 9, color: [0.45, 0.45, 0.5], x: margin + 16 });
      y -= 12;
    } else {
      y -= 4;
    }
    y -= 4;
  }
  y -= 6;
  drawDivider();

  // ---- Product Approvals list -----------------------------------------
  drawText("Product Approvals required", { size: 12, bold: true });
  y -= 16;
  drawText("Every NOA / FL# referenced on the floor plan, with each opening it applies to.", {
    size: 9,
    color: [0.45, 0.45, 0.5],
  });
  y -= 18;

  if (args.noaGroups.length === 0) {
    drawText("No NOAs referenced yet.", { size: 10, color: [0.55, 0.55, 0.6] });
    y -= 14;
  }

  for (const g of args.noaGroups) {
    // Reserve enough space that at least the header + one opening print on
    // the same page as the NOA header line.
    ensureSpace(48);
    // NOA header line
    drawCheckbox(margin, y - 2);
    const seriesLabel = g.series
      ? ` — ${g.series}${g.modelNumber ? " / " + g.modelNumber : ""}`
      : g.modelNumber
        ? ` — ${g.modelNumber}`
        : "";
    drawText(`${g.manufacturer}${seriesLabel}`, { size: 11, bold: true, x: margin + 16 });
    y -= 12;
    const noaBits: string[] = [];
    if (g.noaNumber) noaBits.push(`NOA / FL# ${g.noaNumber}`);
    if (g.windowType) noaBits.push(g.windowType);
    if (g.pressurePos != null || g.pressureNeg != null) {
      const pos = g.pressurePos != null ? `+${g.pressurePos}` : "—";
      const neg = g.pressureNeg != null ? `${g.pressureNeg}` : "—";
      noaBits.push(`Std pressures ${pos} / ${neg} PSF`);
    }
    noaBits.push(g.hasPdf ? "PDF included" : "PDF MISSING — upload to library");
    drawText(noaBits.join("  ·  "), { size: 9, color: [0.35, 0.35, 0.4], x: margin + 16 });
    y -= 14;

    // Per-opening lines
    for (const op of g.openings) {
      ensureSpace(14);
      const size =
        op.width && op.height
          ? `${op.width}" × ${op.height}"`
          : op.width || op.height
            ? `${op.width ?? "?"}" × ${op.height ?? "?"}"`
            : "size not set";
      const pressures =
        op.designPos != null || op.designNeg != null
          ? `  DP ${op.designPos ?? "—"} / ${op.designNeg ?? "—"}`
          : "";
      const locLabel = op.location ? op.location : `#${op.id}`;
      drawText(`•  ${locLabel} — ${size}${pressures}`, {
        size: 9.5,
        color: [0.2, 0.2, 0.25],
        x: margin + 30,
      });
      y -= 12;
    }
    y -= 6;
  }

  if (args.unmatchedOpeningCount > 0) {
    ensureSpace(18);
    drawText(
      `Heads up: ${args.unmatchedOpeningCount} opening(s) on the plan don't have a manufacturer + series set yet.`,
      { size: 9, color: [0.6, 0.35, 0.1] },
    );
    y -= 12;
  }

  return doc.save();
}
