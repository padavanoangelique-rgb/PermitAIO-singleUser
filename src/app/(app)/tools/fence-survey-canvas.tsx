"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import {
  drawFenceMarkup,
  markupUnit,
  type FenceDrawing,
  type Pt,
} from "@/lib/tools/fence-markup";
import { runSegments, segLen, type FenceGate, type FenceLocation, type FenceRun } from "@/lib/tools/fence-rules";

export type FenceTool = "draw" | "edit" | "gate" | "scale" | "pan";

export type FenceCanvasHandle = {
  fit: () => void;
  zoomBy: (f: number) => void;
  finishRun: () => void;
  undoPoint: () => void;
};

type View = { zoom: number; ox: number; oy: number };

const SNAP_PX = 14;
const HIT_PX = 12;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function distToSeg(p: Pt, a: Pt, b: Pt): { d: number; t: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  const q = { x: a.x + dx * t, y: a.y + dy * t };
  return { d: segLen(p, q), t };
}

function snapAngle(from: Pt, to: Pt): Pt {
  const ang = Math.atan2(to.y - from.y, to.x - from.x);
  const step = Math.PI / 4;
  const snapped = Math.round(ang / step) * step;
  const len = segLen(from, to);
  return { x: from.x + Math.cos(snapped) * len, y: from.y + Math.sin(snapped) * len };
}

export const FenceSurveyCanvas = forwardRef<
  FenceCanvasHandle,
  {
    survey: HTMLCanvasElement;
    drawing: FenceDrawing;
    onChange: (next: FenceDrawing, opts?: { transient?: boolean }) => void;
    tool: FenceTool;
    showX: boolean;
    showDims: boolean;
    defaultHeight: number;
    defaultLocation: FenceLocation;
    defaultGateFt: number;
    selectedRunId: string | null;
    selectedGateId: string | null;
    onSelectRun: (id: string | null) => void;
    onSelectGate: (id: string | null) => void;
    /** Fired when the scale tool has two points; parent asks for the real distance. */
    onScalePicked: (a: Pt, b: Pt) => void;
    activeRunId: string | null;
    onActiveRunChange: (id: string | null) => void;
  }
>(function FenceSurveyCanvas(props, ref) {
  const {
    survey,
    drawing,
    onChange,
    tool,
    showX,
    showDims,
    defaultHeight,
    defaultLocation,
    defaultGateFt,
    selectedRunId,
    selectedGateId,
    onSelectRun,
    onSelectGate,
    onScalePicked,
    activeRunId,
    onActiveRunChange,
  } = props;

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<View>({ zoom: 1, ox: 0, oy: 0 });
  const [size, setSize] = useState({ w: 800, h: 560 });
  const [hover, setHover] = useState<Pt | null>(null);
  const [scaleA, setScaleA] = useState<Pt | null>(null);
  const [shift, setShift] = useState(false);

  const drag = useRef<{
    kind: "pan" | "vertex" | "maybe-click";
    startX: number;
    startY: number;
    view: View;
    runId?: string;
    index?: number;
    moved: boolean;
    pushed?: boolean;
  } | null>(null);

  const drawingRef = useRef(drawing);
  drawingRef.current = drawing;

  // ── Coordinate helpers ───────────────────────────────────────────────────
  const toImage = useCallback(
    (clientX: number, clientY: number): Pt => {
      const rect = canvasRef.current!.getBoundingClientRect();
      return { x: (clientX - rect.left - view.ox) / view.zoom, y: (clientY - rect.top - view.oy) / view.zoom };
    },
    [view],
  );

  const fit = useCallback(() => {
    const pad = 16;
    const zoom = Math.min((size.w - pad * 2) / survey.width, (size.h - pad * 2) / survey.height);
    setView({ zoom, ox: (size.w - survey.width * zoom) / 2, oy: (size.h - survey.height * zoom) / 2 });
  }, [size, survey]);

  const zoomAt = useCallback((factor: number, sx: number, sy: number) => {
    setView((v) => {
      const zoom = Math.max(0.05, Math.min(8, v.zoom * factor));
      const k = zoom / v.zoom;
      return { zoom, ox: sx - (sx - v.ox) * k, oy: sy - (sy - v.oy) * k };
    });
  }, []);

  // ── Resize / fit ─────────────────────────────────────────────────────────
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = Math.max(420, Math.min(window.innerHeight * 0.72, w * 0.8));
      setSize({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    fit();
    // Refit only when a new survey arrives or the box resizes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survey, size.w, size.h]);

  // ── Keyboard ─────────────────────────────────────────────────────────────
  const finishRun = useCallback(() => {
    if (!activeRunId) return;
    const d = drawingRef.current;
    const run = d.runs.find((r) => r.id === activeRunId);
    if (run && run.points.length < 2) {
      onChange({ ...d, runs: d.runs.filter((r) => r.id !== activeRunId) });
      onSelectRun(null);
    }
    onActiveRunChange(null);
  }, [activeRunId, onChange, onActiveRunChange, onSelectRun]);

  const undoPoint = useCallback(() => {
    const d = drawingRef.current;
    const id = activeRunId ?? d.runs[d.runs.length - 1]?.id;
    if (!id) return;
    const run = d.runs.find((r) => r.id === id);
    if (!run) return;
    if (run.closed) {
      onChange({ ...d, runs: d.runs.map((r) => (r.id === id ? { ...r, closed: false } : r)) });
      return;
    }
    const points = run.points.slice(0, -1);
    const lastSeg = Math.max(0, points.length - 1);
    const gates = d.gates.filter((g) => !(g.runId === id && g.segment >= lastSeg));
    if (points.length === 0) {
      onChange({ ...d, runs: d.runs.filter((r) => r.id !== id), gates });
      onActiveRunChange(null);
    } else {
      onChange({ ...d, runs: d.runs.map((r) => (r.id === id ? { ...r, points } : r)), gates });
    }
  }, [activeRunId, onChange, onActiveRunChange]);

  useImperativeHandle(
    ref,
    () => ({
      fit,
      zoomBy: (f: number) => zoomAt(f, size.w / 2, size.h / 2),
      finishRun,
      undoPoint,
    }),
    [fit, zoomAt, size, finishRun, undoPoint],
  );

  useEffect(() => {
    function down(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Shift") setShift(true);
      if (e.key === "Enter" || e.key === "Escape") {
        finishRun();
        setScaleA(null);
      }
      if ((e.key === "Backspace" || e.key === "Delete") && activeRunId) {
        e.preventDefault();
        undoPoint();
      }
      if ((e.key === "z" || e.key === "Z") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        undoPoint();
      }
    }
    function up(e: KeyboardEvent) {
      if (e.key === "Shift") setShift(false);
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [finishRun, undoPoint, activeRunId]);

  useEffect(() => {
    if (tool !== "draw") finishRun();
    if (tool !== "scale") setScaleA(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  // ── Paint ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(size.w * dpr);
    c.height = Math.round(size.h * dpr);
    c.style.width = `${size.w}px`;
    c.style.height = `${size.h}px`;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(0, 0, size.w, size.h);
    ctx.setTransform(dpr * view.zoom, 0, 0, dpr * view.zoom, dpr * view.ox, dpr * view.oy);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(survey, 0, 0);
    // Soften the survey a touch so the fence line reads first.
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(0, 0, survey.width, survey.height);

    drawFenceMarkup(ctx, drawing, {
      zoom: view.zoom,
      imageWidth: survey.width,
      imageHeight: survey.height,
      showX,
      showDims,
      selectedRunId,
      selectedGateId,
      showHandles: tool !== "pan",
    });

    const u = markupUnit(survey.width, survey.height);
    const lw = Math.max(3 * u, 2.5 / view.zoom);

    // Live preview of the next segment.
    const active = drawing.runs.find((r) => r.id === activeRunId);
    if (tool === "draw" && active && hover && active.points.length) {
      const last = active.points[active.points.length - 1];
      const target = shift ? snapAngle(last, hover) : hover;
      ctx.strokeStyle = "rgba(225, 29, 72, 0.6)";
      ctx.lineWidth = lw;
      ctx.setLineDash([10 / view.zoom, 6 / view.zoom]);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
      ctx.setLineDash([]);
      const first = active.points[0];
      if (active.points.length >= 3 && segLen(first, hover) * view.zoom < SNAP_PX) {
        ctx.beginPath();
        ctx.arc(first.x, first.y, 12 / view.zoom, 0, Math.PI * 2);
        ctx.strokeStyle = "#16a34a";
        ctx.lineWidth = 3 / view.zoom;
        ctx.stroke();
      }
    }
    if (tool === "scale" && scaleA) {
      ctx.strokeStyle = "#059669";
      ctx.lineWidth = 2.5 / view.zoom;
      ctx.beginPath();
      ctx.arc(scaleA.x, scaleA.y, 6 / view.zoom, 0, Math.PI * 2);
      ctx.stroke();
      if (hover) {
        ctx.setLineDash([8 / view.zoom, 5 / view.zoom]);
        ctx.beginPath();
        ctx.moveTo(scaleA.x, scaleA.y);
        ctx.lineTo(hover.x, hover.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }, [survey, drawing, view, size, showX, showDims, selectedRunId, selectedGateId, tool, hover, activeRunId, scaleA, shift]);

  // ── Hit testing ──────────────────────────────────────────────────────────
  const hitVertex = useCallback(
    (p: Pt): { run: FenceRun; index: number } | null => {
      for (const run of drawingRef.current.runs) {
        for (let i = 0; i < run.points.length; i++) {
          if (segLen(run.points[i], p) * view.zoom < HIT_PX) return { run, index: i };
        }
      }
      return null;
    },
    [view.zoom],
  );

  const hitSegment = useCallback(
    (p: Pt): { run: FenceRun; segment: number; t: number } | null => {
      let best: { run: FenceRun; segment: number; t: number; d: number } | null = null;
      for (const run of drawingRef.current.runs) {
        runSegments(run).forEach(([a, b], i) => {
          const { d, t } = distToSeg(p, a, b);
          if (d * view.zoom < HIT_PX * 1.5 && (!best || d < best.d)) best = { run, segment: i, t, d };
        });
      }
      return best;
    },
    [view.zoom],
  );

  const hitGate = useCallback(
    (p: Pt): FenceGate | null => {
      const d = drawingRef.current;
      for (const g of d.gates) {
        const run = d.runs.find((r) => r.id === g.runId);
        const seg = run ? runSegments(run)[g.segment] : null;
        if (!seg) continue;
        const c = { x: seg[0].x + (seg[1].x - seg[0].x) * g.t, y: seg[0].y + (seg[1].y - seg[0].y) * g.t };
        if (segLen(c, p) * view.zoom < HIT_PX * 2) return g;
      }
      return null;
    },
    [view.zoom],
  );

  const snapPoint = useCallback(
    (p: Pt, exceptRun?: string): Pt => {
      for (const run of drawingRef.current.runs) {
        if (run.id === exceptRun) continue;
        for (const q of run.points) if (segLen(q, p) * view.zoom < SNAP_PX) return q;
      }
      return p;
    },
    [view.zoom],
  );

  // ── Click actions ────────────────────────────────────────────────────────
  const handleClick = useCallback(
    (p: Pt) => {
      const d = drawingRef.current;
      if (tool === "draw") {
        const active = d.runs.find((r) => r.id === activeRunId);
        if (!active) {
          const id = uid();
          const run: FenceRun = {
            id,
            points: [snapPoint(p)],
            closed: false,
            height_ft: defaultHeight,
            location: defaultLocation,
          };
          onChange({ ...d, runs: [...d.runs, run] });
          onActiveRunChange(id);
          onSelectRun(id);
          return;
        }
        const first = active.points[0];
        if (active.points.length >= 3 && segLen(first, p) * view.zoom < SNAP_PX) {
          onChange({ ...d, runs: d.runs.map((r) => (r.id === active.id ? { ...r, closed: true } : r)) });
          onActiveRunChange(null);
          return;
        }
        const last = active.points[active.points.length - 1];
        let next = shift ? snapAngle(last, p) : snapPoint(p, active.id);
        if (segLen(next, last) * view.zoom < 3) return;
        next = { x: Math.round(next.x * 10) / 10, y: Math.round(next.y * 10) / 10 };
        onChange({ ...d, runs: d.runs.map((r) => (r.id === active.id ? { ...r, points: [...r.points, next] } : r)) });
        return;
      }
      if (tool === "gate") {
        const g = hitGate(p);
        if (g) {
          onSelectGate(g.id);
          return;
        }
        const s = hitSegment(p);
        if (!s) {
          onSelectGate(null);
          return;
        }
        const gate: FenceGate = {
          id: uid(),
          runId: s.run.id,
          segment: s.segment,
          t: Math.round(s.t * 1000) / 1000,
          width_ft: defaultGateFt,
          swing: "in",
          electrical: false,
        };
        onChange({ ...d, gates: [...d.gates, gate] });
        onSelectGate(gate.id);
        return;
      }
      if (tool === "scale") {
        if (!scaleA) {
          setScaleA(p);
        } else {
          onScalePicked(scaleA, shift ? snapAngle(scaleA, p) : p);
          setScaleA(null);
        }
        return;
      }
      if (tool === "edit") {
        const g = hitGate(p);
        if (g) {
          onSelectGate(g.id);
          onSelectRun(g.runId);
          return;
        }
        const s = hitSegment(p);
        onSelectGate(null);
        onSelectRun(s ? s.run.id : null);
      }
    },
    [
      tool,
      activeRunId,
      defaultHeight,
      defaultLocation,
      defaultGateFt,
      onChange,
      onActiveRunChange,
      onSelectRun,
      onSelectGate,
      onScalePicked,
      hitGate,
      hitSegment,
      snapPoint,
      scaleA,
      shift,
      view.zoom,
    ],
  );

  const handleDoubleClick = useCallback(
    (p: Pt) => {
      if (tool === "draw") {
        finishRun();
        return;
      }
      if (tool === "edit") {
        // Double-click a segment to add a bend point.
        const s = hitSegment(p);
        if (!s) return;
        const d = drawingRef.current;
        const run = s.run;
        const pts = [...run.points];
        pts.splice(s.segment + 1, 0, { x: p.x, y: p.y });
        const gates = d.gates.map((g) =>
          g.runId === run.id && g.segment > s.segment ? { ...g, segment: g.segment + 1 } : g,
        );
        onChange({ ...d, runs: d.runs.map((r) => (r.id === run.id ? { ...r, points: pts } : r)), gates });
      }
    },
    [tool, finishRun, hitSegment, onChange],
  );

  // ── Pointer plumbing ─────────────────────────────────────────────────────
  const lastTap = useRef(0);
  const lastTapPos = useRef<{ x: number; y: number } | null>(null);

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.button === 2) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const p = toImage(e.clientX, e.clientY);
    if (tool === "pan" || e.button === 1 || e.altKey) {
      drag.current = { kind: "pan", startX: e.clientX, startY: e.clientY, view, moved: false };
      return;
    }
    if (tool === "edit") {
      const v = hitVertex(p);
      if (v) {
        drag.current = {
          kind: "vertex",
          startX: e.clientX,
          startY: e.clientY,
          view,
          runId: v.run.id,
          index: v.index,
          moved: false,
        };
        onSelectRun(v.run.id);
        return;
      }
    }
    drag.current = { kind: "maybe-click", startX: e.clientX, startY: e.clientY, view, moved: false };
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const p = toImage(e.clientX, e.clientY);
    setHover(p);
    const g = drag.current;
    if (!g) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (!g.moved && Math.hypot(dx, dy) > 6) g.moved = true;
    if (!g.moved) return;
    if (g.kind === "maybe-click") g.kind = "pan"; // drag on empty canvas pans (touch friendly)
    if (g.kind === "pan") {
      setView({ ...g.view, ox: g.view.ox + dx, oy: g.view.oy + dy });
    } else if (g.kind === "vertex" && g.runId != null && g.index != null) {
      const d = drawingRef.current;
      const snapped = snapPoint(p, g.runId);
      const next = {
        ...d,
        runs: d.runs.map((r) =>
          r.id === g.runId ? { ...r, points: r.points.map((q, i) => (i === g.index ? snapped : q)) } : r,
        ),
      };
      drawingRef.current = next;
      // First move of a drag creates one undo step; the rest are transient.
      onChange(next, { transient: !!g.pushed });
      g.pushed = true;
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const g = drag.current;
    drag.current = null;
    if (!g || g.moved || g.kind === "pan") return;
    if (g.kind === "vertex") return;
    const p = toImage(e.clientX, e.clientY);
    const now = Date.now();
    const prev = lastTapPos.current;
    if (now - lastTap.current < 320 && prev && Math.hypot(prev.x - e.clientX, prev.y - e.clientY) < 10) {
      lastTap.current = 0;
      lastTapPos.current = null;
      handleDoubleClick(p);
      return;
    }
    lastTap.current = now;
    lastTapPos.current = { x: e.clientX, y: e.clientY };
    handleClick(p);
  }

  function onWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - rect.left, e.clientY - rect.top);
  }

  // Block page scroll while zooming over the canvas.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const stop = (e: WheelEvent) => e.preventDefault();
    c.addEventListener("wheel", stop, { passive: false });
    return () => c.removeEventListener("wheel", stop);
  }, []);

  const cursor =
    tool === "pan" ? "grab" : tool === "edit" ? "default" : tool === "gate" ? "copy" : "crosshair";

  return (
    <div ref={wrapRef} className="relative w-full overflow-hidden rounded-xl border bg-muted">
      <canvas
        ref={canvasRef}
        className="block touch-none select-none"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHover(null)}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
});
