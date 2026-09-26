import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function buildPmPhotoReportPdf(args: {
  jobNumber: string;
  clientName: string;
  address: string;
  pmName: string;
  photos: { bytes: Uint8Array; name: string; caption?: string }[];
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
  cover.drawText("Project manager photo report", {
    x: margin,
    y: pageHeight - 64,
    size: 18,
    font: bold,
    color: ink,
  });
  cover.drawText(`Job ${args.jobNumber}`, { x: margin, y: pageHeight - 96, size: 14, font: bold, color: blue });
  cover.drawText(args.clientName, { x: margin, y: pageHeight - 118, size: 12, font, color: ink });
  cover.drawText(args.address || "No address", { x: margin, y: pageHeight - 136, size: 10, font, color: muted });
  cover.drawText(`PM: ${args.pmName}`, { x: margin, y: pageHeight - 160, size: 10, font, color: ink });
  cover.drawText(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
    { x: margin, y: pageHeight - 176, size: 10, font, color: muted },
  );
  cover.drawText(`${args.photos.length} photo${args.photos.length === 1 ? "" : "s"}`, {
    x: margin,
    y: pageHeight - 200,
    size: 10,
    font,
    color: muted,
  });

  for (let i = 0; i < args.photos.length; i += 1) {
    const photo = args.photos[i];
    const page = doc.addPage([pageWidth, pageHeight]);
    page.drawText(`${i + 1}. ${photo.caption || photo.name}`, {
      x: margin,
      y: pageHeight - 48,
      size: 11,
      font: bold,
      color: ink,
    });
    try {
      const jpg = photo.name.toLowerCase().endsWith(".png")
        ? await doc.embedPng(photo.bytes)
        : await doc.embedJpg(photo.bytes);
      const maxW = pageWidth - margin * 2;
      const maxH = pageHeight - 96;
      const scale = Math.min(maxW / jpg.width, maxH / jpg.height);
      const w = jpg.width * scale;
      const h = jpg.height * scale;
      page.drawImage(jpg, { x: margin, y: pageHeight - 64 - h, width: w, height: h });
    } catch {
      page.drawText("Could not embed this photo.", { x: margin, y: pageHeight - 80, size: 10, font, color: muted });
    }
  }

  return doc.save();
}
