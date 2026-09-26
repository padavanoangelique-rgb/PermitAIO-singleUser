/**
 * Client-only helpers that turn an uploaded field survey (PDF or image) into
 * a flat canvas the fence builder can draw on and export.
 *
 * PDFs are rasterized with pdf.js loaded from cdnjs on demand — the same CDN
 * the floor plan creator already uses — so no new npm dependency is added.
 */

const PDFJS_VERSION = "3.11.174";
const PDFJS_SRC = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

/** Long edge of the rasterized survey, in pixels. Keeps drawings sharp but PDFs small. */
export const SURVEY_TARGET_EDGE = 3000;

type PdfJsPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
};
type PdfJsDoc = { numPages: number; getPage: (n: number) => Promise<PdfJsPage> };
type PdfJsLib = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (o: { data: Uint8Array }) => { promise: Promise<PdfJsDoc> };
};

let pdfjsPromise: Promise<PdfJsLib> | null = null;

function loadPdfJs(): Promise<PdfJsLib> {
  const w = window as unknown as { pdfjsLib?: PdfJsLib };
  if (w.pdfjsLib) return Promise.resolve(w.pdfjsLib);
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = new Promise<PdfJsLib>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = PDFJS_SRC;
    s.async = true;
    s.onload = () => {
      const lib = (window as unknown as { pdfjsLib?: PdfJsLib }).pdfjsLib;
      if (!lib) {
        reject(new Error("PDF reader did not load."));
        return;
      }
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      resolve(lib);
    };
    s.onerror = () => {
      pdfjsPromise = null;
      reject(new Error("Could not load the PDF reader. Check your connection, or upload the survey as a JPG/PNG."));
    };
    document.head.appendChild(s);
  });
  return pdfjsPromise;
}

export type LoadedSurvey = {
  canvas: HTMLCanvasElement;
  pageCount: number;
  page: number;
};

export function isPdf(file: { type?: string; name?: string }) {
  return file.type === "application/pdf" || (file.name ?? "").toLowerCase().endsWith(".pdf");
}

export async function loadSurvey(file: Blob, page = 1, name?: string): Promise<LoadedSurvey> {
  const fileName = name ?? (file as Blob & { name?: string }).name ?? "";
  if (isPdf({ type: file.type, name: fileName })) {
    const lib = await loadPdfJs();
    const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const n = Math.min(Math.max(1, page), doc.numPages);
    const p = await doc.getPage(n);
    const base = p.getViewport({ scale: 1 });
    const scale = SURVEY_TARGET_EDGE / Math.max(base.width, base.height);
    const vp = p.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available in this browser.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await p.render({ canvasContext: ctx, viewport: vp }).promise;
    return { canvas, pageCount: doc.numPages, page: n };
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read that image. Use a PDF, JPG, or PNG."));
      el.src = url;
    });
    const scale = Math.min(1, SURVEY_TARGET_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available in this browser.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { canvas, pageCount: 1, page: 1 };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Rotates the rasterized survey 90° clockwise (surveys are often scanned sideways). */
export function rotateCanvas90(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = src.height;
  out.height = src.width;
  const ctx = out.getContext("2d");
  if (!ctx) return src;
  ctx.translate(out.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(src, 0, 0);
  return out;
}
