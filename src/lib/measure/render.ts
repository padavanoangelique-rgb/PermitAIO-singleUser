import {
  boundsOf,
  dimensionAnchors,
  dist,
  exteriorSign,
  formatFeet,
  lerp,
  midpoint,
  wallLength,
  wallNormal,
} from "./geometry";
import type {
  Annotation,
  Camera,
  Furniture,
  FurnitureKind,
  Label,
  Opening,
  Plan,
  Pt,
  Room,
  Selection,
  Wall,
} from "./types";
import { PX_PER_FOOT, WALL_THICKNESS } from "./types";

export type Theme = {
  paper: string;
  paper2: string;
  ink: string;
  inkSoft: string;
  muted: string;
  faint: string;
  grid: string;
  gridStrong: string;
  accent: string;
  room: string;
};

export type Preview = {
  raw: Pt[];
  walls: Wall[];
  morph: number;
  lengthLabel?: string;
  snapGuides?: { x?: number; y?: number };
};

export type RenderInput = {
  width: number;
  height: number;
  dpr: number;
  camera: Camera;
  plan: Plan;
  rooms: Room[];
  preview?: Preview | null;
  selection: Selection;
  showGrid: boolean;
  showDims: boolean;
  hoverPt?: Pt | null;
  theme: Theme;
};

export function screenOf(p: Pt, cam: Camera): Pt {
  const s = PX_PER_FOOT * cam.zoom;
  return { x: p.x * s + cam.panX, y: p.y * s + cam.panY };
}

export function worldOf(p: Pt, cam: Camera): Pt {
  const s = PX_PER_FOOT * cam.zoom;
  return { x: (p.x - cam.panX) / s, y: (p.y - cam.panY) / s };
}

export function readTheme(el: HTMLElement): Theme {
  const s = getComputedStyle(el);
  const v = (name: string, fallback: string) => {
    const raw = s.getPropertyValue(name).trim();
    return raw || fallback;
  };
  return {
    paper: v("--color-paper", "#F7F9FC"),
    paper2: v("--color-paper-2", "#E8EEF5"),
    ink: v("--color-ink", "#0F172A"),
    inkSoft: v("--color-ink-soft", "#334155"),
    muted: v("--color-muted", "#64748B"),
    faint: v("--color-faint", "#94A3B8"),
    grid: v("--color-grid", "#D5DCE6"),
    gridStrong: v("--color-grid-strong", "#C5CED9"),
    accent: v("--color-accent", "#005ADE"),
    room: v("--color-room", "#64748B"),
  };
}

export function renderPlan(ctx: CanvasRenderingContext2D, input: RenderInput) {
  const { width, height, dpr, camera, plan, rooms, theme } = input;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = theme.paper;
  ctx.fillRect(0, 0, width, height);

  if (input.showGrid) drawGrid(ctx, width, height, camera, theme);

  for (const room of rooms) drawRoomFill(ctx, room, camera, theme);

  drawAnnotations(ctx, plan.annotations, camera, theme, input.preview);

  drawWalls(ctx, plan.walls, plan.openings, camera, theme, input.selection);

  for (const o of plan.openings) {
    const wall = plan.walls.find((w) => w.id === o.wallId);
    if (wall) drawOpening(ctx, wall, o, camera, theme, input.selection);
  }

  for (const o of plan.openings) {
    const wall = plan.walls.find((w) => w.id === o.wallId);
    if (wall) drawOpeningTag(ctx, wall, o, plan.walls, camera, theme, input.selection);
  }

  for (const f of plan.furniture) {
    drawFurniture(ctx, f, camera, theme, input.selection);
  }

  if (input.showDims) drawDimensions(ctx, plan.walls, plan.openings, camera, theme, input.selection);

  for (const room of rooms) drawRoomCaption(ctx, room, camera, theme);
  for (const label of plan.labels) drawLabel(ctx, label, camera, theme, input.selection);

  if (input.preview) drawPreview(ctx, input.preview, camera, theme);

  drawScaleBar(ctx, width, height, camera, theme);
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cam: Camera,
  theme: Theme,
) {
  const s = PX_PER_FOOT * cam.zoom;
  const step = s;
  if (step < 10) return;
  const originX = cam.panX;
  const originY = cam.panY;
  const startX = originX % step;
  const startY = originY % step;

  ctx.save();
  ctx.beginPath();
  for (let x = startX; x <= w; x += step) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
  }
  for (let y = startY; y <= h; y += step) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
  }
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1;
  ctx.stroke();

  const major = step * 5;
  const startXM = originX % major;
  const startYM = originY % major;
  ctx.beginPath();
  for (let x = startXM; x <= w; x += major) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
  }
  for (let y = startYM; y <= h; y += major) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
  }
  ctx.strokeStyle = theme.gridStrong;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawRoomFill(
  ctx: CanvasRenderingContext2D,
  room: Room,
  cam: Camera,
  theme: Theme,
) {
  if (room.polygon.length < 3) return;
  ctx.save();
  ctx.beginPath();
  room.polygon.forEach((p, i) => {
    const s = screenOf(p, cam);
    if (i === 0) ctx.moveTo(s.x, s.y);
    else ctx.lineTo(s.x, s.y);
  });
  ctx.closePath();
  ctx.fillStyle = withAlpha(theme.room, 0.08);
  ctx.fill();
  ctx.restore();
}

function drawRoomCaption(
  ctx: CanvasRenderingContext2D,
  room: Room,
  cam: Camera,
  theme: Theme,
) {
  const c = screenOf(room.centroid, cam);
  const name = room.name;
  const area = `${Math.round(room.area)} sf`;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (!name) {
    ctx.fillStyle = withAlpha(theme.ink, 0.55);
    ctx.font = `500 ${Math.max(11, 12 * Math.min(cam.zoom, 1.4))}px Outfit, system-ui, sans-serif`;
    ctx.fillText("Room", c.x, c.y - 7);
    ctx.font = `400 ${Math.max(10, 11 * Math.min(cam.zoom, 1.4))}px "IBM Plex Mono", ui-monospace, monospace`;
    ctx.fillStyle = withAlpha(theme.muted, 0.85);
    ctx.fillText(area, c.x, c.y + 8);
  } else {
    ctx.font = `400 ${Math.max(10, 11 * Math.min(cam.zoom, 1.4))}px "IBM Plex Mono", ui-monospace, monospace`;
    ctx.fillStyle = withAlpha(theme.muted, 0.85);
    ctx.fillText(area, c.x, c.y + 14);
  }
  ctx.restore();
}

function openingsOn(wallId: string, openings: Opening[]) {
  return openings.filter((o) => o.wallId === wallId).sort((a, b) => a.t - b.t);
}

function drawWalls(
  ctx: CanvasRenderingContext2D,
  walls: Wall[],
  openings: Opening[],
  cam: Camera,
  theme: Theme,
  selection: Selection,
) {
  const s = PX_PER_FOOT * cam.zoom;
  const outer = Math.max(3.5, WALL_THICKNESS * s);
  const inner = Math.max(0, outer - Math.min(3.2, 2.2 + cam.zoom));

  for (const wall of walls) {
    const selected = selection?.kind === "wall" && selection.id === wall.id;
    const spans = wallSpans(wall, openingsOn(wall.id, openings));
    for (const [a, b] of spans) {
      const sa = screenOf(a, cam);
      const sb = screenOf(b, cam);
      ctx.save();
      ctx.lineCap = "butt";
      ctx.lineJoin = "miter";
      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y);
      ctx.lineTo(sb.x, sb.y);
      ctx.strokeStyle = selected ? theme.accent : theme.ink;
      ctx.lineWidth = outer;
      ctx.stroke();
      if (inner > 2) {
        ctx.beginPath();
        ctx.moveTo(sa.x, sa.y);
        ctx.lineTo(sb.x, sb.y);
        ctx.strokeStyle = theme.paper;
        ctx.lineWidth = inner;
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

function wallSpans(wall: Wall, openings: Opening[]): [Pt, Pt][] {
  const len = wallLength(wall);
  if (len < 0.05) return [];
  const cuts: { t0: number; t1: number }[] = openings.map((o) => {
    const half = o.width / 2 / len;
    return { t0: Math.max(0, o.t - half), t1: Math.min(1, o.t + half) };
  });
  cuts.sort((a, b) => a.t0 - b.t0);
  const spans: [Pt, Pt][] = [];
  let t = 0;
  for (const c of cuts) {
    if (c.t0 > t + 0.004) spans.push([lerp(wall.a, wall.b, t), lerp(wall.a, wall.b, c.t0)]);
    t = Math.max(t, c.t1);
  }
  if (t < 0.996) spans.push([lerp(wall.a, wall.b, t), wall.b]);
  return spans;
}

function drawOpening(
  ctx: CanvasRenderingContext2D,
  wall: Wall,
  o: Opening,
  cam: Camera,
  theme: Theme,
  selection: Selection,
) {
  const selected = selection?.kind === "opening" && selection.id === o.id;
  const len = wallLength(wall);
  if (len < 0.05) return;
  const dir = { x: (wall.b.x - wall.a.x) / len, y: (wall.b.y - wall.a.y) / len };
  const n = wallNormal(wall);
  const sign = o.flip ? -1 : 1;
  const center = lerp(wall.a, wall.b, o.t);
  const half = o.width / 2;
  const a = { x: center.x - dir.x * half, y: center.y - dir.y * half };
  const b = { x: center.x + dir.x * half, y: center.y + dir.y * half };
  const sa = screenOf(a, cam);
  const sb = screenOf(b, cam);
  const color = selected ? theme.accent : theme.ink;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = "transparent";
  ctx.lineWidth = Math.max(1.2, 1.4 * cam.zoom);
  ctx.lineCap = "butt";

  if (o.type === "door") {
    const hinge = sa;
    const leaf = {
      x: hinge.x + (sb.x - sa.x) * 0,
      y: hinge.y + (sb.y - sa.y) * 0,
    };
    void leaf;
    const ns = screenOf(
      { x: a.x + n.x * o.width * sign, y: a.y + n.y * o.width * sign },
      cam,
    );
    ctx.beginPath();
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(ns.x, ns.y);
    ctx.stroke();
    ctx.beginPath();
    const radius = dist(sa, sb);
    const start = Math.atan2(sb.y - sa.y, sb.x - sa.x);
    const end = Math.atan2(ns.y - sa.y, ns.x - sa.x);
    const ccw = sign > 0;
    ctx.arc(sa.x, sa.y, radius, start, end, !ccw);
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = withAlpha(color, 0.7);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    const n1 = screenOf(
      { x: a.x + n.x * WALL_THICKNESS * 0.7, y: a.y + n.y * WALL_THICKNESS * 0.7 },
      cam,
    );
    const n2 = screenOf(
      { x: a.x - n.x * WALL_THICKNESS * 0.7, y: a.y - n.y * WALL_THICKNESS * 0.7 },
      cam,
    );
    const m1 = screenOf(
      { x: b.x + n.x * WALL_THICKNESS * 0.7, y: b.y + n.y * WALL_THICKNESS * 0.7 },
      cam,
    );
    const m2 = screenOf(
      { x: b.x - n.x * WALL_THICKNESS * 0.7, y: b.y - n.y * WALL_THICKNESS * 0.7 },
      cam,
    );
    ctx.beginPath();
    ctx.moveTo(n1.x, n1.y);
    ctx.lineTo(m1.x, m1.y);
    ctx.moveTo(n2.x, n2.y);
    ctx.lineTo(m2.x, m2.y);
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(sb.x, sb.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawOpeningTag(
  ctx: CanvasRenderingContext2D,
  wall: Wall,
  o: Opening,
  walls: Wall[],
  cam: Camera,
  theme: Theme,
  selection: Selection,
) {
  const len = wallLength(wall);
  if (len < 0.05) return;
  const n = wallNormal(wall);
  const center = lerp(wall.a, wall.b, o.t);
  const selected = selection?.kind === "opening" && selection.id === o.id;
  const sign = -exteriorSign(wall, walls);
  const offset = 0.78 * sign;
  const p = { x: center.x + n.x * offset, y: center.y + n.y * offset };
  const s = screenOf(p, cam);
  const mark = o.mark || "?";
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const r = Math.max(10, 11 * Math.min(cam.zoom, 1.35));
  ctx.beginPath();
  ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
  ctx.fillStyle = selected ? theme.ink : theme.paper;
  ctx.fill();
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = selected ? theme.ink : theme.ink;
  ctx.stroke();
  ctx.fillStyle = selected ? theme.paper : theme.ink;
  ctx.font = `600 ${Math.max(10, 11 * Math.min(cam.zoom, 1.3))}px "IBM Plex Mono", ui-monospace, monospace`;
  ctx.fillText(mark, s.x, s.y + 0.5);
  ctx.restore();
}

function drawFurniture(
  ctx: CanvasRenderingContext2D,
  f: Furniture,
  cam: Camera,
  theme: Theme,
  selection: Selection,
) {
  const selected = selection?.kind === "furniture" && selection.id === f.id;
  const s = PX_PER_FOOT * cam.zoom;
  const c = screenOf({ x: f.x, y: f.y }, cam);
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(f.rot);
  const w = f.w * s;
  const h = f.h * s;
  ctx.strokeStyle = selected ? theme.accent : theme.inkSoft;
  ctx.fillStyle = withAlpha(theme.paper, 0.5);
  ctx.lineWidth = Math.max(1.1, 1.25 * cam.zoom);
  drawFurnitureSymbol(ctx, f.kind, w, h);
  if (selected) {
    ctx.strokeStyle = theme.accent;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12);
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawFurnitureSymbol(
  ctx: CanvasRenderingContext2D,
  kind: FurnitureKind,
  w: number,
  h: number,
) {
  const r = (x: number, y: number, ww: number, hh: number) => {
    ctx.beginPath();
    ctx.rect(x, y, ww, hh);
    ctx.fill();
    ctx.stroke();
  };
  const rr = (x: number, y: number, ww: number, hh: number, rad: number) => {
    const radius = Math.min(rad, ww / 2, hh / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + ww, y, x + ww, y + hh, radius);
    ctx.arcTo(x + ww, y + hh, x, y + hh, radius);
    ctx.arcTo(x, y + hh, x, y, radius);
    ctx.arcTo(x, y, x + ww, y, radius);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  switch (kind) {
    case "bed":
      rr(-w / 2, -h / 2, w, h, 6);
      r(-w / 2 + 6, -h / 2 + 6, w * 0.42, h * 0.28);
      r(w / 2 - 6 - w * 0.42, -h / 2 + 6, w * 0.42, h * 0.28);
      break;
    case "sofa":
      rr(-w / 2, -h / 2, w, h, 8);
      r(-w / 2, -h / 2, w, h * 0.28);
      r(-w / 2, -h / 2, w * 0.12, h);
      r(w / 2 - w * 0.12, -h / 2, w * 0.12, h);
      break;
    case "table":
      rr(-w / 2, -h / 2, w, h, 4);
      break;
    case "desk":
      r(-w / 2, -h / 2, w, h);
      r(-w / 2, h / 2 - h * 0.22, w * 0.28, h * 0.22);
      r(w / 2 - w * 0.28, h / 2 - h * 0.22, w * 0.28, h * 0.22);
      break;
    case "chair":
      rr(-w / 2, -h / 2, w, h, 5);
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h / 2 + 4);
      ctx.lineTo(w / 2, -h / 2 + 4);
      ctx.stroke();
      break;
    case "toilet":
      rr(-w * 0.32, -h / 2, w * 0.64, h * 0.38, 3);
      ctx.beginPath();
      ctx.ellipse(0, h * 0.18, w * 0.34, h * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    case "sink":
      rr(-w / 2, -h / 2, w, h, 8);
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.28, h * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "shower": {
      r(-w / 2, -h / 2, w, h);
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h / 2);
      ctx.lineTo(w / 2, h / 2);
      ctx.moveTo(w / 2, -h / 2);
      ctx.lineTo(-w / 2, h / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "tub":
      rr(-w / 2, -h / 2, w, h, 12);
      rr(-w / 2 + 6, -h / 2 + 5, w - 12, h - 10, 10);
      break;
    case "fridge":
      r(-w / 2, -h / 2, w, h);
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0);
      ctx.lineTo(w / 2, 0);
      ctx.stroke();
      break;
    case "stove":
      r(-w / 2, -h / 2, w, h);
      for (const [x, y] of [
        [-0.22, -0.22],
        [0.22, -0.22],
        [-0.22, 0.22],
        [0.22, 0.22],
      ] as const) {
        ctx.beginPath();
        ctx.arc(w * x, h * y, Math.min(w, h) * 0.14, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    case "nightstand":
      r(-w / 2, -h / 2, w, h);
      break;
    default:
      r(-w / 2, -h / 2, w, h);
  }
}

function drawDimensions(
  ctx: CanvasRenderingContext2D,
  walls: Wall[],
  openings: Opening[],
  cam: Camera,
  theme: Theme,
  selection: Selection,
) {
  const box = boundsOf(walls);
  if (!box) return;
  const anchors = dimensionAnchors(walls);
  const drawn = new Set(anchors.map((a) => a.wall.id));
  if (selection?.kind === "wall") {
    const wall = walls.find((w) => w.id === selection.id);
    if (wall && !drawn.has(wall.id) && wallLength(wall) >= 1.5) {
      const n = wallNormal(wall);
      const mid = midpoint(wall.a, wall.b);
      const offset = 1.95 + WALL_THICKNESS;
      const sign = exteriorSign(wall, walls);
      anchors.push({
        wall,
        point: { x: mid.x + n.x * offset * sign, y: mid.y + n.y * offset * sign },
      });
    }
  }
  ctx.save();
  ctx.fillStyle = theme.accent;
  ctx.strokeStyle = withAlpha(theme.accent, 0.7);
  ctx.lineWidth = 1;
  ctx.font = `400 ${Math.max(10, 10.5 * Math.min(cam.zoom, 1.3))}px "IBM Plex Mono", ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const { wall, point } of anchors) {
    const L = wallLength(wall);
    if (L < 1.5) continue;
    const mid = midpoint(wall.a, wall.b);
    const ox = point.x - mid.x;
    const oy = point.y - mid.y;
    const selected = selection?.kind === "wall" && selection.id === wall.id;
    ctx.strokeStyle = withAlpha(selected ? theme.ink : theme.accent, selected ? 0.9 : 0.7);
    const blocked = openings
      .filter((o) => o.wallId === wall.id)
      .map((o) => {
        const half = Math.min(0.45, (o.width / 2 + 0.35) / L);
        return [Math.max(0, o.t - half), Math.min(1, o.t + half)] as [number, number];
      })
      .sort((a, b) => a[0] - b[0]);
    let t = 0;
    const shift = (tt: number) => {
      const p = lerp(wall.a, wall.b, tt);
      return screenOf({ x: p.x + ox, y: p.y + oy }, cam);
    };
    for (const [t0, t1] of blocked) {
      if (t0 > t + 0.02) {
        const a = shift(t);
        const b = shift(t0);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      t = Math.max(t, t1);
    }
    if (t < 0.98) {
      const a = shift(t);
      const b = shift(1);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    let textT = 0.5;
    for (const [t0, t1] of blocked) {
      if (textT >= t0 && textT <= t1) textT = t1 < 0.85 ? t1 + 0.08 : t0 - 0.08;
    }
    textT = Math.max(0.12, Math.min(0.88, textT));
    const s = shift(textT);
    const text = formatFeet(L);
    const pad = 4;
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = selected ? theme.ink : theme.paper;
    ctx.fillRect(s.x - tw / 2 - pad, s.y - 8, tw + pad * 2, 16);
    ctx.fillStyle = selected ? theme.paper : theme.accent;
    ctx.fillText(text, s.x, s.y);
  }
  ctx.restore();
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  label: Label,
  cam: Camera,
  theme: Theme,
  selection: Selection,
) {
  const s = screenOf({ x: label.x, y: label.y }, cam);
  const selected = selection?.kind === "label" && selection.id === label.id;
  ctx.save();
  ctx.font = `600 ${Math.max(11, 12 * Math.min(cam.zoom, 1.35))}px Outfit, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const tw = ctx.measureText(label.text).width;
  const padX = 10;
  const h = Math.max(22, 24 * Math.min(cam.zoom, 1.2));
  const w = tw + padX * 2;
  ctx.beginPath();
  ctx.roundRect(s.x - w / 2, s.y - h / 2, w, h, h / 2);
  ctx.fillStyle = selected ? theme.ink : theme.paper;
  ctx.fill();
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = selected ? theme.ink : theme.ink;
  ctx.stroke();
  ctx.fillStyle = selected ? theme.paper : theme.ink;
  ctx.fillText(label.text, s.x, s.y + 0.5);
  ctx.restore();
}

function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  items: Annotation[],
  cam: Camera,
  theme: Theme,
  preview?: Preview | null,
) {
  ctx.save();
  ctx.strokeStyle = withAlpha(theme.ink, 0.45);
  ctx.lineWidth = Math.max(1, 1.2 * cam.zoom);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const a of items) strokePath(ctx, a.points, cam);
  if (preview && preview.walls.length === 0 && preview.raw.length > 1) {
    ctx.strokeStyle = withAlpha(theme.ink, 0.4);
    strokePath(ctx, preview.raw, cam);
  }
  ctx.restore();
}

function strokePath(ctx: CanvasRenderingContext2D, pts: Pt[], cam: Camera) {
  if (pts.length < 2) return;
  ctx.beginPath();
  pts.forEach((p, i) => {
    const s = screenOf(p, cam);
    if (i === 0) ctx.moveTo(s.x, s.y);
    else ctx.lineTo(s.x, s.y);
  });
  ctx.stroke();
}

function drawPreview(
  ctx: CanvasRenderingContext2D,
  preview: Preview,
  cam: Camera,
  theme: Theme,
) {
  ctx.save();
  if (preview.raw.length > 1 && preview.morph < 1) {
    ctx.strokeStyle = withAlpha(theme.ink, 0.28 * (1 - preview.morph));
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    strokePath(ctx, preview.raw, cam);
  }
  const s = PX_PER_FOOT * cam.zoom;
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = Math.max(2, WALL_THICKNESS * s * 0.55);
  ctx.lineCap = "butt";
  ctx.setLineDash(preview.morph < 1 ? [8, 5] : []);
  for (const w of preview.walls) {
    const a = screenOf(w.a, cam);
    const b = screenOf(w.b, cam);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  if (preview.snapGuides) {
    ctx.strokeStyle = withAlpha(theme.accent, 0.35);
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    if (preview.snapGuides.x !== undefined) {
      const x = screenOf({ x: preview.snapGuides.x, y: 0 }, cam).x;
      ctx.beginPath();
      ctx.moveTo(x, -20);
      ctx.lineTo(x, 4000);
      ctx.stroke();
    }
    if (preview.snapGuides.y !== undefined) {
      const y = screenOf({ x: 0, y: preview.snapGuides.y }, cam).y;
      ctx.beginPath();
      ctx.moveTo(-20, y);
      ctx.lineTo(4000, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  if (preview.lengthLabel && preview.walls.length) {
    const w0 = preview.walls[0]!;
    const mid = screenOf(midpoint(w0.a, w0.b), cam);
    const labelPt =
      preview.walls.length === 1
        ? { x: mid.x, y: mid.y - 13 }
        : screenOf(w0.a, cam);
    ctx.font = `500 12px "IBM Plex Mono", ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const tw = ctx.measureText(preview.lengthLabel).width;
    ctx.fillStyle = theme.ink;
    ctx.fillRect(labelPt.x - tw / 2 - 6, labelPt.y - 9, tw + 12, 18);
    ctx.fillStyle = theme.paper;
    ctx.fillText(preview.lengthLabel, labelPt.x, labelPt.y);
  }
  ctx.restore();
}

function drawScaleBar(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cam: Camera,
  theme: Theme,
) {
  const s = PX_PER_FOOT * cam.zoom;
  let feet = 5;
  if (s * feet > 160) feet = 2;
  if (s * feet > 160) feet = 1;
  if (s * feet < 48) feet = 10;
  const barW = s * feet;
  const x = 20;
  const y = height - 28;
  ctx.save();
  ctx.fillStyle = withAlpha(theme.paper, 0.88);
  ctx.fillRect(x - 8, y - 18, barW + 16, 32);
  ctx.strokeStyle = theme.ink;
  ctx.fillStyle = theme.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + barW, y);
  ctx.moveTo(x, y - 5);
  ctx.lineTo(x, y + 5);
  ctx.moveTo(x + barW, y - 5);
  ctx.lineTo(x + barW, y + 5);
  ctx.stroke();
  ctx.font = `400 10px "IBM Plex Mono", ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(`${feet} ft`, x + barW / 2, y - 4);
  ctx.restore();
}

function withAlpha(color: string, alpha: number): string {
  const c = color.trim();
  if (c.startsWith("rgb(")) {
    return c.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  }
  if (c.startsWith("#")) {
    let hex = c.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((ch) => ch + ch)
        .join("");
    }
    const n = parseInt(hex.slice(0, 6), 16);
    if (Number.isNaN(n)) return c;
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return c;
}

export function hitFurniture(
  p: Pt,
  items: Furniture[],
): Furniture | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const f = items[i]!;
    const dx = p.x - f.x;
    const dy = p.y - f.y;
    const c = Math.cos(-f.rot);
    const s = Math.sin(-f.rot);
    const lx = dx * c - dy * s;
    const ly = dx * s + dy * c;
    if (Math.abs(lx) <= f.w / 2 && Math.abs(ly) <= f.h / 2) return f;
  }
  return null;
}

export function hitLabel(p: Pt, labels: Label[], radius: number): Label | null {
  let best: Label | null = null;
  let bestD = radius;
  for (const l of labels) {
    const d = dist(p, { x: l.x, y: l.y });
    if (d < bestD) {
      bestD = d;
      best = l;
    }
  }
  return best;
}

export function hitOpeningTag(
  p: Pt,
  walls: Wall[],
  openings: Opening[],
  radius: number,
): Opening | null {
  let best: Opening | null = null;
  let bestD = radius;
  for (const o of openings) {
    const wall = walls.find((w) => w.id === o.wallId);
    if (!wall) continue;
    const n = wallNormal(wall);
    const center = lerp(wall.a, wall.b, o.t);
    const sign = o.flip ? -1 : 1;
    const tag = { x: center.x + n.x * 0.85 * sign, y: center.y + n.y * 0.85 * sign };
    const d = dist(p, tag);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}
