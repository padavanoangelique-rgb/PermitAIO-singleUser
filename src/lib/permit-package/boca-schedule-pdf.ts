import { PDFDocument } from "pdf-lib";
import type { ScheduleWindowRow } from "./schedule-pdf";

const BOCA_TEMPLATE_URL = "/templates/boca-window-door-schedule.pdf";
const ROWS_PER_PAGE = 12;

function yesNo(v: unknown): string {
  if (v === true || v === "Yes" || v === "yes" || v === "true") return "Yes";
  if (v === false || v === "No" || v === "no" || v === "false") return "No";
  return v == null || v === "" ? "" : String(v);
}

function zone(v: unknown): string {
  const s = String(v ?? "");
  if (s === "5-End" || s === "5") return "5";
  if (s === "4-Inter" || s === "4") return "4";
  return s;
}

function size(win: ScheduleWindowRow): string {
  const w = win.width == null ? "" : String(win.width);
  const h = win.height == null ? "" : String(win.height);
  if (w && h) return `${w} x ${h}`;
  return w || h;
}

function setText(form: ReturnType<PDFDocument["getForm"]>, name: string, value: string) {
  if (!value) return;
  try {
    form.getTextField(name).setText(String(value).slice(0, 80));
  } catch {
    /* field name drift */
  }
}

function approvedPosName(n: number) {
  return n === 1 ? "Products Approved (+) Pressure PSF_1" : `Products Approved Pressure (+) PSF_${n}`;
}

function fillPage(
  form: ReturnType<PDFDocument["getForm"]>,
  openings: ScheduleWindowRow[],
  startIndex: number,
) {
  for (let i = 0; i < ROWS_PER_PAGE; i++) {
    const win = openings[startIndex + i];
    const n = i + 1;
    if (!win) continue;
    setText(form, `Opening Location Number_${n}`, String(startIndex + i + 1));
    setText(form, `Size_${n}`, size(win));
    setText(form, `Zone  4 or 5_${n}`, zone(win.zone));
    setText(form, `Manufacturer_${n}`, String(win.manufacturer ?? ""));
    setText(form, `Product Approval or NOA Number_${n}`, String(win.productApproval ?? ""));
    setText(form, approvedPosName(n), String(win.pressurePos ?? ""));
    setText(form, `Products Approved Pressure (-) PSF_${n}`, String(win.pressureNeg ?? ""));
    setText(form, `Openings Required Pressure (+) PSF_${n}`, String(win.designPos ?? ""));
    setText(form, `Openings Required Pressure (-) PSF_${n}a`, String(win.designNeg ?? ""));
    setText(form, `Room Type_${n}`, String(win.location || win.type || ""));
    setText(form, `Emergency Escape  Yes No_${n}`, yesNo(win.egress));
    setText(form, `Mullion Required YesNo_${n}`, yesNo(win.mullionRequired));
    const shutter = win.newShutters ?? win.existingShutters;
    setText(form, `Shutter Required YesNo_${n}`, yesNo(shutter));
  }
}

export async function fillBocaOfficialSchedule(
  templateBytes: Uint8Array,
  openings: ScheduleWindowRow[],
  options: { address?: string; permitNumber?: string } = {},
): Promise<Uint8Array> {
  const pagesNeeded = Math.max(1, Math.ceil(Math.max(openings.length, 1) / ROWS_PER_PAGE));
  const first = await PDFDocument.load(templateBytes, { ignoreEncryption: true, updateMetadata: false });
  const out = await PDFDocument.create();

  for (let p = 0; p < pagesNeeded; p++) {
    const src = p === 0 ? first : await PDFDocument.load(templateBytes, { ignoreEncryption: true, updateMetadata: false });
    const form = src.getForm();
    setText(form, "Address", options.address || "");
    setText(form, "Permit Number", options.permitNumber || "");
    fillPage(form, openings, p * ROWS_PER_PAGE);
    try {
      form.updateFieldAppearances();
    } catch {
      /* appearance streams optional */
    }
    const [copied] = await out.copyPages(src, [0]);
    out.addPage(copied);
  }
  return out.save();
}

export async function buildBocaSchedulePdf(
  address: string,
  permitNumber: string,
  windows: ScheduleWindowRow[],
): Promise<Uint8Array | null> {
  const res = await fetch(BOCA_TEMPLATE_URL);
  if (!res.ok) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  return fillBocaOfficialSchedule(bytes, windows, { address, permitNumber });
}
