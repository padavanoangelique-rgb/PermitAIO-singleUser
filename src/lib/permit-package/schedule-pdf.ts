import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { matchMullions, mullionNoaNumber } from "@/lib/noa/match";
import type { FloorPlanMullion, FloorPlanWindow, NoaLibraryRow } from "@/lib/noa/match";

/**
 * Broward's official BORA Policy 20-01 "Uniform Retrofit Window & Door
 * Schedule" form. Overlay coordinates below are measured directly from the
 * real AcroForm field positions on this exact template — the same template
 * and coordinates the Floor Plans tab's own "Download Broward Schedule PDF"
 * button (ezPermitBuilder, public/floor-plan-creator.html) already uses, so
 * the Permit Package ZIP now prints an identical county-correct form
 * instead of the generic fallback table below.
 */
const BROWARD_TEMPLATE_URL = "/templates/broward-window-door-schedule.pdf";

const BROWARD_COLS: Record<string, [number, number]> = {
  id: [31.8, 79.0],
  prod: [81.4, 160.2],
  app_pos: [163.0, 195.4],
  app_neg: [199.5, 231.9],
  des_pos: [235.4, 267.8],
  des_neg: [271.4, 303.8],
  width: [305.3, 334.1],
  height: [339.6, 368.4],
  area: [369.5, 407.6],
  z4: [410.4, 442.8],
  z5: [446.7, 479.1],
  igy: [482.4, 514.8],
  ign: [518.5, 550.9],
  esy: [554.8, 587.2],
  esn: [591.0, 623.4],
  nsy: [626.8, 659.2],
  nsn: [662.1, 694.5],
  muy: [698.4, 730.8],
  mun: [734.6, 767.0],
};
// [bottom, top] for each of the 11 row slots the template actually has.
const BROWARD_ROW_YS: [number, number][] = [
  [373.1, 402.6],
  [340.9, 370.3],
  [308.8, 338.2],
  [276.5, 306.0],
  [244.3, 273.7],
  [212.2, 241.6],
  [179.9, 209.4],
  [147.7, 177.1],
  [115.6, 145.0],
  [83.3, 112.8],
  [51.1, 80.5],
];
const BROWARD_NAME_FIELD: [number, number, number, number] = [65.8, 549.2, 224.6, 570.2];
const BROWARD_ADDR_FIELD: [number, number, number, number] = [294.8, 549.2, 574.2, 570.2];
const BROWARD_CONTACT_FIELD: [number, number, number, number] = [633.2, 549.2, 764.8, 570.2];
const BROWARD_ROWS_PER_PAGE = 11;

/**
 * Builds the real Broward BORA Policy 20-01 Window & Door Schedule for this
 * job, overlaying schedule data onto the official blank template at the
 * exact field coordinates (mirrors ezPermitBuilder's own Broward schedule
 * button). Returns null if the template asset can't be loaded, so the
 * caller can fall back to the generic table rather than fail the whole ZIP.
 */
export async function buildBrowardSchedulePdf(
  clientName: string,
  jobAddress: string,
  windows: ScheduleWindowRow[],
  options: { heading?: string } = {},
): Promise<Uint8Array | null> {
  const res = await fetch(BROWARD_TEMPLATE_URL);
  if (!res.ok) return null;
  const templateBytes = new Uint8Array(await res.arrayBuffer());
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);
  const white = rgb(1, 1, 1);

  function drawCentered(page: ReturnType<typeof pdfDoc.getPage>, text: unknown, range: [number, number], y: number, size = 8.5) {
    const s = text == null ? "" : String(text);
    if (!s) return;
    const w = font.widthOfTextAtSize(s, size);
    const cx = (range[0] + range[1]) / 2;
    page.drawText(s, { x: cx - w / 2, y, size, font, color: black });
  }
  function drawLeftAligned(page: ReturnType<typeof pdfDoc.getPage>, text: unknown, x: number, y: number, size = 8.5) {
    const s = text == null ? "" : String(text);
    if (!s) return;
    page.drawText(s, { x, y, size, font, color: black });
  }

  const totalRows = windows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / BROWARD_ROWS_PER_PAGE));

  const pageList = [pdfDoc.getPage(0)];
  for (let i = 1; i < totalPages; i++) {
    const [copied] = await pdfDoc.copyPages(pdfDoc, [0]);
    pdfDoc.addPage(copied);
    pageList.push(copied);
  }

  for (let p = 0; p < totalPages; p++) {
    const page = pageList[p];

    // If a non-Broward county was chosen from the floor plan header picker,
    // white out the original "Broward County" title band and stamp the new
    // county name in its place. Broward keeps the original template as-is.
    if (options.heading && options.heading !== "Broward County") {
      const { width: pageW, height: pageH } = page.getSize();
      // Cover the original title text area at the top of the sheet.
      // Coordinates are in PDF points from the bottom-left; the Broward
      // template's title sits ~30pt down from the top edge and spans the
      // full page width. A generous white rectangle guarantees the old
      // "Broward County..." heading is fully hidden.
      page.drawRectangle({
        x: 0,
        y: pageH - 46,
        width: pageW,
        height: 32,
        color: white,
      });
      const titleSize = 14;
      const titleText = `${options.heading} Uniform Retrofit Window & Door Schedule`;
      const titleW = bold.widthOfTextAtSize(titleText, titleSize);
      page.drawText(titleText, {
        x: (pageW - titleW) / 2,
        y: pageH - 34,
        size: titleSize,
        font: bold,
        color: black,
      });
    }

    drawLeftAligned(page, clientName, BROWARD_NAME_FIELD[0] + 3, (BROWARD_NAME_FIELD[1] + BROWARD_NAME_FIELD[3]) / 2 - 3);
    drawLeftAligned(page, jobAddress, BROWARD_ADDR_FIELD[0] + 3, (BROWARD_ADDR_FIELD[1] + BROWARD_ADDR_FIELD[3]) / 2 - 3);
    drawLeftAligned(page, "", BROWARD_CONTACT_FIELD[0] + 3, (BROWARD_CONTACT_FIELD[1] + BROWARD_CONTACT_FIELD[3]) / 2 - 3);

    const startIdx = p * BROWARD_ROWS_PER_PAGE;
    const endIdx = Math.min(startIdx + BROWARD_ROWS_PER_PAGE, totalRows);
    for (let idx = startIdx; idx < endIdx; idx++) {
      const win = windows[idx];
      const rowIdxOnPage = idx - startIdx;
      const rowY = BROWARD_ROW_YS[rowIdxOnPage];
      const cy = (rowY[0] + rowY[1]) / 2 - 3;
      const area = win.width && win.height ? ((Number(win.width) * Number(win.height)) / 144).toFixed(2) : "";
      const zone = win.zone ?? "";
      const mullionRequired = win.mullionRequired ?? "";

      drawCentered(page, idx + 1, BROWARD_COLS.id, cy);
      drawCentered(page, win.productApproval, BROWARD_COLS.prod, cy);
      drawCentered(page, win.pressurePos, BROWARD_COLS.app_pos, cy);
      drawCentered(page, win.pressureNeg, BROWARD_COLS.app_neg, cy);
      drawCentered(page, win.designPos, BROWARD_COLS.des_pos, cy);
      drawCentered(page, win.designNeg, BROWARD_COLS.des_neg, cy);
      drawCentered(page, win.width, BROWARD_COLS.width, cy);
      drawCentered(page, win.height, BROWARD_COLS.height, cy);
      drawCentered(page, area, BROWARD_COLS.area, cy);
      drawCentered(page, "X", BROWARD_COLS[zone === "5-End" ? "z5" : "z4"], cy);
      drawCentered(page, "X", BROWARD_COLS.igy, cy); // Impact Glazing — always Yes, matching ezPermitBuilder
      drawCentered(page, "X", BROWARD_COLS[win.existingShutters === true || win.existingShutters === "Yes" ? "esy" : "esn"], cy);
      drawCentered(page, "X", BROWARD_COLS[win.newShutters === true || win.newShutters === "Yes" ? "nsy" : "nsn"], cy);
      drawCentered(page, "X", BROWARD_COLS[mullionRequired === "Yes" ? "muy" : "mun"], cy);
    }
  }

  return pdfDoc.save();
}

export interface ScheduleWindowRow extends FloorPlanWindow {
  width?: number | null;
  height?: number | null;
  type?: string | null;
  designPos?: number | string | null;
  designNeg?: number | string | null;
  pressurePos?: number | string | null;
  pressureNeg?: number | string | null;
  egress?: boolean | null;
  impactGlazing?: boolean | null;
  existingShutters?: boolean | string | null;
  newShutters?: boolean | string | null;
  zone?: string | null;
  mullionRequired?: string | null;
}

/**
 * Builds a plain, always-available window/door schedule PDF straight from
 * this job's floor-plan opening data (the same fields the ezPermitBuilder
 * tool stores per opening). This is a supporting summary for the Permit
 * Package ZIP — it does not replace the jurisdiction-specific schedule PDFs
 * still available inside the Floor Plans tab itself.
 */
export async function buildSchedulePdf(
  jobNumber: string,
  clientName: string,
  windows: ScheduleWindowRow[],
  mullions: FloorPlanMullion[],
  library: NoaLibraryRow[] = [],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 792; // letter, landscape
  const pageHeight = 612;
  const margin = 30;
  const cols: { key: keyof ScheduleWindowRow | "location" | "id"; label: string; width: number }[] = [
    { key: "id", label: "#", width: 26 },
    { key: "location", label: "Location", width: 110 },
    { key: "type", label: "Type", width: 60 },
    { key: "width", label: "W", width: 40 },
    { key: "height", label: "H", width: 40 },
    { key: "manufacturer", label: "Manufacturer", width: 100 },
    { key: "series", label: "Series", width: 80 },
    { key: "productApproval", label: "NOA / FL#", width: 90 },
    { key: "designPos", label: "DP (+)", width: 50 },
    { key: "designNeg", label: "DP (-)", width: 50 },
    { key: "egress", label: "Egress", width: 46 },
    { key: "impactGlazing", label: "Impact", width: 46 },
  ];
  const rowHeight = 16;
  const headerHeight = 20;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function drawHeader(jobLabel: string) {
    page.drawText("Window & Door Schedule", { x: margin, y, size: 14, font: bold, color: rgb(0.1, 0.1, 0.1) });
    y -= 18;
    page.drawText(jobLabel, { x: margin, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
    y -= 10;
    page.drawText(`Generated ${new Date().toLocaleString("en-US")}`, {
      x: margin,
      y,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    y -= 16;
  }

  function drawTableHeader() {
    let x = margin;
    page.drawRectangle({
      x: margin,
      y: y - headerHeight + 4,
      width: pageWidth - margin * 2,
      height: headerHeight,
      color: rgb(0.92, 0.93, 0.95),
    });
    for (const col of cols) {
      page.drawText(col.label, { x: x + 3, y: y - 12, size: 8, font: bold, color: rgb(0.15, 0.15, 0.15) });
      x += col.width;
    }
    y -= headerHeight;
  }

  drawHeader(`${jobNumber} — ${clientName}`);
  drawTableHeader();

  function cellText(v: unknown): string {
    if (v === null || v === undefined || v === "") return "—";
    if (typeof v === "boolean") return v ? "Yes" : "No";
    return String(v);
  }

  for (const w of windows) {
    if (y < margin + rowHeight) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      drawTableHeader();
    }
    let x = margin;
    const rowValues: Record<string, unknown> = {
      id: w.id,
      location: w.location,
      type: w.type,
      width: w.width,
      height: w.height,
      manufacturer: w.manufacturer,
      series: w.series,
      productApproval: w.productApproval,
      designPos: w.designPos,
      designNeg: w.designNeg,
      egress: w.egress,
      impactGlazing: w.impactGlazing,
    };
    for (const col of cols) {
      const text = cellText(rowValues[col.key as string]).slice(0, 24);
      page.drawText(text, { x: x + 3, y: y - 11, size: 7.5, font, color: rgb(0.1, 0.1, 0.1) });
      x += col.width;
    }
    page.drawLine({
      start: { x: margin, y: y - rowHeight + 2 },
      end: { x: pageWidth - margin, y: y - rowHeight + 2 },
      thickness: 0.4,
      color: rgb(0.85, 0.85, 0.85),
    });
    y -= rowHeight;
  }

  if (mullions.length > 0) {
    y -= 10;
    if (y < margin + 60) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText("Mullions", { x: margin, y, size: 11, font: bold, color: rgb(0.1, 0.1, 0.1) });
    y -= 16;
    // Same style as the openings table above: Mark, Orientation, Length, Product/Series, NOA #, Expiration, Notes.
    const mCols = [
      { label: "Mark", width: 34 },
      { label: "Orientation", width: 70 },
      { label: "Length / size", width: 90 },
      { label: "Product / series", width: 190 },
      { label: "NOA / FL#", width: 100 },
      { label: "Expires", width: 70 },
      { label: "Notes", width: 178 },
    ];
    const drawMullionHeader = () => {
      let hx = margin;
      page.drawRectangle({
        x: margin,
        y: y - headerHeight + 4,
        width: pageWidth - margin * 2,
        height: headerHeight,
        color: rgb(0.92, 0.93, 0.95),
      });
      for (const c of mCols) {
        page.drawText(c.label, { x: hx + 3, y: y - 12, size: 8, font: bold, color: rgb(0.15, 0.15, 0.15) });
        hx += c.width;
      }
      y -= headerHeight;
    };
    drawMullionHeader();
    mullions.forEach((m, i) => {
      if (y < margin + rowHeight) {
        page = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
        drawMullionHeader();
      }
      const noa = mullionNoaNumber(m);
      const match = noa ? matchMullions([m], library)[0]?.matches[0] : undefined;
      const product = match
        ? `${match.manufacturer}${match.series ? " — " + match.series : ""}`
        : String(m.mfr ?? "");
      const ori = String(m.orientation ?? "auto");
      const values = [
        `M${i + 1}`,
        ori.charAt(0).toUpperCase() + ori.slice(1),
        cellText(m.size),
        cellText(product),
        cellText(noa),
        cellText(match?.expiration_date ? String(match.expiration_date).slice(0, 10) : ""),
        cellText(m.notes),
      ];
      let mx = margin;
      values.forEach((v, k) => {
        const maxChars = Math.max(4, Math.floor(mCols[k].width / 4));
        page.drawText(v.slice(0, maxChars), { x: mx + 3, y: y - 11, size: 7.5, font, color: rgb(0.1, 0.1, 0.1) });
        mx += mCols[k].width;
      });
      page.drawLine({
        start: { x: margin, y: y - rowHeight + 2 },
        end: { x: pageWidth - margin, y: y - rowHeight + 2 },
        thickness: 0.4,
        color: rgb(0.85, 0.85, 0.85),
      });
      y -= rowHeight;
    });
  }

  if (windows.length === 0 && mullions.length === 0) {
    page.drawText("No window/door openings on file for this job yet.", {
      x: margin,
      y,
      size: 9,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  return doc.save();
}
