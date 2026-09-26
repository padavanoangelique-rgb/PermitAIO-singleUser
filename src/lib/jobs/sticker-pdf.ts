import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

/**
 * One job-identity sticker, reused for every scan purpose (permit
 * custody, warehouse pulling the right job, etc.) rather than a
 * feature-specific label — same physical sticker, same QR, whoever
 * scans it lands on /scan/[token] which adapts to what they can do.
 * Sized 4in x 3in — big enough to read the job number across a
 * warehouse aisle, small enough for a standard label sheet or a
 * regular printer with "actual size" printing.
 */
export async function buildJobStickerPdf(opts: {
  jobNumber: string;
  clientName: string;
  address: string;
  scanUrl: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const width = 4 * 72;
  const height = 3 * 72;
  const page = doc.addPage([width, height]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);

  const qrPng = await QRCode.toBuffer(opts.scanUrl, {
    type: "png",
    margin: 1,
    width: 400,
    errorCorrectionLevel: "M",
  });
  const qrImage = await doc.embedPng(qrPng);
  const qrSize = 150;
  page.drawImage(qrImage, {
    x: 16,
    y: height - qrSize - 16,
    width: qrSize,
    height: qrSize,
  });

  const textX = 16 + qrSize + 16;
  const textWidth = width - textX - 16;

  page.drawText("PermitAIO", {
    x: textX,
    y: height - 24,
    size: 9,
    font: regular,
    color: rgb(0.45, 0.45, 0.45),
  });

  page.drawText(opts.jobNumber, {
    x: textX,
    y: height - 56,
    size: 22,
    font: bold,
    color: rgb(0, 0, 0),
  });

  const clientLines = wrapText(opts.clientName, regular, 13, textWidth);
  let y = height - 80;
  for (const line of clientLines.slice(0, 2)) {
    page.drawText(line, { x: textX, y, size: 13, font: regular, color: rgb(0.1, 0.1, 0.1) });
    y -= 16;
  }

  const addressLines = wrapText(opts.address, regular, 10, textWidth);
  for (const line of addressLines.slice(0, 3)) {
    page.drawText(line, { x: textX, y, size: 10, font: regular, color: rgb(0.35, 0.35, 0.35) });
    y -= 13;
  }

  page.drawText("Scan to check permit status", {
    x: 16,
    y: 10,
    size: 8,
    font: regular,
    color: rgb(0.5, 0.5, 0.5),
  });

  return doc.save();
}

function wrapText(text: string, font: import("pdf-lib").PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(attempt, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = attempt;
    }
  }
  if (current) lines.push(current);
  return lines;
}
