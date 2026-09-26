import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { OpeningLine } from "./openings";

export type ChecklistRow = OpeningLine & {
  received: boolean;
  broken: boolean;
  note: string;
};

export async function buildWarehouseChecklistPdf(args: {
  jobNumber: string;
  clientName: string;
  address: string;
  permitNumber: string;
  permitApproved: boolean;
  permitStatus: string;
  openings: ChecklistRow[];
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.09, 0.09, 0.09);
  const muted = rgb(0.4, 0.4, 0.4);
  const line = rgb(0.82, 0.82, 0.82);
  const blue = rgb(0.08, 0.42, 0.87);
  const ok = rgb(0.05, 0.45, 0.18);
  const warn = rgb(0.72, 0.32, 0.02);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 36;
  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function ensure(space: number) {
    if (y - space < margin + 12) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      header();
      columns();
    }
  }

  function header() {
    page.drawText("Warehouse receiving checklist", { x: margin, y: y - 14, size: 16, font: bold, color: ink });
    y -= 34;
    page.drawText(`Job ${args.jobNumber}`, { x: margin, y, size: 11, font: bold, color: ink });
    y -= 16;
    page.drawText(args.clientName, { x: margin, y, size: 11, font, color: ink });
    y -= 14;
    page.drawText(args.address || "No address", { x: margin, y, size: 9, font, color: muted });
    y -= 14;
    if (args.permitNumber) {
      page.drawText(`Permit ${args.permitNumber}`, { x: margin, y, size: 9, font, color: muted });
      y -= 16;
    } else {
      y -= 4;
    }

    const stamp = args.permitApproved ? "PERMIT APPROVED" : "PERMIT NOT APPROVED";
    const stampColor = args.permitApproved ? ok : warn;
    const stampW = bold.widthOfTextAtSize(stamp, 12) + 16;
    page.drawRectangle({
      x: margin,
      y: y - 6,
      width: stampW,
      height: 20,
      color: args.permitApproved ? rgb(0.88, 0.96, 0.9) : rgb(1, 0.93, 0.84),
      borderWidth: 1,
      borderColor: stampColor,
    });
    page.drawText(stamp, { x: margin + 8, y: y - 1, size: 12, font: bold, color: stampColor });
    if (args.permitStatus && args.permitStatus !== "Approved" && args.permitStatus !== "Approved and Printed") {
      page.drawText(args.permitStatus, { x: margin + stampW + 10, y: y, size: 9, font, color: muted });
    }
    y -= 28;
  }

  const cols: { label: string; x: number; w: number }[] = [
    { label: "In", x: margin, w: 22 },
    { label: "#", x: margin + 24, w: 24 },
    { label: "Location", x: margin + 50, w: 90 },
    { label: "Type", x: margin + 142, w: 64 },
    { label: "W", x: margin + 208, w: 32 },
    { label: "H", x: margin + 242, w: 32 },
    { label: "Product approval", x: margin + 276, w: 130 },
    { label: "Broken / note", x: margin + 408, w: pageWidth - margin - 408 },
  ];

  function fit(text: string, width: number, size = 8) {
    const max = Math.max(4, Math.floor(width / (size * 0.48)));
    return (text || "").slice(0, max);
  }

  function columns() {
    for (const c of cols) {
      page.drawText(c.label, { x: c.x, y, size: 8, font: bold, color: muted });
    }
    y -= 6;
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.6, color: line });
    y -= 12;
  }

  header();
  columns();

  for (const row of args.openings) {
    ensure(28);
    page.drawRectangle({
      x: cols[0].x,
      y: y - 2,
      width: 9,
      height: 9,
      borderWidth: 0.8,
      borderColor: ink,
      color: row.received ? blue : rgb(1, 1, 1),
    });
    if (row.received) {
      page.drawText("X", { x: cols[0].x + 1.5, y: y - 1, size: 8, font: bold, color: rgb(1, 1, 1) });
    }
    const cells = [
      { x: cols[1].x, w: cols[1].w, t: row.number },
      { x: cols[2].x, w: cols[2].w, t: row.location },
      { x: cols[3].x, w: cols[3].w, t: row.type },
      { x: cols[4].x, w: cols[4].w, t: row.width },
      { x: cols[5].x, w: cols[5].w, t: row.height },
      { x: cols[6].x, w: cols[6].w, t: row.productApproval || "—" },
      { x: cols[7].x, w: cols[7].w, t: row.broken ? `BROKEN${row.note ? ` — ${row.note}` : ""}` : row.note },
    ];
    for (const cell of cells) {
      page.drawText(fit(cell.t, cell.w), { x: cell.x, y, size: 8, font, color: row.broken ? rgb(0.6, 0.1, 0.1) : ink });
    }
    y -= 16;
    page.drawLine({ start: { x: margin, y: y + 10 }, end: { x: pageWidth - margin, y: y + 10 }, thickness: 0.3, color: line });
  }

  y -= 10;
  ensure(24);
  const inCount = args.openings.filter((o) => o.received).length;
  const broken = args.openings.filter((o) => o.broken).length;
  page.drawText(
    `${inCount} of ${args.openings.length} checked in${broken ? `  ·  ${broken} broken` : ""}`,
    { x: margin, y, size: 9, font: bold, color: ink },
  );
  y -= 16;
  page.drawText(args.permitApproved ? "Permit approved" : "Permit not approved — do not schedule until issued", {
    x: margin,
    y,
    size: 9,
    font: bold,
    color: args.permitApproved ? ok : warn,
  });

  return doc.save();
}
