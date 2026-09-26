import { create } from "zustand";
import { uid } from "@/lib/measure/uid";
import { boundsOf, dist, polylineHitsSegment, remapOpeningT, rectWalls, stretchWallLength, wallAtPoint } from "./geometry";
import { detectRooms, nextRoomName, openingTouchesRoom, roomAtPoint } from "./rooms";
import { applySplits, strokeToWalls } from "./stroke";
import { createEmptyPlan, createSamplePlan } from "./sample";
import { defaultConfig, migrateOpening, nextMark, renumberOpenings } from "./schedule";
import { readHostJob } from "@/lib/measure/integration";
import {
  DOOR_HEIGHT,
  DOOR_WIDTH,
  FURNITURE_DEFAULTS,
  type FurnitureKind,
  PX_PER_FOOT,
  type Camera,
  type Furniture,
  type Opening,
  type Plan,
  type Pt,
  type Selection,
  type Tool,
  MIN_WALL,
  WINDOW_HEIGHT,
  WINDOW_WIDTH,
} from "./types";

const STORAGE_KEY = "permitaio.measure.v1";

type Persisted = {
  plans: Plan[];
  currentId: string;
  pencilMode: boolean;
  ortho: boolean;
  showGrid: boolean;
  showDims: boolean;
  seenWelcome: boolean;
};

function migratePlan(plan: Plan): Plan {
  const openings = renumberOpenings((plan.openings ?? []).map((o, i, all) => migrateOpening(o, i, all)));
  return {
    ...plan,
    name: plan.name || "New measure",
    jobNumber: plan.jobNumber ?? "",
    address: plan.address ?? "",
    openings,
    labels: plan.labels ?? [],
    furniture: plan.furniture ?? [],
    annotations: plan.annotations ?? [],
  };
}

function snapshotPlan(plan: Plan): Plan {
  return structuredClone(plan);
}

function fitCamera(plan: Plan, viewW: number, viewH: number): Camera {
  const b = boundsOf(plan.walls);
  const pad = 3.5;
  if (!b) {
    return { panX: 56, panY: 96, zoom: 1 };
  }
  const w = b.maxX - b.minX + pad * 2;
  const h = b.maxY - b.minY + pad * 2;
  const zoom = Math.min(viewW / (w * PX_PER_FOOT), viewH / (h * PX_PER_FOOT), 1.6);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return {
    zoom,
    panX: viewW / 2 - cx * PX_PER_FOOT * zoom,
    panY: viewH / 2 - cy * PX_PER_FOOT * zoom,
  };
}

export type PlanStore = {
  hydrated: boolean;
  plans: Plan[];
  currentId: string;
  tool: Tool;
  furnitureKind: FurnitureKind;
  pencilMode: boolean;
  ortho: boolean;
  showGrid: boolean;
  showDims: boolean;
  showWelcome: boolean;
  sheet: "none" | "plans" | "furnish" | "settings" | "label" | "schedule" | "opening";
  selection: Selection;
  camera: Camera;
  past: Plan[];
  future: Plan[];
  labelDraft: string;
  pendingPoint: Pt | null;
  pendingRect: { w: number; h: number } | null;
  pendingStamp: string | null;
  hydrate: () => void;
  persist: () => void;
  current: () => Plan;
  setTool: (tool: Tool) => void;
  setFurnitureKind: (kind: FurnitureKind) => void;
  setPencilMode: (v: boolean) => void;
  setOrtho: (v: boolean) => void;
  setShowGrid: (v: boolean) => void;
  setShowDims: (v: boolean) => void;
  dismissWelcome: () => void;
  setSheet: (s: PlanStore["sheet"]) => void;
  setSelection: (s: Selection) => void;
  setCamera: (c: Camera | ((prev: Camera) => Camera)) => void;
  fitView: (w: number, h: number) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  commitStroke: (raw: Pt[], snapRadius: number, epsilon: number) => void;
  commitErase: (raw: Pt[]) => void;
  placeOpening: (p: Pt, type: "door" | "window") => void;
  placeFurniture: (p: Pt) => void;
  moveFurniture: (id: string, p: Pt) => void;
  rotateFurniture: (id: string, rot: number) => void;
  flipOpening: (id: string) => void;
  placeLabel: (p: Pt, text: string) => void;
  moveLabel: (id: string, p: Pt) => void;
  updateLabel: (id: string, text: string) => void;
  setLabelDraft: (t: string) => void;
  setPendingPoint: (p: Pt | null) => void;
  setPendingRect: (r: { w: number; h: number } | null) => void;
  setPendingStamp: (name: string | null) => void;
  setWallLength: (wallId: string, feet: number) => void;
  setOpeningWidth: (id: string, feet: number) => void;
  setOpeningHeight: (id: string, feet: number) => void;
  updateOpening: (id: string, patch: Partial<Opening>) => void;
  setJobMeta: (patch: { name?: string; jobNumber?: string; address?: string }) => void;
  setFurnitureSize: (id: string, w: number, h: number) => void;
  placeRect: (origin: Pt, w: number, h: number) => void;
  moveVertex: (wallId: string, end: "a" | "b", p: Pt) => void;
  deleteSelection: () => void;
  newPlan: () => void;
  loadSample: () => void;
  switchPlan: (id: string) => void;
  renamePlan: (name: string) => void;
  deletePlan: (id: string) => void;
  duplicatePlan: () => void;
  clearPlan: () => void;
  importPlan: (plan: Plan) => void;
  orgJobs: { jobNumber: string; address: string }[];
  setOrgJobs: (jobs: { jobNumber: string; address: string }[]) => void;
};

function loadPersisted(): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Persisted;
  } catch {
    return null;
  }
}

export const usePlanStore = create<PlanStore>((set, get) => ({
  hydrated: false,
  plans: [createEmptyPlan()],
  currentId: "",
  tool: "draw",
  furnitureKind: "bed",
  pencilMode: false,
  ortho: true,
  showGrid: true,
  showDims: true,
  showWelcome: true,
  sheet: "none",
  selection: null,
  camera: { panX: 56, panY: 96, zoom: 1 },
  past: [],
  future: [],
  labelDraft: "",
  pendingPoint: null,
  pendingRect: null,
  pendingStamp: null,
  orgJobs: [],

  hydrate: () => {
    if (get().hydrated) return;
    const saved = loadPersisted();
    const empty = createEmptyPlan();
    const host = readHostJob();
    if (!saved || !saved.plans?.length) {
      const plan = host
        ? { ...empty, jobNumber: host.jobNumber, address: host.address ?? "", name: `Job ${host.jobNumber}` }
        : empty;
      set({
        hydrated: true,
        plans: [plan],
        currentId: plan.id,
        showWelcome: !host,
      });
      return;
    }
    const plans = saved.plans.map(migratePlan);
    const currentId =
      plans.some((p) => p.id === saved.currentId)
        ? saved.currentId
        : plans[0]!.id;
    set({
      hydrated: true,
      plans: host
        ? plans.map((p) =>
            p.id === currentId
              ? {
                  ...p,
                  jobNumber: p.jobNumber || host.jobNumber,
                  address: p.address || host.address || "",
                }
              : p,
          )
        : plans,
      currentId,
      pencilMode: saved.pencilMode ?? false,
      ortho: saved.ortho ?? true,
      showGrid: saved.showGrid ?? true,
      showDims: saved.showDims ?? true,
      showWelcome: !saved.seenWelcome && !host,
    });
  },

  persist: () => {
    const s = get();
    if (typeof window === "undefined" || !s.hydrated) return;
    const payload: Persisted = {
      plans: s.plans,
      currentId: s.currentId,
      pencilMode: s.pencilMode,
      ortho: s.ortho,
      showGrid: s.showGrid,
      showDims: s.showDims,
      seenWelcome: !s.showWelcome,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* quota */
    }
  },

  current: () => {
    const s = get();
    return s.plans.find((p) => p.id === s.currentId) ?? s.plans[0]!;
  },

  setTool: (tool) =>
    set({
      tool,
      selection: tool === "select" || tool === "size" ? get().selection : null,
      pendingRect: null,
      pendingStamp: tool === "label" ? get().pendingStamp : null,
      sheet: tool === "schedule" ? "schedule" : get().sheet === "schedule" ? "none" : get().sheet,
      showDims: tool === "size" ? true : get().showDims,
    }),
  setFurnitureKind: (furnitureKind) => set({ furnitureKind, tool: "furnish", sheet: "none" }),
  setPencilMode: (pencilMode) => set({ pencilMode }),
  setOrtho: (ortho) => set({ ortho }),
  setShowGrid: (showGrid) => {
    set({ showGrid });
    get().persist();
  },
  setShowDims: (showDims) => {
    set({ showDims });
    get().persist();
  },
  dismissWelcome: () => {
    set({ showWelcome: false });
    get().persist();
  },
  setSheet: (sheet) => set({ sheet }),
  setSelection: (selection) => set({ selection }),
  setCamera: (c) =>
    set((s) => ({ camera: typeof c === "function" ? c(s.camera) : c })),
  fitView: (w, h) => set({ camera: fitCamera(get().current(), w, h) }),

  pushHistory: () => {
    const plan = snapshotPlan(get().current());
    set((s) => ({
      past: [...s.past.slice(-49), plan],
      future: [],
    }));
  },

  undo: () => {
    const s = get();
    const prev = s.past[s.past.length - 1];
    if (!prev) return;
    const current = snapshotPlan(s.current());
    set({
      past: s.past.slice(0, -1),
      future: [current, ...s.future].slice(0, 50),
      plans: s.plans.map((p) => (p.id === s.currentId ? { ...prev, id: s.currentId } : p)),
      selection: null,
    });
    get().persist();
  },

  redo: () => {
    const s = get();
    const next = s.future[0];
    if (!next) return;
    const current = snapshotPlan(s.current());
    set({
      future: s.future.slice(1),
      past: [...s.past, current],
      plans: s.plans.map((p) => (p.id === s.currentId ? { ...next, id: s.currentId } : p)),
      selection: null,
    });
    get().persist();
  },

  commitStroke: (raw, snapRadius, epsilon) => {
    if (raw.length < 2) return;
    get().pushHistory();
    const s = get();
    const plan = s.current();
    const converted = strokeToWalls(raw, plan.walls, {
      epsilon,
      snapRadius,
      ortho: s.ortho,
    });
    let walls = plan.walls;
    let openings = plan.openings;
    if (converted.splitExisting.length) {
      const split = applySplits(walls, openings, converted.splitExisting);
      walls = split.walls;
      openings = split.openings;
    }
    const next: Plan = {
      ...plan,
      walls: [...walls, ...converted.walls],
      openings,
      updatedAt: Date.now(),
    };
    set({
      plans: s.plans.map((p) => (p.id === s.currentId ? next : p)),
      showWelcome: false,
    });
    get().persist();
  },

  commitErase: (raw) => {
    if (raw.length < 2) return;
    get().pushHistory();
    const s = get();
    const plan = s.current();
    const keep = plan.walls.filter((w) => !polylineHitsSegment(raw, w.a, w.b));
    const removed = new Set(plan.walls.filter((w) => !keep.includes(w)).map((w) => w.id));
    if (removed.size === 0) {
      set((st) => ({ past: st.past.slice(0, -1) }));
      return;
    }
    const next: Plan = {
      ...plan,
      walls: keep,
      openings: plan.openings.filter((o) => !removed.has(o.wallId)),
      updatedAt: Date.now(),
    };
    set({
      plans: s.plans.map((p) => (p.id === s.currentId ? next : p)),
      selection: null,
    });
    get().persist();
  },

  placeOpening: (p, type) => {
    const s = get();
    const plan = s.current();
    const hit = wallAtPoint(p, plan.walls, 1.2);
    if (!hit) return;
    const width = type === "door" ? DOOR_WIDTH : WINDOW_WIDTH;
    const height = type === "door" ? DOOR_HEIGHT : WINDOW_HEIGHT;
    const len = dist(hit.wall.a, hit.wall.b);
    if (len < width + 0.4) return;
    get().pushHistory();
    const rooms = detectRooms(plan.walls, plan.labels);
    const room = roomAtPoint(p, rooms);
    const opening: Opening = {
      id: uid("o"),
      wallId: hit.wall.id,
      t: hit.proj.t,
      width,
      height,
      type,
      flip: false,
      mark: nextMark(plan.openings),
      config: defaultConfig(type),
      room: room?.name ?? "",
      notes: "",
    };
    const next: Plan = {
      ...plan,
      openings: [...plan.openings, opening],
      updatedAt: Date.now(),
    };
    set({
      plans: get().plans.map((pl) => (pl.id === get().currentId ? next : pl)),
      selection: { kind: "opening", id: opening.id },
      sheet: "opening",
    });
    get().persist();
  },

  placeFurniture: (p) => {
    get().pushHistory();
    const s = get();
    const def = FURNITURE_DEFAULTS[s.furnitureKind];
    const item: Furniture = {
      id: uid("f"),
      kind: s.furnitureKind,
      x: p.x,
      y: p.y,
      w: def.w,
      h: def.h,
      rot: 0,
    };
    const plan = s.current();
    const next: Plan = {
      ...plan,
      furniture: [...plan.furniture, item],
      updatedAt: Date.now(),
    };
    set({
      plans: s.plans.map((pl) => (pl.id === s.currentId ? next : pl)),
      selection: { kind: "furniture", id: item.id },
      tool: "select",
    });
    get().persist();
  },

  moveFurniture: (id, p) => {
    const s = get();
    const plan = s.current();
    const next: Plan = {
      ...plan,
      furniture: plan.furniture.map((f) => (f.id === id ? { ...f, x: p.x, y: p.y } : f)),
      updatedAt: Date.now(),
    };
    set({ plans: s.plans.map((pl) => (pl.id === s.currentId ? next : pl)) });
  },

  rotateFurniture: (id, rot) => {
    const s = get();
    const plan = s.current();
    const next: Plan = {
      ...plan,
      furniture: plan.furniture.map((f) => (f.id === id ? { ...f, rot } : f)),
      updatedAt: Date.now(),
    };
    set({ plans: s.plans.map((pl) => (pl.id === s.currentId ? next : pl)) });
    get().persist();
  },

  flipOpening: (id) => {
    const s = get();
    const plan = s.current();
    const next: Plan = {
      ...plan,
      openings: plan.openings.map((o) => (o.id === id ? { ...o, flip: !o.flip } : o)),
      updatedAt: Date.now(),
    };
    set({ plans: s.plans.map((pl) => (pl.id === s.currentId ? next : pl)) });
    get().persist();
  },

  placeLabel: (p, text) => {
    get().pushHistory();
    const s = get();
    const plan = s.current();
    const rooms = detectRooms(plan.walls, plan.labels);
    const room = roomAtPoint(p, rooms);
    const name = nextRoomName(text, plan.labels);
    const label = {
      id: uid("l"),
      x: room?.centroid.x ?? p.x,
      y: room?.centroid.y ?? p.y,
      text: name,
    };
    const openings = room
      ? plan.openings.map((o) => {
          if (o.room) return o;
          const wall = plan.walls.find((w) => w.id === o.wallId);
          if (!wall || !openingTouchesRoom(o, wall, room)) return o;
          return { ...o, room: name };
        })
      : plan.openings;
    const next: Plan = {
      ...plan,
      labels: [...plan.labels, label],
      openings,
      updatedAt: Date.now(),
    };
    set({
      plans: s.plans.map((pl) => (pl.id === s.currentId ? next : pl)),
      sheet: "none",
      pendingPoint: null,
      selection: { kind: "label", id: label.id },
    });
    get().persist();
  },

  moveLabel: (id, p) => {
    const s = get();
    const plan = s.current();
    const next: Plan = {
      ...plan,
      labels: plan.labels.map((l) => (l.id === id ? { ...l, x: p.x, y: p.y } : l)),
      updatedAt: Date.now(),
    };
    set({ plans: s.plans.map((pl) => (pl.id === s.currentId ? next : pl)) });
  },

  updateLabel: (id, text) => {
    const s = get();
    const plan = s.current();
    const next: Plan = {
      ...plan,
      labels: plan.labels.map((l) => (l.id === id ? { ...l, text } : l)),
      updatedAt: Date.now(),
    };
    set({ plans: s.plans.map((pl) => (pl.id === s.currentId ? next : pl)) });
    get().persist();
  },

  setLabelDraft: (labelDraft) => set({ labelDraft }),
  setPendingPoint: (pendingPoint) => set({ pendingPoint }),
  setPendingRect: (pendingRect) => set({ pendingRect }),
  setPendingStamp: (pendingStamp) => set({ pendingStamp, tool: "label", sheet: "none" }),

  setWallLength: (wallId, feet) => {
    const s = get();
    const plan = s.current();
    const nextWalls = stretchWallLength(plan.walls, wallId, feet);
    if (!nextWalls || nextWalls === plan.walls) return;
    get().pushHistory();
    const openings = plan.openings.map((o) => {
      const oldW = plan.walls.find((w) => w.id === o.wallId);
      const newW = nextWalls.find((w) => w.id === o.wallId);
      if (!oldW || !newW) return o;
      const t = remapOpeningT(oldW, newW, o.t);
      return t === o.t ? o : { ...o, t };
    });
    const next: Plan = {
      ...plan,
      walls: nextWalls,
      openings,
      updatedAt: Date.now(),
    };
    set({
      plans: s.plans.map((p) => (p.id === s.currentId ? next : p)),
      selection: { kind: "wall", id: wallId },
    });
    get().persist();
  },

  setOpeningWidth: (id, feet) => {
    const s = get();
    const plan = s.current();
    const opening = plan.openings.find((o) => o.id === id);
    if (!opening) return;
    const wall = plan.walls.find((w) => w.id === opening.wallId);
    if (!wall) return;
    const max = Math.max(1.5, dist(wall.a, wall.b) - 0.8);
    const width = Math.max(1.25, Math.min(max, feet));
    if (Math.abs(width - opening.width) < 0.01) return;
    get().pushHistory();
    const next: Plan = {
      ...plan,
      openings: plan.openings.map((o) => (o.id === id ? { ...o, width } : o)),
      updatedAt: Date.now(),
    };
    set({ plans: s.plans.map((p) => (p.id === s.currentId ? next : p)) });
    get().persist();
  },

  setOpeningHeight: (id, feet) => {
    const s = get();
    const plan = s.current();
    const opening = plan.openings.find((o) => o.id === id);
    if (!opening) return;
    const height = Math.max(1.5, Math.min(14, feet));
    if (Math.abs(height - opening.height) < 0.01) return;
    get().pushHistory();
    const next: Plan = {
      ...plan,
      openings: plan.openings.map((o) => (o.id === id ? { ...o, height } : o)),
      updatedAt: Date.now(),
    };
    set({ plans: s.plans.map((p) => (p.id === s.currentId ? next : p)) });
    get().persist();
  },

  updateOpening: (id, patch) => {
    const s = get();
    const plan = s.current();
    const opening = plan.openings.find((o) => o.id === id);
    if (!opening) return;
    const tracked = patch.width != null || patch.height != null || patch.config != null || patch.mark != null || patch.type != null;
    if (tracked) get().pushHistory();
    const next: Plan = {
      ...plan,
      openings: plan.openings.map((o) => (o.id === id ? { ...o, ...patch, id: o.id } : o)),
      updatedAt: Date.now(),
    };
    set({ plans: s.plans.map((p) => (p.id === s.currentId ? next : p)) });
    get().persist();
  },

  setJobMeta: (patch) => {
    const s = get();
    const plan = s.current();
    const next: Plan = {
      ...plan,
      name: patch.name ?? plan.name,
      jobNumber: patch.jobNumber ?? plan.jobNumber,
      address: patch.address ?? plan.address,
      updatedAt: Date.now(),
    };
    set({ plans: s.plans.map((p) => (p.id === s.currentId ? next : p)) });
    get().persist();
  },

  setFurnitureSize: (id, w, h) => {
    const s = get();
    const plan = s.current();
    const item = plan.furniture.find((f) => f.id === id);
    if (!item) return;
    const nw = Math.max(0.5, Math.min(20, w));
    const nh = Math.max(0.5, Math.min(20, h));
    if (Math.abs(nw - item.w) < 0.01 && Math.abs(nh - item.h) < 0.01) return;
    get().pushHistory();
    const next: Plan = {
      ...plan,
      furniture: plan.furniture.map((f) => (f.id === id ? { ...f, w: nw, h: nh } : f)),
      updatedAt: Date.now(),
    };
    set({ plans: s.plans.map((p) => (p.id === s.currentId ? next : p)) });
    get().persist();
  },

  placeRect: (origin, w, h) => {
    const width = Math.max(MIN_WALL, Math.min(120, w));
    const depth = Math.max(MIN_WALL, Math.min(120, h));
    get().pushHistory();
    const s = get();
    const plan = s.current();
    const walls = rectWalls(origin, width, depth).map((wall) => ({
      ...wall,
      id: uid("w"),
    }));
    const next: Plan = {
      ...plan,
      walls: [...plan.walls, ...walls],
      updatedAt: Date.now(),
    };
    set({
      plans: s.plans.map((p) => (p.id === s.currentId ? next : p)),
      pendingRect: null,
      showWelcome: false,
    });
    get().persist();
  },

  moveVertex: (wallId, end, p) => {
    const s = get();
    const plan = s.current();
    const next: Plan = {
      ...plan,
      walls: plan.walls.map((w) =>
        w.id === wallId ? { ...w, [end]: p } : w,
      ),
      updatedAt: Date.now(),
    };
    set({ plans: s.plans.map((pl) => (pl.id === s.currentId ? next : pl)) });
  },

  deleteSelection: () => {
    const s = get();
    const sel = s.selection;
    if (!sel) return;
    get().pushHistory();
    const plan = s.current();
    let next = plan;
    if (sel.kind === "wall") {
      next = {
        ...plan,
        walls: plan.walls.filter((w) => w.id !== sel.id),
        openings: plan.openings.filter((o) => o.wallId !== sel.id),
      };
    } else if (sel.kind === "opening") {
      next = { ...plan, openings: plan.openings.filter((o) => o.id !== sel.id) };
    } else if (sel.kind === "furniture") {
      next = { ...plan, furniture: plan.furniture.filter((f) => f.id !== sel.id) };
    } else if (sel.kind === "label") {
      next = { ...plan, labels: plan.labels.filter((l) => l.id !== sel.id) };
    }
    next = { ...next, updatedAt: Date.now() };
    set({
      plans: s.plans.map((pl) => (pl.id === s.currentId ? next : pl)),
      selection: null,
    });
    get().persist();
  },

  newPlan: () => {
    const plan = createEmptyPlan(`Plan ${get().plans.length + 1}`);
    set((s) => ({
      plans: [...s.plans, plan],
      currentId: plan.id,
      past: [],
      future: [],
      selection: null,
      sheet: "none",
      showWelcome: false,
      camera: { panX: 56, panY: 96, zoom: 1 },
    }));
    get().persist();
  },

  loadSample: () => {
    const plan = createSamplePlan();
    set((s) => ({
      plans: [...s.plans.filter((p) => p.walls.length > 0), plan],
      currentId: plan.id,
      past: [],
      future: [],
      selection: null,
      sheet: "none",
      showWelcome: false,
    }));
    get().persist();
  },

  switchPlan: (id) => {
    set({ currentId: id, past: [], future: [], selection: null, sheet: "none" });
    get().persist();
  },

  renamePlan: (name) => {
    const s = get();
    set({
      plans: s.plans.map((p) =>
        p.id === s.currentId ? { ...p, name, updatedAt: Date.now() } : p,
      ),
    });
    get().persist();
  },

  deletePlan: (id) => {
    const s = get();
    if (s.plans.length <= 1) {
      const plan = createEmptyPlan();
      set({ plans: [plan], currentId: plan.id, selection: null, past: [], future: [] });
      get().persist();
      return;
    }
    const plans = s.plans.filter((p) => p.id !== id);
    const currentId = s.currentId === id ? plans[0]!.id : s.currentId;
    set({ plans, currentId, selection: null, past: [], future: [] });
    get().persist();
  },

  duplicatePlan: () => {
    const plan = snapshotPlan(get().current());
    plan.id = uid("plan");
    plan.name = `${plan.name} copy`;
    plan.updatedAt = Date.now();
    set((s) => ({
      plans: [...s.plans, plan],
      currentId: plan.id,
      sheet: "none",
    }));
    get().persist();
  },

  clearPlan: () => {
    get().pushHistory();
    const s = get();
    const plan = s.current();
    const next: Plan = {
      ...plan,
      walls: [],
      openings: [],
      labels: [],
      furniture: [],
      annotations: [],
      updatedAt: Date.now(),
    };
    set({
      plans: s.plans.map((p) => (p.id === s.currentId ? next : p)),
      selection: null,
    });
    get().persist();
  },

  importPlan: (plan) => {
    const next = migratePlan(plan);
    set((s) => ({
      plans: [...s.plans.filter((p) => p.jobNumber !== next.jobNumber || !next.jobNumber), next],
      currentId: next.id,
      showWelcome: false,
      selection: null,
      past: [],
      future: [],
    }));
    get().persist();
  },

  setOrgJobs: (jobs) => set({ orgJobs: jobs }),
}));

export { fitCamera };
