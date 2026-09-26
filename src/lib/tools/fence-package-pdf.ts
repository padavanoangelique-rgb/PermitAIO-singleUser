import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  FENCE_MATERIALS,
  FENCE_LOCATIONS,
  formatFeet,
  runSegments,
  segLen,
  type FenceDoc,
  type FenceGate,
  type FencePath,
  type FenceProject,
  type FenceRun,
  type FenceTotals,
  type FenceWarning,
} from "@/lib/tools/fence-rules";

/** pdf-lib standard fonts are WinAnsi only — swap the few symbols the rules use. */
function safe(text: string): string {
  return text
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/→/g, "->")
    .replace(/⚡/g, "(elec)")
    .replace(/[^\x20-\x7E -ÿ–—‘’“”•…]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = safe(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export type FencePackageArgs = {
  jobNumber: string | null;
  clientName: string | null;
  address: string | null;
  jurisdictionLabel: string;
  portal: { label: string; url: string } | null;
  project: FenceProject;
  path: FencePath;
  totals: FenceTotals;
  runs: FenceRun[];
  gates: FenceGate[];
  pxPerFt: number | null;
  scaleFeet: number | null;
  docs: FenceDoc[];
  warnings: FenceWarning[];
  inspections: string[];
  markup: { bytes: Uint8Array; width: number; height: number } | null;
  preparedBy: string | null;
};

export async function buildFencePackagePdf(a: FencePackageArgs): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Fence permit package${a.jobNumber ? ` — ${a.jobNumber}` : ""}`);
  doc.setProducer("PermitAIO");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.09, 0.09, 0.09);
  const muted = rgb(0.4, 0.4, 0.4);
  const blue = rgb(0.08, 0.42, 0.87);
  const red = rgb(0.75, 0.11, 0.2);
  const amber = rgb(0.7, 0.45, 0.02);
  const W = 612;
  const H = 792;
  const M = 40;
  const contentW = W - M * 2;

  let page: PDFPage = doc.addPage([W, H]);
  let y = H - 52;

  const ensure = (need: number) => {
    if (y - need < 48) {
      page = doc.addPage([W, H]);
      y = H - 52;
    }
  };
  const text = (t: string, x: number, size: number, f = font, color = ink) => {
    page.drawText(safe(t), { x, y, size, font: f, color });
  };
  const para = (t: string, size = 10, f = font, color = ink, indent = 0) => {
    for (const line of wrap(t, f, size, contentW - indent)) {
      ensure(size + 4);
      text(line, M + indent, size, f, color);
      y -= size + 4;
    }
  };
  const heading = (t: string) => {
    ensure(34);
    y -= 8;
    text(t, M, 13, bold, ink);
    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: rgb(0.8, 0.8, 0.8) });
    y -= 14;
  };

  // ── Cover ────────────────────────────────────────────────────────────────
  text("Fence permit package", M, 20, bold);
  y -= 24;
  if (a.jobNumber) {
    text(`Job ${a.jobNumber}`, M, 12, bold, blue);
    y -= 16;
  }
  if (a.clientName) {
    text(a.clientName, M, 11);
    y -= 15;
  }
  if (a.address) {
    text(a.address, M, 11);
    y -= 15;
  }
  text(
    `${a.jurisdictionLabel} · ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}`,
    M,
    9,
    font,
    muted,
  );
  y -= 22;

  heading("Permit path");
  para(a.path.title, 12, bold, a.path.exempt ? rgb(0.02, 0.5, 0.3) : ink);
  para(a.path.reason, 9, font, muted);
  if (a.portal) {
    y -= 2;
    para(`Submit: ${a.portal.label} — ${a.portal.url}`, 9, font, blue);
  }

  heading("Fence summary");
  const p = a.project;
  const matLabel = FENCE_MATERIALS.find((m) => m.value === p.material)?.label ?? p.material;
  const rows: [string, string][] = [
    ["Work", p.action === "new" ? "New fence" : p.action === "replace" ? "Replace" : "Repair"],
    ["Material", matLabel],
    ["Use", p.use === "commercial" ? "Commercial / multifamily" : "Residential"],
    ["Applicant", p.applicant === "owner_builder" ? "Owner-builder" : "Contractor"],
    ["Total length", a.totals.linear_ft != null ? `${a.totals.linear_ft} LF (incl. gates)` : "Scale not set"],
    ["Max height", a.totals.max_height_ft ? formatFeet(a.totals.max_height_ft) : "—"],
    ["Gates", a.totals.gate_count ? `${a.totals.gate_count} (${formatFeet(a.totals.gate_ft)} total)` : "None"],
    [
      "Locations",
      a.totals.locations.map((l) => FENCE_LOCATIONS.find((x) => x.value === l)?.label ?? l).join(", ") || "—",
    ],
    ["Pool barrier", p.is_pool_barrier ? "Yes" : p.pool_on_site ? "No (pool on site)" : "No"],
    ["On easement", p.on_easement ? `Yes${p.sunshine_ticket ? ` — Sunshine ticket ${p.sunshine_ticket}` : ""}` : "No"],
    ["HOA approval", p.hoa ? "Required" : "No"],
    ["Product approval", p.product_approval || "—"],
    ["Job value", p.job_value != null ? `$${p.job_value.toLocaleString("en-US")}` : "—"],
    ["Survey date", p.survey_date || "—"],
  ];
  for (const [k, v] of rows) {
    ensure(16);
    text(k, M, 9, font, muted);
    const lines = wrap(v, bold, 10, contentW - 150);
    lines.forEach((line, i) => {
      if (i > 0) {
        y -= 13;
        ensure(13);
      }
      text(line, M + 150, 10, bold);
    });
    y -= 15;
  }

  if (a.warnings.length) {
    heading("Checks");
    for (const w of a.warnings) {
      const tag = w.level === "error" ? "FIX" : w.level === "warn" ? "CHECK" : "NOTE";
      const color = w.level === "error" ? red : w.level === "warn" ? amber : muted;
      ensure(14);
      text(tag, M, 8, bold, color);
      const lines = wrap(`${w.text}  (${w.source})`, font, 9.5, contentW - 44);
      lines.forEach((line, i) => {
        if (i > 0) ensure(13);
        text(line, M + 44, 9.5, font, ink);
        y -= 13;
      });
      y -= 2;
    }
  }

  // ── Checklist ────────────────────────────────────────────────────────────
  heading(a.path.exempt ? "Documents" : "Submittal checklist");
  if (a.path.exempt) {
    para("No permit required under the sourced exemption. Keep this sheet with the job file.", 10);
  }
  for (const item of a.docs) {
    ensure(18);
    page.drawRectangle({ x: M, y: y - 2, width: 9, height: 9, borderColor: ink, borderWidth: 0.8 });
    const lines = wrap(item.title, bold, 10, contentW - 90);
    lines.forEach((line, i) => {
      if (i > 0) ensure(13);
      text(line, M + 16, 10, bold);
      if (i === 0) text(item.kind === "required" ? "Required" : "If applicable", W - M - 62, 8, font, muted);
      y -= 13;
    });
    if (item.url) {
      for (const line of wrap(item.url, font, 8, contentW - 16)) {
        ensure(11);
        text(line, M + 16, 8, font, blue);
        y -= 11;
      }
    }
    if (item.note) {
      for (const line of wrap(item.note, font, 8.5, contentW - 16)) {
        ensure(11);
        text(line, M + 16, 8.5, font, muted);
        y -= 11;
      }
    }
    y -= 5;
  }

  if (a.inspections.length) {
    heading("Inspections");
    for (const i of a.inspections) para(`•  ${i}`, 10);
  }

  // ── Fence runs table ─────────────────────────────────────────────────────
  if (a.runs.some((r) => r.points.length > 1)) {
    heading("Fence runs");
    ensure(14);
    text("Run", M, 8.5, bold, muted);
    text("Location", M + 50, 8.5, bold, muted);
    text("Height", M + 160, 8.5, bold, muted);
    text("Segments", M + 230, 8.5, bold, muted);
    text("Length", W - M - 60, 8.5, bold, muted);
    y -= 14;
    a.runs.forEach((run, i) => {
      if (run.points.length < 2) return;
      const segs = runSegments(run);
      const segFt = a.pxPerFt ? segs.map(([p0, p1]) => segLen(p0, p1) / a.pxPerFt!) : [];
      const total = segFt.reduce((s, v) => s + v, 0);
      const segText = a.pxPerFt ? segFt.map((f) => formatFeet(f)).join(" + ") : `${segs.length} segments`;
      const lines = wrap(segText, font, 9, W - M - 70 - (M + 230));
      ensure(14 * lines.length);
      text(`F${i + 1}`, M, 10, bold);
      text(FENCE_LOCATIONS.find((l) => l.value === run.location)?.label ?? run.location, M + 50, 10);
      text(formatFeet(run.height_ft), M + 160, 10);
      text(a.pxPerFt ? `${Math.round(total * 10) / 10} LF` : "—", W - M - 60, 10, bold);
      lines.forEach((line, li) => {
        if (li > 0) y -= 12;
        text(line, M + 230, 9, font, muted);
      });
      y -= 16;
    });
    if (a.gates.length) {
      y -= 4;
      a.gates.forEach((g, i) => {
        const runIndex = a.runs.findIndex((r) => r.id === g.runId);
        para(
          `G${i + 1} on F${runIndex + 1}: ${formatFeet(g.width_ft)} ${g.swing === "sliding" ? "sliding" : `swing ${g.swing}`}${g.electrical ? ", electric operator" : ""}`,
          9.5,
        );
      });
    }
    if (a.scaleFeet)
      para(
        `Lengths measured from the survey using a ${formatFeet(a.scaleFeet)} reference dimension. Verify in the field before ordering material.`,
        8.5,
        font,
        muted,
      );
  }

  // ── Survey markup page ───────────────────────────────────────────────────
  if (a.markup) {
    const landscape = a.markup.width > a.markup.height;
    const PW = landscape ? 792 : 612;
    const PH = landscape ? 612 : 792;
    const sp = doc.addPage([PW, PH]);
    const img = await doc.embedJpg(a.markup.bytes);
    const top = 44;
    const legendH = 34;
    const maxW = PW - 48;
    const maxH = PH - top - legendH - 24;
    const s = Math.min(maxW / a.markup.width, maxH / a.markup.height);
    const iw = a.markup.width * s;
    const ih = a.markup.height * s;
    sp.drawText(safe(`Survey — proposed fence${a.jobNumber ? ` · Job ${a.jobNumber}` : ""}`), {
      x: 24,
      y: PH - 30,
      size: 13,
      font: bold,
      color: ink,
    });
    if (a.address)
      sp.drawText(safe(a.address), { x: 24, y: PH - 42, size: 9, font, color: muted });
    sp.drawImage(img, { x: (PW - iw) / 2, y: PH - top - 6 - ih, width: iw, height: ih });
    sp.drawRectangle({
      x: (PW - iw) / 2,
      y: PH - top - 6 - ih,
      width: iw,
      height: ih,
      borderColor: rgb(0.75, 0.75, 0.75),
      borderWidth: 0.5,
    });

    // Legend
    const ly = 30;
    const fence = rgb(0.882, 0.114, 0.282);
    sp.drawLine({ start: { x: 24, y: ly }, end: { x: 60, y: ly }, thickness: 2.5, color: fence });
    for (const cx of [36, 50]) {
      sp.drawLine({ start: { x: cx - 3, y: ly - 3 }, end: { x: cx + 3, y: ly + 3 }, thickness: 1, color: fence });
      sp.drawLine({ start: { x: cx - 3, y: ly + 3 }, end: { x: cx + 3, y: ly - 3 }, thickness: 1, color: fence });
    }
    sp.drawText("Proposed fence (X)", { x: 66, y: ly - 3, size: 8.5, font, color: ink });
    const g = rgb(0.145, 0.388, 0.922);
    sp.drawRectangle({ x: 170, y: ly - 3, width: 6, height: 6, color: g });
    sp.drawText("Gate", { x: 182, y: ly - 3, size: 8.5, font, color: ink });
    const summary = [
      a.totals.linear_ft != null ? `${a.totals.linear_ft} LF total` : null,
      a.totals.max_height_ft ? `max ${formatFeet(a.totals.max_height_ft)} high` : null,
      a.totals.gate_count ? `${a.totals.gate_count} gate(s)` : null,
      FENCE_MATERIALS.find((m) => m.value === a.project.material)?.label ?? null,
    ]
      .filter(Boolean)
      .join(" · ");
    sp.drawText(safe(summary), { x: 220, y: ly - 3, size: 8.5, font: bold, color: ink });
    sp.drawText(safe(`Prepared with PermitAIO${a.preparedBy ? ` by ${a.preparedBy}` : ""}`), {
      x: 24,
      y: 14,
      size: 7.5,
      font,
      color: muted,
    });
  }

  return doc.save();
}
