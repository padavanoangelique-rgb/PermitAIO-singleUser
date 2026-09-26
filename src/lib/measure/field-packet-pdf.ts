import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function buildMeasureFieldPacketPdf(args: {
  jobNumber: string;
  clientName: string;
  address: string;
  files: { bytes: Uint8Array; name: string }[];
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.09, 0.09, 0.09);
  const muted = rgb(0.4, 0.4, 0.4);
  const blue = rgb(0.08, 0.42, 0.87);
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 36;

  const cover = doc.addPage([pageWidth, pageHeight]);
  cover.drawText("Measure Tech field packet", {
    x: margin,
    y: pageHeight - 64,
    size: 18,
    font: bold,
    color: ink,
  });
  cover.drawText(`Job ${args.jobNumber}`, { x: margin, y: pageHeight - 96, size: 14, font: bold, color: blue });
  cover.drawText(args.clientName || `Job ${args.jobNumber}`, { x: margin, y: pageHeight - 118, size: 12, font, color: ink });
  cover.drawText(args.address || "No address", { x: margin, y: pageHeight - 136, size: 10, font, color: muted });
  cover.drawText(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
    { x: margin, y: pageHeight - 160, size: 10, font, color: muted },
  );
  cover.drawText(`${args.files.length} sheet${args.files.length === 1 ? "" : "s"}`, {
    x: margin,
    y: pageHeight - 184,
    size: 10,
    font,
    color: muted,
  });
  cover.drawText("Photos and PDFs from the field. Not a CAD drawing.", {
    x: margin,
    y: pageHeight - 208,
    size: 10,
    font,
    color: muted,
  });

  for (let i = 0; i < args.files.length; i += 1) {
    const file = args.files[i];
    const name = file.name.toLowerCase();
    if (name.endsWith(".pdf")) {
      try {
        const src = await PDFDocument.load(file.bytes);
        const pages = await doc.copyPages(src, src.getPageIndices());
        for (const page of pages) doc.addPage(page);
      } catch {
        const page = doc.addPage([pageWidth, pageHeight]);
        page.drawText(`${i + 1}. ${file.name}`, { x: margin, y: pageHeight - 48, size: 11, font: bold, color: ink });
        page.drawText("Could not open this PDF.", { x: margin, y: pageHeight - 80, size: 10, font, color: muted });
      }
      continue;
    }

    const page = doc.addPage([pageWidth, pageHeight]);
    page.drawText(`${i + 1}. ${file.name}`, { x: margin, y: pageHeight - 48, size: 11, font: bold, color: ink });
    try {
      const image = name.endsWith(".png") ? await doc.embedPng(file.bytes) : await doc.embedJpg(file.bytes);
      const maxW = pageWidth - margin * 2;
      const maxH = pageHeight - 96;
      const scale = Math.min(maxW / image.width, maxH / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      page.drawImage(image, { x: margin, y: pageHeight - 64 - h, width: w, height: h });
    } catch {
      page.drawText("Could not embed this photo. Retake as a JPEG if you can.", {
        x: margin,
        y: pageHeight - 80,
        size: 10,
        font,
        color: muted,
      });
    }
  }

  return doc.save();
}
