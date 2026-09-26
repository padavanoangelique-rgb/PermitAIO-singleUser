import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { downloadReceiptBytes } from "./fees";
import type { JobFee } from "./fees";

const PAGE_W = 612; // Letter, portrait
const PAGE_H = 792;
const MARGIN = 40;

/**
 * pdf-lib's drawText auto-wraps onto multiple lines when a maxWidth is given,
 * but without an explicit lineHeight every wrapped line lands on the same
 * baseline — overlapping whatever is drawn below. Table cells must stay on
 * one line, so truncate to the column's pixel width instead of letting
 * drawText wrap.
 */
function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = `${text.slice(0, mid)}\u2026`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? `${text.slice(0, lo)}\u2026` : "\u2026";
}

function money(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function usDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}/${y}`;
}

interface ReportRow {
  fee: JobFee;
  jobNumber: string;
  clientName: string;
  permitTech: string;
}

const STAMP_BLUE = rgb(0.04, 0.32, 0.82);

/**
 * Overlays a small stamp directly onto a reprinted receipt page itself —
 * bottom-right corner, all blue text — with the Job # in large bold type
 * on top, the permit tech below it, and the fixed "PRODUCTION FOUR" label
 * at the very bottom. This is drawn ON the receipt image/PDF page (unlike
 * drawStampCoverPage, which stays on its own separate page) so the job is
 * traceable on the receipt itself, per explicit request. Kept small and
 * corner-anchored so it never covers the receipt's real content.
 */
function drawReceiptStamp(page: PDFPage, bold: PDFFont, jobNumber: string, permitTech: string) {
  const { width } = page.getSize();
  const margin = 18;
  // Display order top-to-bottom; drawn bottom-up below so the block sits
  // anchored to the bottom-right corner regardless of page size.
  const displayLines = [
    { text: `JOB #${jobNumber}`, size: 22 },
    { text: permitTech, size: 11 },
    { text: "PRODUCTION FOUR", size: 11 },
  ];
  const maxLineWidth = Math.max(...displayLines.map(({ text, size }) => bold.widthOfTextAtSize(text, size)));
  const totalTextHeight = displayLines.reduce((sum, { size }) => sum + size + 5, 0);
  const pad = 8;
  // A translucent white backing card behind the stamp keeps it legible
  // even when it lands over existing receipt text/ink in that corner —
  // it still reads as an overlay "stamp" rather than blending into the
  // original document.
  page.drawRectangle({
    x: width - margin - maxLineWidth - pad,
    y: margin - pad,
    width: maxLineWidth + pad * 2,
    height: totalTextHeight + pad,
    color: rgb(1, 1, 1),
    opacity: 0.85,
    borderColor: STAMP_BLUE,
    borderWidth: 1,
  });
  let y = margin;
  for (let i = displayLines.length - 1; i >= 0; i--) {
    const { text, size } = displayLines[i];
    const w = bold.widthOfTextAtSize(text, size);
    page.drawText(text, { x: width - margin - w, y, size, font: bold, color: STAMP_BLUE });
    y += size + 5;
  }
}

/**
 * Appends the stamped receipt itself directly after the summary report —
 * no separate per-receipt cover page. Every fee's job #, client, tech,
 * category, jurisdiction, amount and paid date already appears as a row in
 * the summary table at the front of the document, so a duplicate detail
 * page per receipt would just repeat that same information. Fees with no
 * receipt on file (or one that can't be reprinted here) are simply skipped —
 * the summary table row is still there, there just isn't a receipt page to
 * show; the error is logged so it isn't silently lost.
 */
async function appendReceiptPages(
  doc: PDFDocument,
  bold: PDFFont,
  row: ReportRow,
): Promise<void> {
  const fee = row.fee;
  if (!fee.receipt_storage_path) return;
  try {
    const bytes = await downloadReceiptBytes(fee.receipt_storage_path);
    const mime = fee.receipt_mime_type ?? "";
    if (mime === "application/pdf" || fee.receipt_file_name?.toLowerCase().endsWith(".pdf")) {
      const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const copied = await doc.copyPages(srcDoc, srcDoc.getPageIndices());
      copied.forEach((p) => {
        doc.addPage(p);
        drawReceiptStamp(p, bold, row.jobNumber, row.permitTech);
      });
      return;
    }
    // Image receipt (jpg/png) — the image on its own page with the job #
    // stamped directly on it (bottom-right corner), no separate cover page.
    const isPng = mime === "image/png" || fee.receipt_file_name?.toLowerCase().endsWith(".png");
    const image = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    const page = doc.addPage([PAGE_W, PAGE_H]);
    const maxW = PAGE_W - MARGIN * 2;
    const maxH = PAGE_H - MARGIN * 2;
    const scale = Math.min(maxW / image.width, maxH / image.height, 1);
    const w = image.width * scale;
    const h = image.height * scale;
    page.drawImage(image, { x: (PAGE_W - w) / 2, y: (PAGE_H - h) / 2, width: w, height: h });
    drawReceiptStamp(page, bold, row.jobNumber, row.permitTech);
  } catch (err) {
    console.error("Fee report: couldn't embed receipt", fee.id, err);
  }
}

function drawSummaryTable(
  page: PDFPage,
  startY: number,
  font: PDFFont,
  bold: PDFFont,
  rows: ReportRow[],
  showJobColumn: boolean,
): number {
  const cols = showJobColumn
    ? [
        { label: "Job #", w: 60 },
        { label: "Client", w: 90 },
        { label: "Category", w: 100 },
        { label: "Jurisdiction", w: 80 },
        { label: "Paid", w: 60 },
        { label: "Notes", w: 90 },
        { label: "Amount", w: 52 },
      ]
    : [
        { label: "Category", w: 130 },
        { label: "Jurisdiction", w: 110 },
        { label: "Paid date", w: 80 },
        { label: "Notes", w: 130 },
        { label: "Amount", w: 82 },
      ];
  let y = startY;
  let x = MARGIN;
  const rowH = 16;
  page.drawRectangle({ x: MARGIN, y: y - 4, width: PAGE_W - MARGIN * 2, height: rowH, color: rgb(0.12, 0.23, 0.37) });
  for (const col of cols) {
    page.drawText(col.label, { x: x + 3, y: y, size: 8, font: bold, color: rgb(1, 1, 1) });
    x += col.w;
  }
  y -= rowH;
  let total = 0;
  for (const row of rows) {
    const fee = row.fee;
    total += fee.amount;
    x = MARGIN;
    const values = showJobColumn
      ? [row.jobNumber, row.clientName, fee.category, fee.jurisdiction ?? "—", usDate(fee.paid_date), fee.notes ?? "", money(fee.amount)]
      : [fee.category, fee.jurisdiction ?? "—", usDate(fee.paid_date), fee.notes ?? "", money(fee.amount)];
    for (let i = 0; i < cols.length; i++) {
      const cellText = truncateToWidth(String(values[i]), font, 8, cols[i].w - 6);
      page.drawText(cellText, { x: x + 3, y, size: 8, font, color: rgb(0.15, 0.15, 0.15) });
      x += cols[i].w;
    }
    page.drawLine({ start: { x: MARGIN, y: y - 4 }, end: { x: PAGE_W - MARGIN, y: y - 4 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
    y -= rowH;
  }
  page.drawRectangle({ x: MARGIN, y: y - 4, width: PAGE_W - MARGIN * 2, height: rowH, color: rgb(0.93, 0.94, 0.96) });
  page.drawText("Total paid", { x: MARGIN + 3, y, size: 9, font: bold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(money(total), { x: PAGE_W - MARGIN - 60, y, size: 9, font: bold, color: rgb(0.1, 0.1, 0.1) });
  y -= rowH;
  return y;
}

/**
 * Builds the per-job fee report: a cover page (job #, client, tech, address,
 * summary table of every fee line item with a total) followed by every
 * receipt on file, each reprinted and stamped with the job #, client name,
 * tech, category, amount and paid date. Meant to be handed to accounting.
 */
export async function buildJobFeeReportPdf(
  job: { job_number: string; client_name: string; permit_tech: string; address: string | null },
  fees: JobFee[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const rows: ReportRow[] = fees.map((fee) => ({ fee, jobNumber: job.job_number, clientName: job.client_name, permitTech: job.permit_tech }));

  const cover = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  cover.drawText("Job Fee Report", { x: MARGIN, y, size: 18, font: bold, color: rgb(0.1, 0.1, 0.1) });
  y -= 24;
  cover.drawText(`Job #${job.job_number} — ${job.client_name}`, { x: MARGIN, y, size: 12, font: bold, color: rgb(0.2, 0.2, 0.2) });
  y -= 16;
  cover.drawText(`Permit tech: ${job.permit_tech}${job.address ? `  ·  ${job.address}` : ""}`, { x: MARGIN, y, size: 10, font, color: rgb(0.35, 0.35, 0.35) });
  y -= 12;
  cover.drawText(`Generated ${new Date().toLocaleString("en-US")}`, { x: MARGIN, y, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
  y -= 24;
  drawSummaryTable(cover, y, font, bold, rows, false);

  for (const row of rows) {
    await appendReceiptPages(doc, bold, row);
  }
  return doc.save();
}

/**
 * Builds a cross-job accounting report for a date range (day or week): a
 * summary table of every paid fee across all jobs in that window, followed
 * by every receipt on file, reprinted and stamped the same way as the
 * per-job report.
 */
export async function buildFeeReceiptsRangeReportPdf(
  orgName: string,
  rangeLabel: string,
  startIso: string,
  endIso: string,
  rows: ReportRow[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const cover = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  cover.drawText("Fee Receipts Report", { x: MARGIN, y, size: 18, font: bold, color: rgb(0.1, 0.1, 0.1) });
  y -= 22;
  cover.drawText(`${orgName} — ${rangeLabel} (${usDate(startIso)} – ${usDate(endIso)})`, { x: MARGIN, y, size: 11, font: bold, color: rgb(0.2, 0.2, 0.2) });
  y -= 14;
  cover.drawText(`Generated ${new Date().toLocaleString("en-US")}`, { x: MARGIN, y, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
  y -= 22;
  drawSummaryTable(cover, y, font, bold, rows, true);

  for (const row of rows) {
    await appendReceiptPages(doc, bold, row);
  }
  return doc.save();
}

export function downloadPdfBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes.slice().buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
