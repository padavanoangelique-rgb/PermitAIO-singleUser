import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ScheduleWindowRow } from "./schedule-pdf";

// Official BORA Policy 20-01 "County Uniform Retrofit Window & Door Schedule" as supplied by
// Palm Beach County and Miami-Dade County (the two forms have identical layouts).
//
// Printed exactly the way the Broward schedule prints: the data is stamped onto the official
// blank form at the form's own field positions (Helvetica 8.5pt, centered, "X" marks for the
// Yes/No and zone boxes). Coordinates were measured from the AcroForm field rectangles of the
// supplied templates (public/templates/pbc-window-door-schedule.pdf and
// miami-dade-window-door-schedule.pdf).
const COLS: Record<string, [number, number]> = {
  id: [33.4, 80.5],
  prod: [82.8, 161.6],
  app_pos: [165.1, 197.5],
  app_neg: [200.8, 233.2],
  des_pos: [236.5, 268.9],
  des_neg: [273.8, 306.2],
  width: [308.9, 334.9],
  height: [342.5, 368.4],
  area: [371.3, 409.5],
  z4: [412.2, 444.6],
  z5: [447.9, 480.3],
  igy: [484.4, 516.8],
  ign: [520.1, 552.5],
  esy: [556.6, 589.0],
  esn: [591.9, 624.3],
  nsy: [628.5, 660.9],
  nsn: [664.5, 696.9],
  muy: [700.3, 732.7],
  mun: [736.0, 768.4],
};

// [bottom, top] for each of the 11 row slots on the form.
const ROW_YS: [number, number][] = [
  [398.6, 428.1],
  [364.0, 393.5],
  [330.0, 359.5],
  [294.8, 324.3],
  [260.0, 289.6],
  [225.8, 255.3],
  [190.1, 219.6],
  [155.1, 184.6],
  [120.6, 150.1],
  [84.9, 114.4],
  [50.9, 80.4],
];

// [x0, y0, x1, y1]
const NAME_FIELD: [number, number, number, number] = [69.8, 563.8, 248.3, 581.8];
const ADDR_FIELD: [number, number, number, number] = [318.5, 563.8, 573.6, 581.8];
const CONTACT_FIELD: [number, number, number, number] = [633.7, 563.8, 765.7, 581.8];
const PAGE_FIELD: [number, number, number, number] = [709.1, 584.1, 729.9, 606.1];
const TOTAL_FIELD: [number, number, number, number] = [747.2, 584.1, 768.1, 606.1];
const ROWS_PER_PAGE = 11;

export async function fillPbcOfficialSchedule(
  templateBytes: Uint8Array,
  openings: ScheduleWindowRow[],
  options: { applicant?: string; address?: string; contact?: string } = {},
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const black = rgb(0, 0, 0);

  function drawCentered(page: ReturnType<typeof pdfDoc.getPage>, text: unknown, range: [number, number], y: number, size = 8.5) {
    const s = text === null || text === undefined ? "" : String(text);
    if (!s) return;
    const w = font.widthOfTextAtSize(s, size);
    const cx = (range[0] + range[1]) / 2;
    page.drawText(s, { x: cx - w / 2, y, size, font, color: black });
  }
  function drawLeft(page: ReturnType<typeof pdfDoc.getPage>, text: unknown, field: [number, number, number, number], size = 8.5) {
    const s = text === null || text === undefined ? "" : String(text);
    if (!s) return;
    page.drawText(s, { x: field[0] + 3, y: (field[1] + field[3]) / 2 - 3, size, font, color: black });
  }

  const totalRows = openings.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / ROWS_PER_PAGE));

  const pageList = [pdfDoc.getPage(0)];
  for (let i = 1; i < totalPages; i++) {
    const [copied] = await pdfDoc.copyPages(pdfDoc, [0]);
    pdfDoc.addPage(copied);
    pageList.push(copied);
  }

  for (let p = 0; p < totalPages; p++) {
    const page = pageList[p];

    drawLeft(page, options.applicant, NAME_FIELD);
    drawLeft(page, options.address, ADDR_FIELD);
    drawLeft(page, options.contact, CONTACT_FIELD);
    drawCentered(page, p + 1, [PAGE_FIELD[0], PAGE_FIELD[2]], (PAGE_FIELD[1] + PAGE_FIELD[3]) / 2 - 3);
    drawCentered(page, totalPages, [TOTAL_FIELD[0], TOTAL_FIELD[2]], (TOTAL_FIELD[1] + TOTAL_FIELD[3]) / 2 - 3);

    const startIdx = p * ROWS_PER_PAGE;
    const endIdx = Math.min(startIdx + ROWS_PER_PAGE, totalRows);
    for (let idx = startIdx; idx < endIdx; idx++) {
      const win = openings[idx];
      const rowY = ROW_YS[idx - startIdx];
      const cy = (rowY[0] + rowY[1]) / 2 - 3;
      const area = win.width && win.height ? ((Number(win.width) * Number(win.height)) / 144).toFixed(2) : "";
      const zone = win.zone ?? "";
      const mullionRequired = win.mullionRequired ?? "";

      drawCentered(page, idx + 1, COLS.id, cy);
      drawCentered(page, win.productApproval, COLS.prod, cy);
      drawCentered(page, win.pressurePos, COLS.app_pos, cy);
      drawCentered(page, win.pressureNeg, COLS.app_neg, cy);
      drawCentered(page, win.designPos, COLS.des_pos, cy);
      drawCentered(page, win.designNeg, COLS.des_neg, cy);
      drawCentered(page, win.width, COLS.width, cy);
      drawCentered(page, win.height, COLS.height, cy);
      drawCentered(page, area, COLS.area, cy);
      drawCentered(page, "X", COLS[zone === "5-End" ? "z5" : "z4"], cy);
      drawCentered(page, "X", COLS.igy, cy); // Impact glazing: always Yes, same as the Broward schedule
      drawCentered(page, "X", COLS[win.existingShutters === true || win.existingShutters === "Yes" ? "esy" : "esn"], cy);
      drawCentered(page, "X", COLS[win.newShutters === true || win.newShutters === "Yes" ? "nsy" : "nsn"], cy);
      drawCentered(page, "X", COLS[mullionRequired === "Yes" ? "muy" : "mun"], cy);
    }
  }

  return pdfDoc.save();
}
