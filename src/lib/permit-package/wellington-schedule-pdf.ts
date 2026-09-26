import { PDFDocument, StandardFonts, rgb, PDFName, PDFBool, AnnotationFlags, type PDFFont, type PDFPage } from "pdf-lib";
import { WELLINGTON_ROW_FIELDS } from "./wellington-fields";

export interface WellingtonOpening {
  type?: string | null;
  width?: number | string | null;
  height?: number | string | null;
  zone?: string | null;
  egress?: boolean | string | null;
  designPos?: number | string | null;
  designNeg?: number | string | null;
  pressurePos?: number | string | null;
  pressureNeg?: number | string | null;
  productApproval?: string | null;
  manufacturer?: string | null;
  series?: string | null;
}

function typeCode(type: string | null | undefined) {
  const t = String(type || "").toLowerCase();
  if (/single hung/.test(t) || t === "sh") return "SH";
  if (/double hung/.test(t) || t === "dh") return "DH";
  if (/fixed|picture/.test(t) || t === "fix") return "FIX";
  if (/sliding glass/.test(t) || t === "sgd") return "SGD";
  if (/horizontal roller/.test(t) || t === "hr" || t === "xo" || t === "xox" || t === "ox") return "HR";
  if (/slider/.test(t) && !/glass door|egress/.test(t)) return "HR";
  if (/french/.test(t) || t === "fd") return "FD";
  if (/casement/.test(t) || t === "cas") return "CAS";
  if (/awning/.test(t) || t === "aw") return "AW";
  if (/overhead|garage/.test(t) || t === "oh") return "OH";
  if (/entry/.test(t)) return "FD";
  return String(type || "");
}

function isOverhead(type: string | null | undefined) {
  return /overhead|garage/i.test(String(type || ""));
}

export function wellingtonRequiredDp(win: WellingtonOpening, roofHeightFt?: number) {
  if (roofHeightFt && roofHeightFt > 30) return null;
  if (isOverhead(win.type)) {
    const w = Number(win.width) || 0;
    return w >= 144 ? { pos: "37.0", neg: "-41.2" } : { pos: "38.6", neg: "-43.7" };
  }
  if (win.zone === "5-End" || win.zone === "5") return { pos: "43.68", neg: "-58.52" };
  return { pos: "43.68", neg: "-47.32" };
}

export function formatPsf(v: unknown, asNeg = false) {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(String(v).replace(/^[+]/, "").replace(/psf/i, "").trim());
  if (!Number.isFinite(n)) return String(v);
  const abs = Math.abs(n);
  const body = Math.abs(abs - Math.round(abs)) < 0.001 ? String(Math.round(abs)) : String(Math.round(abs * 100) / 100);
  if (asNeg || n < 0) return `-${body}`;
  return `+${body}`;
}

function setCheck(form: ReturnType<PDFDocument["getForm"]>, name: string, on: boolean) {
  if (!on) return;
  try {
    form.getCheckBox(name).check();
  } catch {
    try {
      form.getRadioGroup(name).select("Yes");
    } catch {
      /* ignore */
    }
  }
}

function pageOfWidget(pdf: PDFDocument, widget: { P?: () => unknown }): PDFPage {
  const pages = pdf.getPages();
  try {
    const pref = widget.P?.();
    const match = pages.find((p) => p.ref === pref);
    if (match) return match;
  } catch {
    /* fall through */
  }
  return pages[0];
}

/** Draw the value once as page ink and hide the widget so printers cannot also print the form field. */
function writeInk(
  pdf: PDFDocument,
  form: ReturnType<PDFDocument["getForm"]>,
  font: PDFFont,
  name: string,
  value: string,
) {
  if (!value) return;
  let field;
  try {
    field = form.getTextField(name);
  } catch {
    return;
  }
  const widgets = field.acroField.getWidgets();
  for (const widget of widgets) {
    const rect = widget.getRectangle();
    const page = pageOfWidget(pdf, widget);
    let size = 7;
    let tw = font.widthOfTextAtSize(value, size);
    while (tw > rect.width - 2 && size > 5) {
      size -= 0.25;
      tw = font.widthOfTextAtSize(value, size);
    }
    const x = rect.x + Math.max(1, (rect.width - tw) / 2);
    const y = rect.y + (rect.height - size) / 2;
    page.drawText(value, { x, y, size, font, color: rgb(0, 0, 0) });
    try {
      widget.setFlagTo(AnnotationFlags.Hidden, true);
      widget.setFlagTo(AnnotationFlags.Print, false);
      widget.dict.delete(PDFName.of("AP"));
    } catch {
      /* ink is on the page */
    }
  }
}

export async function fillWellingtonOfficialWorksheet(
  templateBytes: Uint8Array,
  openings: WellingtonOpening[],
  options: { address?: string; clientName?: string; qualifierName?: string; roofHeightFt?: number } = {},
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(templateBytes, { ignoreEncryption: true, updateMetadata: false });
  const form = pdf.getForm();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const types = openings.map((o) => typeCode(o.type));
  setCheck(form, "Windows", types.some((t) => ["SH", "DH", "FIX", "HR", "CAS", "AW"].includes(t)));
  setCheck(form, "Doors Swinging Sliding", types.some((t) => t === "FD" || t === "SGD"));
  setCheck(form, "Doors Overhead Garage", types.some((t) => t === "OH"));

  const limit = Math.min(openings.length, 35);
  if (openings.length > 10) setCheck(form, "Additional Openings Needed on Continued Pages", true);
  if (openings.length > 35) setCheck(form, "Additional Openings Needed on Continued Pages_2", true);

  const rows: Array<{
    fields: (typeof WELLINGTON_ROW_FIELDS)[number];
    type: string;
    dims: string;
    reqPos: string;
    reqNeg: string;
    noaPos: string;
    noaNeg: string;
    approval: string;
  }> = [];

  for (let i = 0; i < limit; i++) {
    const win = openings[i];
    const fields = WELLINGTON_ROW_FIELDS[i + 1];
    if (!fields) continue;
    const zone5 = win.zone === "5-End" || win.zone === "5";
    setCheck(form, fields.zone4, !zone5);
    setCheck(form, fields.zone5, zone5);
    const egress = win.egress === true || win.egress === "Yes" || win.egress === "true";
    setCheck(form, fields.egress, egress);
    const dp = wellingtonRequiredDp(win, options.roofHeightFt);
    const w = win.width ? String(win.width).trim() : "";
    const h = win.height ? String(win.height).trim() : "";
    rows.push({
      fields,
      type: typeCode(win.type),
      dims: w && h ? `${w} x ${h}` : w || h,
      reqPos: formatPsf(dp?.pos ?? win.designPos, false),
      reqNeg: formatPsf(dp?.neg ?? win.designNeg, true),
      noaPos: formatPsf(win.pressurePos, false),
      noaNeg: formatPsf(win.pressureNeg, true),
      approval: win.productApproval ? String(win.productApproval) : "",
    });
  }

  try {
    form.updateFieldAppearances(font);
  } catch {
    try {
      form.updateFieldAppearances();
    } catch {
      /* checkboxes may already have appearances */
    }
  }

  writeInk(pdf, form, font, "SELECT ALL THAT APPLY", options.address || "");
  writeInk(pdf, form, font, "Qualifier Name", options.qualifierName || "");
  for (const row of rows) {
    writeInk(pdf, form, font, row.fields.type, row.type);
    writeInk(pdf, form, font, row.fields.dims, row.dims);
    writeInk(pdf, form, font, row.fields.reqPos, row.reqPos);
    writeInk(pdf, form, font, row.fields.reqNeg, row.reqNeg);
    writeInk(pdf, form, font, row.fields.noaPos, row.noaPos);
    writeInk(pdf, form, font, row.fields.noaNeg, row.noaNeg);
    writeInk(pdf, form, font, row.fields.approval, row.approval);
  }

  try {
    pdf.catalog.set(PDFName.of("NeedAppearances"), PDFBool.False);
  } catch {
    /* ignore */
  }

  return pdf.save();
}
