import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type PatioPhoto = { bytes: Uint8Array; name: string; caption: string };

export async function buildPatioChecklistPdf(args: {
  jobNumber: string;
  clientName: string;
  rooms: string;
  floor: string;
  items: { label: string; answer: string }[];
  photos: PatioPhoto[];
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

  const page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 56;
  page.drawText("Patio / sunroom field checklist", { x: margin, y, size: 18, font: bold, color: ink });
  y -= 28;
  page.drawText(`Job ${args.jobNumber}`, { x: margin, y, size: 12, font: bold, color: blue });
  y -= 16;
  if (args.clientName) {
    page.drawText(args.clientName, { x: margin, y, size: 11, font, color: ink });
    y -= 16;
  }
  page.drawText(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
    { x: margin, y, size: 9, font, color: muted },
  );
  y -= 24;
  page.drawText("Rooms that lead out to the patio", { x: margin, y, size: 9, font, color: muted });
  y -= 14;
  const rooms = args.rooms || "Not listed";
  page.drawText(rooms.slice(0, 90), { x: margin, y, size: 11, font: bold, color: ink });
  y -= 20;
  page.drawText("Patio floor", { x: margin, y, size: 9, font, color: muted });
  y -= 14;
  page.drawText(args.floor, { x: margin, y, size: 11, font: bold, color: ink });
  y -= 24;

  for (const item of args.items) {
    page.drawText(item.label, { x: margin, y, size: 10, font, color: muted });
    page.drawText(item.answer, { x: margin + 280, y, size: 11, font: bold, color: ink });
    y -= 16;
  }

  y -= 8;
  page.drawText("Mark these on the floor plan before submittal:", { x: margin, y, size: 10, font: bold, color: ink });
  y -= 14;
  const marks =
    args.floor === "First floor"
      ? "Smoke alarm, interior light, exterior light, switch, interior outlet, exterior outlet"
      : "Patio location and rooms that open onto it";
  page.drawText(marks.slice(0, 95), { x: margin, y, size: 9, font, color: muted });

  for (const photo of args.photos) {
    const p = doc.addPage([pageWidth, pageHeight]);
    p.drawText(photo.caption, { x: margin, y: pageHeight - 48, size: 12, font: bold, color: ink });
    try {
      const img = photo.name.toLowerCase().endsWith(".png")
        ? await doc.embedPng(photo.bytes)
        : await doc.embedJpg(photo.bytes);
      const maxW = pageWidth - margin * 2;
      const maxH = pageHeight - 96;
      const scale = Math.min(maxW / img.width, maxH / img.height);
      p.drawImage(img, {
        x: margin,
        y: pageHeight - 64 - img.height * scale,
        width: img.width * scale,
        height: img.height * scale,
      });
    } catch {
      p.drawText("Could not embed this photo.", { x: margin, y: pageHeight - 80, size: 10, font, color: muted });
    }
  }

  return doc.save();
}
