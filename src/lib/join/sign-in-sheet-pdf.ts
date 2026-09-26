import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

const NAVY = rgb(0.05, 0.14, 0.32);
const INK = rgb(0.09, 0.1, 0.12);
const MUTED = rgb(0.38, 0.4, 0.44);
const LINE = rgb(0.82, 0.84, 0.86);
const PAPER = rgb(1, 1, 1);
const GOLD = rgb(0.72, 0.55, 0.18);

function wrap(text: string, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number, max: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= max) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export async function buildSignInSheetPdf(opts: {
  companyName: string;
  joinCode: string | null;
  joinUrl: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const { width, height } = page.getSize();

  page.drawRectangle({ x: 0, y: height - 88, width, height: 88, color: NAVY });
  page.drawRectangle({ x: 0, y: height - 92, width, height: 4, color: GOLD });
  page.drawText("PERMITAIO", {
    x: 48,
    y: height - 42,
    size: 11,
    font: bold,
    color: GOLD,
  });
  page.drawText("Easy sign-in", {
    x: 48,
    y: height - 72,
    size: 26,
    font: bold,
    color: PAPER,
  });

  const company = opts.companyName.trim() || "________________________";
  const code = opts.joinCode?.trim() || "____";

  page.drawText("Your company", { x: 48, y: height - 128, size: 9, font: bold, color: MUTED });
  page.drawText(company, { x: 48, y: height - 150, size: 16, font: bold, color: INK });

  page.drawText("4-digit company code", { x: 48, y: height - 178, size: 9, font: bold, color: MUTED });
  page.drawRectangle({
    x: 48,
    y: height - 228,
    width: 160,
    height: 40,
    borderColor: NAVY,
    borderWidth: 1.5,
  });
  page.drawText(code, {
    x: 64,
    y: height - 216,
    size: 22,
    font: bold,
    color: NAVY,
  });

  const qrPng = await QRCode.toBuffer(opts.joinUrl, {
    type: "png",
    margin: 1,
    width: 420,
    errorCorrectionLevel: "M",
  });
  const qrImage = await doc.embedPng(qrPng);
  page.drawImage(qrImage, { x: 380, y: height - 268, width: 168, height: 168 });
  page.drawText("Scan to join", {
    x: 414,
    y: height - 286,
    size: 10,
    font: bold,
    color: MUTED,
  });

  page.drawLine({
    start: { x: 48, y: height - 310 },
    end: { x: width - 48, y: height - 310 },
    thickness: 1,
    color: LINE,
  });

  page.drawText("New — first time only", {
    x: 48,
    y: height - 340,
    size: 13,
    font: bold,
    color: NAVY,
  });

  const steps = [
    "Your manager already assigned your role. Use the same email they put in Settings.",
    "Open permitaio.com/join  —  or scan the QR on this sheet.",
    "Type the company name and the 4-digit code above.",
    "Type your work email. Create your own password (8+ characters). Confirm it.",
    "You’re in. Your role is already set — you do not pick one.",
  ];

  let y = height - 368;
  steps.forEach((step, i) => {
    page.drawCircle({ x: 60, y: y + 4, size: 10, color: NAVY });
    const n = String(i + 1);
    page.drawText(n, {
      x: n.length === 1 ? 57 : 54,
      y: y,
      size: 10,
      font: bold,
      color: PAPER,
    });
    const lines = wrap(step, regular, 12, 460);
    lines.forEach((line, li) => {
      page.drawText(line, { x: 80, y: y - li * 16, size: 12, font: regular, color: INK });
    });
    y -= 16 * lines.length + 14;
  });

  y -= 8;
  page.drawRectangle({
    x: 48,
    y: y - 78,
    width: width - 96,
    height: 86,
    borderColor: GOLD,
    borderWidth: 1.25,
  });
  page.drawText("Every day after that", {
    x: 64,
    y: y - 22,
    size: 13,
    font: bold,
    color: NAVY,
  });
  page.drawText("permitaio.com/login", {
    x: 64,
    y: y - 44,
    size: 16,
    font: bold,
    color: INK,
  });
  page.drawText("Same email. The password you created. Do not share it.", {
    x: 64,
    y: y - 64,
    size: 11,
    font: regular,
    color: MUTED,
  });

  page.drawText("Forgot it? Use Forgot password on the login page — the reset goes to your email.", {
    x: 48,
    y: 64,
    size: 10,
    font: regular,
    color: MUTED,
  });
  page.drawText("PermitAIO  ·  Windows & Doors  ·  One job number", {
    x: 48,
    y: 44,
    size: 9,
    font: bold,
    color: NAVY,
  });

  return doc.save();
}
