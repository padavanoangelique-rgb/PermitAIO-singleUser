"use client";
import { useEffect, useRef } from "react";
import type { PointerEvent, WheelEvent } from "react";
import { dist, formatFeet, hitDimension, rectWalls, snapToGrid, wallAtPoint } from "@/lib/measure/geometry";
import {
  hitLabel,
  hitOpeningTag,
  readTheme,
  renderPlan,
  worldOf,
  type Preview,
} from "@/lib/measure/render";
import { detectRooms } from "@/lib/measure/rooms";
import { strokeToWalls } from "@/lib/measure/stroke";
import { usePlanStore } from "@/lib/measure/store";
import { PX_PER_FOOT, type Pt } from "@/lib/measure/types";

type PointerRec = { x: number; y: number; type: string };

export function PlanCanvas() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointers = useRef(new Map<number, PointerRec>());
  const stroke = useRef<Pt[]>([]);
  const preview = useRef<Preview | null>(null);
  const dirty = useRef(true);
  const pinch = useRef<{
    dist: number;
    zoom: number;
    panX: number;
    panY: number;
    mid: Pt;
    world: Pt;
  } | null>(null);
  const pan = useRef<{ x: number; y: number; panX: number; panY: number } | null>(
    null,
  );
  const drag = useRef<
    | { kind: "furniture"; id: string; dx: number; dy: number }
    | { kind: "label"; id: string; dx: number; dy: number }
    | { kind: "vertex"; wallId: string; end: "a" | "b" }
    | null
  >(null);
  const space = useRef(false);
  const downAt = useRef<Pt | null>(null);
  const themeRef = useRef<ReturnType<typeof readTheme> | null>(null);
  const fitted = useRef(false);

  const hydrated = usePlanStore((s) => s.hydrated);
  const currentId = usePlanStore((s) => s.currentId);
  const tool = usePlanStore((s) => s.tool);
  const camera = usePlanStore((s) => s.camera);
  const showGrid = usePlanStore((s) => s.showGrid);
  const showDims = usePlanStore((s) => s.showDims);
  const selection = usePlanStore((s) => s.selection);
  const plansTick = usePlanStore((s) => s.plans);
  const pendingRect = usePlanStore((s) => s.pendingRect);
  const pendingStamp = usePlanStore((s) => s.pendingStamp);

  useEffect(() => {
    const el = wrapRef.current;
    if (el) themeRef.current = readTheme(el);
  }, []);

  useEffect(() => {
    dirty.current = true;
  }, [currentId, tool, camera, showGrid, showDims, selection, plansTick, hydrated, pendingRect, pendingStamp]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      dirty.current = true;
      if (!fitted.current && usePlanStore.getState().hydrated) {
        fitted.current = true;
        const plan = usePlanStore.getState().current();
        if (plan.walls.length > 0) {
          usePlanStore.getState().fitView(rect.width, rect.height);
        }
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [hydrated, currentId]);

  useEffect(() => {
    fitted.current = false;
  }, [currentId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!dirty.current) return;
      dirty.current = false;
      const rect = wrap.getBoundingClientRect();
      const dpr = canvas.width / Math.max(1, rect.width);
      const state = usePlanStore.getState();
      const plan = state.current();
      const theme = themeRef.current ?? readTheme(wrap);
      renderPlan(ctx, {
        width: rect.width,
        height: rect.height,
        dpr,
        camera: state.camera,
        plan,
        rooms: detectRooms(plan.walls, plan.labels),
        preview: preview.current,
        selection: state.selection,
        showGrid: state.showGrid,
        showDims: state.showDims,
        theme,
      });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const stop = (e: Event) => e.preventDefault();
    wrap.addEventListener("wheel", stop, { passive: false });
    wrap.addEventListener("touchmove", stop, { passive: false });
    wrap.addEventListener("gesturestart", stop, { passive: false } as AddEventListenerOptions);
    return () => {
      wrap.removeEventListener("wheel", stop);
      wrap.removeEventListener("touchmove", stop);
      wrap.removeEventListener("gesturestart", stop);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA";
      if (e.key === "Escape") {
        usePlanStore.getState().setPendingRect(null);
        usePlanStore.getState().setSelection(null);
        preview.current = null;
        dirty.current = true;
      }
      if (e.key === " " && !inField) space.current = e.type === "keydown";
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) usePlanStore.getState().redo();
        else usePlanStore.getState().undo();
      }
      if ((e.key === "Backspace" || e.key === "Delete") && !inField) {
        e.preventDefault();
        usePlanStore.getState().deleteSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  const localPoint = (e: { clientX: number; clientY: number }): Pt => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const worldFromEvent = (e: { clientX: number; clientY: number }): Pt => {
    return worldOf(localPoint(e), usePlanStore.getState().camera);
  };

  const beginPinch = () => {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return;
    const a = pts[0]!;
    const b = pts[1]!;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const cam = usePlanStore.getState().camera;
    pinch.current = {
      dist: dist(a, b) || 1,
      zoom: cam.zoom,
      panX: cam.panX,
      panY: cam.panY,
      mid,
      world: worldOf(mid, cam),
    };
    stroke.current = [];
    preview.current = null;
    pan.current = null;
    drag.current = null;
    dirty.current = true;
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    const local = localPoint(e);
    pointers.current.set(e.pointerId, { x: local.x, y: local.y, type: e.pointerType });
    downAt.current = worldFromEvent(e);

    if (e.pointerType === "pen") {
      usePlanStore.getState().setPencilMode(true);
    }

    if (pointers.current.size >= 2) {
      beginPinch();
      return;
    }

    const state = usePlanStore.getState();
    const isFinger = e.pointerType === "touch";
    const panThis =
      space.current ||
      e.button === 1 ||
      (state.pencilMode && isFinger);

    if (panThis) {
      pan.current = {
        x: local.x,
        y: local.y,
        panX: state.camera.panX,
        panY: state.camera.panY,
      };
      return;
    }

    const world = worldFromEvent(e);
    const dimRadius = clamp(36 / (PX_PER_FOOT * state.camera.zoom), 1.2, 4.2);

    if (state.pendingRect) {
      preview.current = {
        raw: [],
        walls: rectWalls(world, state.pendingRect.w, state.pendingRect.h),
        morph: 1,
        lengthLabel: `${formatFeet(state.pendingRect.w)} × ${formatFeet(state.pendingRect.h)}`,
      };
      dirty.current = true;
      return;
    }

    if (state.tool === "select" || state.tool === "draw" || state.tool === "size") {
      const dimWall = hitDimension(world, state.current().walls, dimRadius);
      if (dimWall) {
        state.setTool("size");
        state.setSelection({ kind: "wall", id: dimWall.id });
        dirty.current = true;
        return;
      }
    }

    if (state.tool === "select" || state.tool === "size") {
      const plan = state.current();
      const tag = hitOpeningTag(world, plan.walls, plan.openings, 1.1);
      if (tag) {
        state.setSelection({ kind: "opening", id: tag.id });
        if (state.tool === "select") state.setSheet("opening");
        return;
      }
      const label = hitLabel(world, plan.labels, 1.8);
      if (label) {
        state.setSelection({ kind: "label", id: label.id });
        drag.current = { kind: "label", id: label.id, dx: world.x - label.x, dy: world.y - label.y };
        state.pushHistory();
        return;
      }
      if (state.tool === "select") {
        const vertexHit = hitVertex(world, plan.walls, 0.55);
        if (vertexHit) {
          state.setSelection({ kind: "vertex", wallId: vertexHit.wallId, end: vertexHit.end });
          drag.current = vertexHit;
          state.pushHistory();
          return;
        }
      }
      const wall = wallAtPoint(world, plan.walls, 0.85);
      if (wall) {
        const opening = plan.openings.find((o) => o.wallId === wall.wall.id && Math.abs(o.t - wall.proj.t) < 0.12);
        if (opening) {
          state.setSelection({ kind: "opening", id: opening.id });
          if (state.tool === "select") state.setSheet("opening");
          return;
        }
        state.setSelection({ kind: "wall", id: wall.wall.id });
        return;
      }
      state.setSelection(null);
      pan.current = {
        x: local.x,
        y: local.y,
        panX: state.camera.panX,
        panY: state.camera.panY,
      };
      return;
    }

    if (state.tool === "draw" || state.tool === "erase") {
      stroke.current = [world];
      preview.current = {
        raw: [world],
        walls: [],
        morph: 0,
      };
      dirty.current = true;
    }
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const rec = pointers.current.get(e.pointerId);
    if (!rec && pointers.current.size === 0) return;
    const local = localPoint(e);
    if (rec) {
      rec.x = local.x;
      rec.y = local.y;
    } else {
      pointers.current.set(e.pointerId, { x: local.x, y: local.y, type: e.pointerType });
    }

    if (pinch.current && pointers.current.size >= 2) {
      const pts = [...pointers.current.values()];
      const a = pts[0]!;
      const b = pts[1]!;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const d = dist(a, b) || 1;
      const start = pinch.current;
      const zoom = clamp(start.zoom * (d / start.dist), 0.22, 5.5);
      usePlanStore.getState().setCamera({
        zoom,
        panX: mid.x - start.world.x * PX_PER_FOOT * zoom,
        panY: mid.y - start.world.y * PX_PER_FOOT * zoom,
      });
      dirty.current = true;
      return;
    }

    if (pan.current) {
      const dx = local.x - pan.current.x;
      const dy = local.y - pan.current.y;
      usePlanStore.getState().setCamera({
        ...usePlanStore.getState().camera,
        panX: pan.current.panX + dx,
        panY: pan.current.panY + dy,
      });
      dirty.current = true;
      return;
    }

    const pending = usePlanStore.getState().pendingRect;
    if (pending) {
      const world = worldFromEvent(e);
      preview.current = {
        raw: [],
        walls: rectWalls(world, pending.w, pending.h),
        morph: 1,
        lengthLabel: `${formatFeet(pending.w)} × ${formatFeet(pending.h)}`,
      };
      dirty.current = true;
      return;
    }

    if (drag.current) {
      const world = worldFromEvent(e);
      if (drag.current.kind === "furniture") {
        usePlanStore.getState().moveFurniture(drag.current.id, {
          x: world.x - drag.current.dx,
          y: world.y - drag.current.dy,
        });
      } else if (drag.current.kind === "label") {
        usePlanStore.getState().moveLabel(drag.current.id, {
          x: world.x - drag.current.dx,
          y: world.y - drag.current.dy,
        });
      } else {
        usePlanStore
          .getState()
          .moveVertex(drag.current.wallId, drag.current.end, snapToGrid(world));
      }
      dirty.current = true;
      return;
    }

    if (stroke.current.length) {
      const events: Array<{ clientX: number; clientY: number }> =
        typeof e.nativeEvent.getCoalescedEvents === "function"
          ? e.nativeEvent.getCoalescedEvents()
          : [e];
      for (const ev of events) {
        stroke.current.push(worldOf(localPoint(ev), usePlanStore.getState().camera));
      }
      const state = usePlanStore.getState();
      if (state.tool === "draw") {
        const zoom = state.camera.zoom;
        const converted = strokeToWalls(stroke.current, state.current().walls, {
          epsilon: 14 / (PX_PER_FOOT * zoom),
          snapRadius: clamp(16 / (PX_PER_FOOT * zoom), 0.25, 1.1),
          ortho: state.ortho,
        });
        const last = converted.walls[converted.walls.length - 1];
        preview.current = {
          raw: stroke.current.slice(),
          walls: converted.walls,
          morph: 0,
          lengthLabel: last ? formatFeet(dist(last.a, last.b)) : undefined,
          snapGuides: last
            ? {
                x: Math.abs(last.a.x - last.b.x) < 0.05 ? last.a.x : undefined,
                y: Math.abs(last.a.y - last.b.y) < 0.05 ? last.a.y : undefined,
              }
            : undefined,
        };
      } else {
        preview.current = { raw: stroke.current.slice(), walls: [], morph: 0 };
      }
      dirty.current = true;
    }
  };

  const finishStroke = () => {
    const state = usePlanStore.getState();
    const raw = stroke.current;
    stroke.current = [];
    const travel = raw.reduce((n, p, i) => (i === 0 ? 0 : n + dist(raw[i - 1]!, p)), 0);
    if (raw.length < 2 || travel < 0.4) {
      preview.current = null;
      dirty.current = true;
      const start = raw[0];
      if (start && (state.tool === "draw" || state.tool === "size")) {
        const dim = hitDimension(start, state.current().walls, 3.2);
        if (dim) {
          state.setTool("size");
          state.setSelection({ kind: "wall", id: dim.id });
          return;
        }
        const hit = wallAtPoint(start, state.current().walls, 0.85);
        if (hit) {
          state.setTool("size");
          state.setSelection({ kind: "wall", id: hit.wall.id });
        }
      }
      return;
    }
    const zoom = state.camera.zoom;
    const epsilon = 14 / (PX_PER_FOOT * zoom);
    const snapRadius = clamp(16 / (PX_PER_FOOT * zoom), 0.25, 1.1);
    if (state.tool === "erase") {
      state.commitErase(raw);
      preview.current = null;
      dirty.current = true;
      return;
    }
    const converted = strokeToWalls(raw, state.current().walls, {
      epsilon,
      snapRadius,
      ortho: state.ortho,
    });
    preview.current = {
      raw,
      walls: converted.walls,
      morph: 0,
      lengthLabel: undefined,
    };
    dirty.current = true;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 220);
      if (preview.current) {
        preview.current = { ...preview.current, morph: t };
        dirty.current = true;
      }
      if (t < 1) requestAnimationFrame(tick);
      else {
        state.commitStroke(raw, snapRadius, epsilon);
        preview.current = null;
        dirty.current = true;
      }
    };
    requestAnimationFrame(tick);
  };

  const onPointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;

    const wasPan = !!pan.current;
    const wasDrag = !!drag.current;
    pan.current = null;
    if (drag.current) {
      usePlanStore.getState().persist();
      drag.current = null;
    }

    if (stroke.current.length) {
      finishStroke();
      return;
    }

    const pending = usePlanStore.getState().pendingRect;
    if (pending) {
      const world = worldFromEvent(e);
      usePlanStore.getState().placeRect(snapToGrid(world), pending.w, pending.h);
      preview.current = null;
      dirty.current = true;
      return;
    }

    if (wasPan || wasDrag || pointers.current.size > 0) return;

    const state = usePlanStore.getState();
    const world = worldFromEvent(e);
    const start = downAt.current;
    if (start && dist(start, world) > 0.45) return;

    if (state.tool === "door" || state.tool === "window") {
      state.placeOpening(world, state.tool);
      dirty.current = true;
    } else if (state.tool === "label") {
      if (state.pendingStamp) {
        state.placeLabel(world, state.pendingStamp);
      } else {
        state.setLabelDraft("");
        state.setPendingPoint(world);
        state.setSheet("label");
      }
      dirty.current = true;
    }
  };

  const onWheel = (e: WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const state = usePlanStore.getState();
    const local = localPoint(e);
    const world = worldOf(local, state.camera);
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    const zoom = clamp(state.camera.zoom * factor, 0.22, 5.5);
    state.setCamera({
      zoom,
      panX: local.x - world.x * PX_PER_FOOT * zoom,
      panY: local.y - world.y * PX_PER_FOOT * zoom,
    });
    dirty.current = true;
  };

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 bg-paper touch-none overscroll-none"
    >
      <canvas
        ref={canvasRef}
        className="block size-full touch-none cursor-crosshair"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}

function hitVertex(p: Pt, walls: { id: string; a: Pt; b: Pt }[], radius: number) {
  let best: { kind: "vertex"; wallId: string; end: "a" | "b" } | null = null;
  let bestD = radius;
  for (const w of walls) {
    const da = dist(p, w.a);
    const db = dist(p, w.b);
    if (da < bestD) {
      bestD = da;
      best = { kind: "vertex", wallId: w.id, end: "a" };
    }
    if (db < bestD) {
      bestD = db;
      best = { kind: "vertex", wallId: w.id, end: "b" };
    }
  }
  return best;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
