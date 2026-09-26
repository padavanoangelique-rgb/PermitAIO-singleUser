"use client";

import { createElement as h, useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { PDFDocument, rgb } from "pdf-lib";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { X, Circle as CircleIcon, Highlighter, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";

type Tool = "circle" | "highlight";
type Shape = { tool: Tool; page: number; x: number; y: number; w: number; h: number };

export interface NoaAnnotatorOpening {
      id: string | number;
      location: string;
      size: string;
}

export function NoaAnnotator(props: {
      jobId: string;
      orgId: string;
      noaLibraryId: string;
      storagePath: string;
      title: string;
      openings: NoaAnnotatorOpening[];
      onClose: () => void;
      onSaved: () => void;
}) {
      const { jobId, orgId, noaLibraryId, storagePath, title, openings, onClose, onSaved } = props;
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      const drawRef = useRef<HTMLCanvasElement | null>(null); const containerRef = useRef<HTMLDivElement | null>(null);
      const pdfDocRef = useRef<{ numPages: number; getPage: (n: number) => Promise<PdfJsPage> } | null>(null);
      const [tool, setTool] = useState<Tool>("circle");
      const [fullScreen, setFullScreen] = useState(false);
      const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
      const [pageNum, setPageNum] = useState(1);
      const [numPages, setNumPages] = useState(1);
      const [pageSizes, setPageSizes] = useState<Record<number, { width: number; height: number }>>({});
      const [shapes, setShapes] = useState<Shape[]>([]);
      const [saving, setSaving] = useState(false);
      const [error, setError] = useState<string | null>(null);
      const draggingRef = useRef<{ x: number; y: number } | null>(null);

  const renderPage = useCallback(async (num: number) => {
          const doc = pdfDocRef.current;
          const canvas = canvasRef.current;
          const overlay = drawRef.current;
          if (!doc || !canvas || !overlay) return;
          const page = await doc.getPage(num);
          const natural = page.getViewport({ scale: 1 }); const avail = containerRef.current; const availW = avail ? avail.clientWidth - 32 : natural.width; const availH = avail ? avail.clientHeight - 32 : natural.height; const fitScale = Math.max(Math.min(availW / natural.width, availH / natural.height), 0.1) || 1.5; const viewport = page.getViewport({ scale: fitScale });
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          overlay.width = viewport.width;
          overlay.height = viewport.height;
          setPageSizes((prev) => ({ ...prev, [num]: { width: viewport.width, height: viewport.height } }));
          const ctx = canvas.getContext("2d");
          if (ctx) await page.render({ canvasContext: ctx, viewport }).promise;
  }, []);

  useEffect(() => {
          let cancelled = false;
          (async () => {
                    const supabase = createClient();
                    const signed = await supabase.storage.from("noa-library").createSignedUrl(storagePath, 300);
                    if (signed.error || !signed.data) {
                                setError("Couldn't open that PDF.");
                                return;
                    }
                    const res = await fetch(signed.data.signedUrl);
                    const buf = new Uint8Array(await res.arrayBuffer());
                    if (cancelled) return;
                    setPdfBytes(buf);
                    const pdfjsLib = await import("pdfjs-dist");
                    pdfjsLib.GlobalWorkerOptions.workerSrc =
                                "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
                    const doc = await pdfjsLib.getDocument({ data: buf.slice() }).promise;
                    if (cancelled) return;
                    pdfDocRef.current = doc as unknown as { numPages: number; getPage: (n: number) => Promise<PdfJsPage> };
                    setNumPages(doc.numPages);
                    await renderPage(1);
          })();
          return () => {
                    cancelled = true;
          };
  }, [storagePath, renderPage]);

  useEffect(() => {
          if (pdfDocRef.current) void renderPage(pageNum);
  }, [pageNum, renderPage, fullScreen]);

  const redraw = useCallback(() => {
          const overlay = drawRef.current;
          const ctx = overlay?.getContext("2d");
          if (!overlay || !ctx) return;
          ctx.clearRect(0, 0, overlay.width, overlay.height);
          for (const s of shapes) {
                    if (s.page === pageNum) paintShape(ctx, s);
          }
  }, [shapes, pageNum]);
      useEffect(() => {
              redraw();
      }, [redraw]);

  function pos(e: MouseEvent) {
          const overlay = drawRef.current;
          if (!overlay) return { x: 0, y: 0 };
          const rect = overlay.getBoundingClientRect();
          return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
      function handleDown(e: MouseEvent) {
              draggingRef.current = pos(e);
      }
      function handleMove(e: MouseEvent) {
              const start = draggingRef.current;
              const overlay = drawRef.current;
              const ctx = overlay?.getContext("2d");
              if (!start || !ctx) return;
              const cur = pos(e);
              redraw();
              paintShape(ctx, rectFrom(tool, pageNum, start, cur));
      }
      function handleUp(e: MouseEvent) {
              const start = draggingRef.current;
              draggingRef.current = null;
              if (!start) return;
              const cur = pos(e);
              const shape = rectFrom(tool, pageNum, start, cur);
              if (shape.w > 4 && shape.h > 4) setShapes((prev) => [...prev, shape]);
      }

  function goToPage(next: number) {
          const clamped = Math.min(Math.max(next, 1), numPages);
          if (clamped !== pageNum) setPageNum(clamped);
  }

  async function handleSave() {
          if (!pdfBytes) return;
          setSaving(true);
          setError(null);
          try {
                    const doc = await PDFDocument.load(pdfBytes);
                    for (const s of shapes) {
                                const size = pageSizes[s.page];
                                if (!size) continue;
                                const page = doc.getPage(s.page - 1);
                                const scaleX = page.getWidth() / size.width;
                                const scaleY = page.getHeight() / size.height;
                                const px = s.x * scaleX;
                                const pw = s.w * scaleX;
                                const ph = s.h * scaleY;
                                const py = page.getHeight() - s.y * scaleY - ph;
                                if (s.tool === "circle") {
                                              page.drawEllipse({
                                                              x: px + pw / 2,
                                                              y: py + ph / 2,
                                                              xScale: pw / 2,
                                                              yScale: ph / 2,
                                                              borderColor: rgb(0.15, 0.39, 0.92),
                                                              borderWidth: 2,
                                              });
                                } else {
                                              page.drawRectangle({
                                                              x: px,
                                                              y: py,
                                                              width: pw,
                                                              height: ph,
                                                              color: rgb(0.98, 0.8, 0.08),
                                                              opacity: 0.4,
                                              });
                                }
                    }
                    const outBytes = await doc.save();
                    const supabase = createClient();
                    const path = `${jobId}/${noaLibraryId}.pdf`;
                    const blob = new Blob([outBytes as BlobPart], { type: "application/pdf" });
                    const up = await supabase.storage
                      .from("job-noa-annotations")
                      .upload(path, blob, { upsert: true, contentType: "application/pdf" });
                    if (up.error) throw new Error(up.error.message);
                    const db = await supabase.from("job_noa_annotations").upsert(
                        {
                                      org_id: orgId,
                                      job_id: jobId,
                                      noa_library_id: noaLibraryId,
                                      storage_path: path,
                                      updated_at: new Date().toISOString(),
                        },
                        { onConflict: "job_id,noa_library_id" },
                              );
                    if (db.error) throw new Error(db.error.message);
                    onSaved();
                    onClose();
          } catch (e) {
                    setError(e instanceof Error ? e.message : "Couldn't save the annotated NOA.");
          } finally {
                    setSaving(false);
          }
  }

  const coverageLine =
          openings.length > 0 ? `Covers: ${openings.map((o) => `${o.location} (${o.size})`).join(", ")}` : "";

  return h(
          "div",
      { className: `fixed inset-0 z-50 flex items-center justify-center bg-black/60 ${fullScreen ? "p-0" : "p-4"}` },
          h(
                    "div",
              {
                          className: fullScreen
                            ? "flex h-full w-full flex-col overflow-hidden bg-background"
                                        : "flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-background",
              },
                    h(
                                "div",
                        { className: "flex items-center justify-between border-b p-3" },
                                h(
                                              "div",
                                    { className: "min-w-0" },
                                              h("p", { className: "truncate text-sm font-semibold" }, title),
                                              coverageLine ? h("p", { className: "truncate text-xs text-muted-foreground" }, coverageLine) : null,
                                            ),
                                h(
                                              "div",
                                    { className: "flex shrink-0 items-center gap-1" },
                                              h(
                                                              "button",
                                                  {
                                                                    type: "button",
                                                                    onClick: () => setFullScreen((v) => !v),
                                                                    className: "rounded-full p-1 hover:bg-muted",
                                                                    title: fullScreen ? "Exit full page" : "Open full page",
                                                  },
                                                              fullScreen ? h(Minimize2, { className: "h-4 w-4" }) : h(Maximize2, { className: "h-4 w-4" }),
                                                            ),
                                              h(
                                                              "button",
                                                  { type: "button", onClick: onClose, className: "rounded-full p-1 hover:bg-muted" },
                                                              h(X, { className: "h-4 w-4" }),
                                                            ),
                                            ),
                              ),
                    h(
                                "div",
                        { className: "flex flex-wrap items-center gap-2 border-b p-2" },
                                h(
                                              Button,
                                    {
                                                    type: "button",
                                                    size: "sm",
                                                    variant: tool === "circle" ? "default" : "outline",
                                                    onClick: () => setTool("circle"),
                                    },
                                              h(CircleIcon, { className: "h-3.5 w-3.5" }),
                                              "Circle (blue)",
                                            ),
                                h(
                                              Button,
                                    {
                                                    type: "button",
                                                    size: "sm",
                                                    variant: tool === "highlight" ? "default" : "outline",
                                                    onClick: () => setTool("highlight"),
                                    },
                                              h(Highlighter, { className: "h-3.5 w-3.5" }),
                                              "Highlight (yellow)",
                                            ),
                                h(
                                              Button,
                                    {
                                                    type: "button",
                                                    size: "sm",
                                                    variant: "outline",
                                                    onClick: () => setShapes((prev) => prev.filter((s) => s.page !== pageNum)),
                                                    disabled: !shapes.some((s) => s.page === pageNum),
                                    },
                                              "Clear marks on this page",
                                            ),
                                numPages > 1
                                  ? h(
                                                    "div",
                                      { className: "flex items-center gap-1 rounded-full border px-1" },
                                                    h(
                                                                        "button",
                                                        {
                                                                              type: "button",
                                                                              onClick: () => goToPage(pageNum - 1),
                                                                              disabled: pageNum <= 1,
                                                                              className: "rounded-full p-1 hover:bg-muted disabled:opacity-30",
                                                        },
                                                                        h(ChevronLeft, { className: "h-4 w-4" }),
                                                                      ),
                                                    h("span", { className: "px-1 text-xs tabular-nums" }, `Page ${pageNum} / ${numPages}`),
                                                    h(
                                                                        "button",
                                                        {
                                                                              type: "button",
                                                                              onClick: () => goToPage(pageNum + 1),
                                                                              disabled: pageNum >= numPages,
                                                                              className: "rounded-full p-1 hover:bg-muted disabled:opacity-30",
                                                        },
                                                                        h(ChevronRight, { className: "h-4 w-4" }),
                                                                      ),
                                                  )
                                  : null,
                                h("span", { className: "ml-auto" }),
                                h(
                                              Button,
                                    { type: "button", size: "sm", onClick: handleSave, disabled: saving || !pdfBytes },
                                              saving ? "Saving…" : "Save to job",
                                            ),
                              ),
                    h(
                                "div",
                        { className: "relative flex flex-1 overflow-hidden" }, openings.length > 0 ? h("div", { className: "w-64 shrink-0 overflow-y-auto border-r bg-muted/20 p-4" }, h("p", { className: "mb-3 text-sm font-semibold text-muted-foreground" }, "Windows for this NOA"), h("ul", { className: "space-y-2" }, openings.map((o) => h("li", { key: o.id, className: "text-base font-medium leading-snug" }, `${o.location} (${o.size})`)))) : null,
                                h("div", { ref: containerRef, className: "relative flex flex-1 flex-col items-center justify-center overflow-auto bg-muted/40 p-4" }, error ? h("p", { className: "mb-2 text-sm text-destructive" }, error) : null,
                                h(
                                              "div",
                                    { className: "relative mx-auto w-fit" },
                                              h("canvas", { ref: canvasRef, className: "block rounded border bg-white shadow" }),
                                              h("canvas", {
                                                              ref: drawRef,
                                                              className: "absolute left-0 top-0 cursor-crosshair",
                                                              onMouseDown: handleDown,
                                                              onMouseMove: handleMove,
                                                              onMouseUp: handleUp,
                                              }),
                                            ),),
                              ),
                  ),
        );
}

interface PdfJsViewport {
      width: number;
      height: number;
}

interface PdfJsPage {
      getViewport: (opts: { scale: number }) => PdfJsViewport;
      render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: PdfJsViewport }) => { promise: Promise<void> };
}

function rectFrom(tool: Tool, page: number, start: { x: number; y: number }, cur: { x: number; y: number }): Shape {
      const x = Math.min(start.x, cur.x);
      const y = Math.min(start.y, cur.y);
      const w = Math.abs(cur.x - start.x);
      const h = Math.abs(cur.y - start.y);
      return { tool, page, x, y, w, h };
}

function paintShape(ctx: CanvasRenderingContext2D, s: Shape) {
      if (s.tool === "circle") {
              ctx.strokeStyle = "#2563eb";
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.ellipse(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, s.h / 2, 0, 0, Math.PI * 2);
              ctx.stroke();
      } else {
              ctx.fillStyle = "rgba(250, 204, 21, 0.45)";
              ctx.fillRect(s.x, s.y, s.w, s.h);
      }
}
