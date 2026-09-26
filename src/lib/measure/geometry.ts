import { MIN_WALL, SNAP_GRID, WALL_THICKNESS, type Pt, type Wall } from "./types";

export function dist(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function sub(a: Pt, b: Pt): Pt {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function add(a: Pt, b: Pt): Pt {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function scale(a: Pt, s: number): Pt {
  return { x: a.x * s, y: a.y * s };
}

export function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function len(a: Pt): number {
  return Math.hypot(a.x, a.y);
}

export function norm(a: Pt): Pt {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
}

export function dot(a: Pt, b: Pt): number {
  return a.x * b.x + a.y * b.y;
}

export function cross(a: Pt, b: Pt): number {
  return a.x * b.y - a.y * b.x;
}

export function midpoint(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function nearly(a: Pt, b: Pt, eps = 1e-4): boolean {
  return dist(a, b) <= eps;
}

export function keyPt(p: Pt, prec = 3): string {
  return `${p.x.toFixed(prec)},${p.y.toFixed(prec)}`;
}

export function snapToGrid(p: Pt, grid = SNAP_GRID): Pt {
  return {
    x: Math.round(p.x / grid) * grid,
    y: Math.round(p.y / grid) * grid,
  };
}

export function snapAngle(vec: Pt, stepDeg: number): Pt {
  const l = len(vec);
  if (l < 1e-6) return { x: 0, y: 0 };
  const angle = Math.atan2(vec.y, vec.x);
  const step = (stepDeg * Math.PI) / 180;
  const snapped = Math.round(angle / step) * step;
  return { x: Math.cos(snapped) * l, y: Math.sin(snapped) * l };
}

export function projectOnSegment(
  p: Pt,
  a: Pt,
  b: Pt,
): { t: number; point: Pt; dist: number; clamped: boolean } {
  const ab = sub(b, a);
  const l2 = dot(ab, ab) || 1e-9;
  let t = dot(sub(p, a), ab) / l2;
  const clamped = t < 0 || t > 1;
  t = Math.max(0, Math.min(1, t));
  const point = lerp(a, b, t);
  return { t, point, dist: dist(p, point), clamped };
}

export function segmentsIntersect(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const ab = sub(b, a);
  const cd = sub(d, c);
  const den = cross(ab, cd);
  if (Math.abs(den) < 1e-9) return false;
  const ac = sub(c, a);
  const t = cross(ac, cd) / den;
  const u = cross(ac, ab) / den;
  return t > 0.02 && t < 0.98 && u > 0.02 && u < 0.98;
}

export function polylineHitsSegment(points: Pt[], a: Pt, b: Pt): boolean {
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1];
    const q = points[i];
    if (!p || !q) continue;
    if (segmentsIntersect(p, q, a, b)) return true;
    if (projectOnSegment(p, a, b).dist < 0.25) return true;
  }
  return false;
}

/** Ramer–Douglas–Peucker simplification in world units. */
export function simplifyRdp(points: Pt[], epsilon: number): Pt[] {
  if (points.length <= 2) return points.slice();
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return points.slice();

  let maxDist = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    if (!p) continue;
    const d = projectOnSegment(p, first, last).dist;
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyRdp(points.slice(0, index + 1), epsilon);
    const right = simplifyRdp(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

export function polygonArea(poly: Pt[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    if (!p || !q) continue;
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export function polygonCentroid(poly: Pt[]): Pt {
  let cx = 0;
  let cy = 0;
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    if (!p || !q) continue;
    const crossV = p.x * q.y - q.x * p.y;
    a += crossV;
    cx += (p.x + q.x) * crossV;
    cy += (p.y + q.y) * crossV;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-6) {
    let sx = 0;
    let sy = 0;
    for (const p of poly) {
      sx += p.x;
      sy += p.y;
    }
    const n = poly.length || 1;
    return { x: sx / n, y: sy / n };
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (!a || !b) continue;
    const intersect =
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y + 1e-12) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function formatFeet(feet: number): string {
  const totalInches = Math.round(Math.abs(feet) * 12);
  const f = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  if (inches === 0) return `${f}'`;
  return `${f}'-${inches}"`;
}

/** Parse CAD-style lengths: 12, 12.5, 12', 12'6", 12'-6", 12-6, 6". */
export function parseFeet(raw: string): number | null {
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  s = s
    .replace(/feet|foot|ft\.?/g, "'")
    .replace(/inches|inch|in\.?/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  let m = s.match(/^(\d+(?:\.\d+)?)\s*"$/);
  if (m) {
    const inches = Number(m[1]);
    return Number.isFinite(inches) ? inches / 12 : null;
  }

  m = s.match(/^(\d+(?:\.\d+)?)\s*'?\s*-?\s*(\d+(?:\.\d+)?)\s*"?$/);
  if (m && /['\-"\s]/.test(s)) {
    const feet = Number(m[1]);
    const inches = Number(m[2]);
    if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null;
    return feet + inches / 12;
  }

  m = s.match(/^(\d+(?:\.\d+)?)\s*'?$/);
  if (m) {
    const feet = Number(m[1]);
    return Number.isFinite(feet) ? feet : null;
  }

  return null;
}

const EIGHTH_LABEL = ["", " 1/8", " 1/4", " 3/8", " 1/2", " 5/8", " 3/4", " 7/8"];

/** Window shop size: 36" × 63". Walls stay in feet. */
export function formatInches(feet: number): string {
  const eighths = Math.round(Math.abs(feet) * 12 * 8);
  const whole = Math.floor(eighths / 8);
  const frac = eighths % 8;
  return `${whole}${EIGHTH_LABEL[frac]}"`;
}

export function inchesOf(feet: number): number {
  return Math.round(Math.abs(feet) * 12 * 8) / 8;
}

/**
 * Window fields: a bare number is inches (36 → 36").
 * If they type a foot mark (3' or 3'-0"), honor feet.
 */
export function parseInches(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (/[']|ft|foot|feet/.test(s)) return parseFeet(s);

  const cleaned = s
    .replace(/inches|inch|in\.?/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  let m = cleaned.match(/^(\d+(?:\.\d+)?)\s*[- ]\s*(\d+)\s*\/\s*(\d+)\s*"?$/);
  if (m) {
    const den = Number(m[3]);
    if (!den) return null;
    const inches = Number(m[1]) + Number(m[2]) / den;
    return Number.isFinite(inches) ? inches / 12 : null;
  }

  m = cleaned.match(/^(\d+)\s*\/\s*(\d+)\s*"?$/);
  if (m) {
    const den = Number(m[2]);
    if (!den) return null;
    const inches = Number(m[1]) / den;
    return Number.isFinite(inches) ? inches / 12 : null;
  }

  m = cleaned.match(/^(\d+(?:\.\d+)?)\s*"?$/);
  if (m) {
    const inches = Number(m[1]);
    return Number.isFinite(inches) ? inches / 12 : null;
  }

  return null;
}

export function parseLength(raw: string, unit: "feet" | "inches"): number | null {
  return unit === "inches" ? parseInches(raw) : parseFeet(raw);
}

export function formatLength(feet: number, unit: "feet" | "inches"): string {
  return unit === "inches" ? formatInches(feet) : formatFeet(feet);
}

export function wallLength(w: Wall): number {
  return dist(w.a, w.b);
}

export function wallDir(w: Wall): Pt {
  return norm(sub(w.b, w.a));
}

export function wallNormal(w: Wall): Pt {
  const d = wallDir(w);
  return { x: -d.y, y: d.x };
}

export function boundsOf(
  walls: Wall[],
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (walls.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const w of walls) {
    minX = Math.min(minX, w.a.x, w.b.x);
    minY = Math.min(minY, w.a.y, w.b.y);
    maxX = Math.max(maxX, w.a.x, w.b.x);
    maxY = Math.max(maxY, w.a.y, w.b.y);
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

export type SnapTarget = {
  vertices: Pt[];
  walls: Wall[];
};

export function collectVertices(walls: Wall[]): Pt[] {
  const map = new Map<string, Pt>();
  for (const w of walls) {
    for (const p of [w.a, w.b]) {
      const snapped = snapToGrid(p);
      const k = keyPt(snapped);
      if (!map.has(k)) map.set(k, snapped);
    }
  }
  return [...map.values()];
}

export function snapPoint(
  p: Pt,
  target: SnapTarget,
  radius: number,
): { point: Pt; kind: "vertex" | "edge" | "grid"; wallId?: string } {
  let bestVertex: Pt | null = null;
  let bestVD = radius;
  for (const v of target.vertices) {
    const d = dist(p, v);
    if (d < bestVD) {
      bestVD = d;
      bestVertex = v;
    }
  }
  if (bestVertex) return { point: bestVertex, kind: "vertex" };

  let bestEdge: { point: Pt; wallId: string; dist: number } | null = null;
  for (const w of target.walls) {
    const proj = projectOnSegment(p, w.a, w.b);
    if (!proj.clamped && proj.dist < radius) {
      if (!bestEdge || proj.dist < bestEdge.dist) {
        bestEdge = { point: proj.point, wallId: w.id, dist: proj.dist };
      }
    }
  }
  if (bestEdge && bestEdge.dist < radius * 0.85) {
    return { point: snapToGrid(bestEdge.point), kind: "edge", wallId: bestEdge.wallId };
  }

  return { point: snapToGrid(p), kind: "grid" };
}

export function mergeCollinear(walls: Wall[], angleEps = 0.02): Wall[] {
  const used = new Set<string>();
  const out: Wall[] = [];

  const byVertex = new Map<string, Wall[]>();
  const add = (p: Pt, w: Wall) => {
    const k = keyPt(snapToGrid(p));
    const list = byVertex.get(k) ?? [];
    list.push(w);
    byVertex.set(k, list);
  };
  for (const w of walls) {
    add(w.a, w);
    add(w.b, w);
  }

  const dirOf = (w: Wall) => {
    const d = sub(w.b, w.a);
    const l = len(d) || 1;
    return { x: d.x / l, y: d.y / l };
  };
  const collinear = (a: Wall, b: Wall) => {
    const da = dirOf(a);
    const db = dirOf(b);
    const c = Math.abs(Math.abs(dot(da, db)) - 1);
    return c < angleEps;
  };

  for (const w of walls) {
    if (used.has(w.id)) continue;
    let a = w.a;
    let b = w.b;
    used.add(w.id);

    const grow = (end: "a" | "b") => {
      let guard = 0;
      while (guard++ < 40) {
        const tip = end === "a" ? a : b;
        const others = (byVertex.get(keyPt(snapToGrid(tip))) ?? []).filter(
          (x) => !used.has(x.id),
        );
        const match = others.find((o) => collinear(w, o) && dist(o.a, o.b) > MIN_WALL);
        if (!match) break;
        used.add(match.id);
        const otherEnd = nearly(snapToGrid(match.a), snapToGrid(tip), 0.05)
          ? match.b
          : match.a;
        if (end === "a") a = otherEnd;
        else b = otherEnd;
      }
    };
    grow("a");
    grow("b");
    out.push({ id: w.id, a, b });
  }
  return out.filter((w) => dist(w.a, w.b) >= MIN_WALL);
}

export function wallAtPoint(
  p: Pt,
  walls: Wall[],
  radius: number,
): { wall: Wall; proj: ReturnType<typeof projectOnSegment> } | null {
  let best: { wall: Wall; proj: ReturnType<typeof projectOnSegment> } | null =
    null;
  for (const wall of walls) {
    const proj = projectOnSegment(p, wall.a, wall.b);
    if (proj.dist < radius && (!best || proj.dist < best.proj.dist)) {
      best = { wall, proj };
    }
  }
  return best;
}

const MOVE_EPS = 0.12;

/** Stretch one wall to `newLength` and slide the connected facade so rooms stay closed. */
export function stretchWallLength(
  walls: Wall[],
  wallId: string,
  newLength: number,
): Wall[] | null {
  const wall = walls.find((w) => w.id === wallId);
  if (!wall) return null;
  const oldLen = dist(wall.a, wall.b);
  if (oldLen < 1e-6) return null;
  const clamped = Math.max(MIN_WALL, Math.min(200, newLength));
  if (Math.abs(clamped - oldLen) < 0.005) return walls;

  const dx = wall.b.x - wall.a.x;
  const dy = wall.b.y - wall.a.y;
  const orthoH = Math.abs(dy) < 0.15;
  const orthoV = Math.abs(dx) < 0.15;

  let from: Pt;
  let to: Pt;
  if (orthoH) {
    from = wall.a.x <= wall.b.x ? wall.a : wall.b;
    to = wall.a.x <= wall.b.x ? wall.b : wall.a;
  } else if (orthoV) {
    from = wall.a.y <= wall.b.y ? wall.a : wall.b;
    to = wall.a.y <= wall.b.y ? wall.b : wall.a;
  } else {
    from = wall.a;
    to = wall.b;
  }

  const dir = norm(sub(to, from));
  const newTo = snapToGrid({
    x: from.x + dir.x * clamped,
    y: from.y + dir.y * clamped,
  });
  const delta = sub(newTo, to);
  if (len(delta) < 1e-6) return walls;

  const matchesMoving = (p: Pt) => {
    if (orthoH) return Math.abs(p.x - to.x) < MOVE_EPS;
    if (orthoV) return Math.abs(p.y - to.y) < MOVE_EPS;
    return dist(p, to) < MOVE_EPS;
  };

  return walls.map((w) => {
    const a = matchesMoving(w.a) ? snapToGrid(add(w.a, delta)) : w.a;
    const b = matchesMoving(w.b) ? snapToGrid(add(w.b, delta)) : w.b;
    if (a === w.a && b === w.b) return w;
    return { ...w, a, b };
  });
}

export function remapOpeningT(
  oldWall: Wall,
  newWall: Wall,
  t: number,
): number {
  const oldLen = dist(oldWall.a, oldWall.b);
  const newLen = dist(newWall.a, newWall.b);
  if (oldLen < 1e-6 || newLen < 1e-6) return t;
  const aMoved = dist(oldWall.a, newWall.a) > 0.02;
  const bMoved = dist(oldWall.b, newWall.b) > 0.02;
  if (aMoved === bMoved) return t;
  if (bMoved) return Math.max(0.05, Math.min(0.95, (t * oldLen) / newLen));
  const fromB = (1 - t) * oldLen;
  return Math.max(0.05, Math.min(0.95, 1 - fromB / newLen));
}

export function rectWalls(origin: Pt, w: number, h: number): Wall[] {
  const o = snapToGrid(origin);
  const width = Math.max(MIN_WALL, w);
  const depth = Math.max(MIN_WALL, h);
  const a = o;
  const b = snapToGrid({ x: o.x + width, y: o.y });
  const c = snapToGrid({ x: o.x + width, y: o.y + depth });
  const d = snapToGrid({ x: o.x, y: o.y + depth });
  return [
    { id: "tmp-a", a, b },
    { id: "tmp-b", a: b, b: c },
    { id: "tmp-c", a: c, b: d },
    { id: "tmp-d", a: d, b: a },
  ];
}

export type DimAnchor = { wall: Wall; point: Pt };

export function exteriorSign(wall: Wall, walls: Wall[]): number {
  const box = boundsOf(walls);
  if (!box) return 1;
  const n = wallNormal(wall);
  const mid = midpoint(wall.a, wall.b);
  const toOut = { x: mid.x - (box.minX + box.maxX) / 2, y: mid.y - (box.minY + box.maxY) / 2 };
  return n.x * toOut.x + n.y * toOut.y < 0 ? -1 : 1;
}

export function dimensionAnchors(walls: Wall[]): DimAnchor[] {
  const box = boundsOf(walls);
  if (!box) return [];
  const eps = 0.08;
  const out: DimAnchor[] = [];
  for (const wall of walls) {
    const on =
      (Math.abs(wall.a.x - box.minX) < eps && Math.abs(wall.b.x - box.minX) < eps) ||
      (Math.abs(wall.a.x - box.maxX) < eps && Math.abs(wall.b.x - box.maxX) < eps) ||
      (Math.abs(wall.a.y - box.minY) < eps && Math.abs(wall.b.y - box.minY) < eps) ||
      (Math.abs(wall.a.y - box.maxY) < eps && Math.abs(wall.b.y - box.maxY) < eps);
    if (!on) continue;
    const L = wallLength(wall);
    if (L < 2) continue;
    const n = wallNormal(wall);
    const mid = midpoint(wall.a, wall.b);
    const sign = exteriorSign(wall, walls);
    const offset = (1.95 + WALL_THICKNESS) * sign;
    out.push({
      wall,
      point: { x: mid.x + n.x * offset, y: mid.y + n.y * offset },
    });
  }
  return out;
}

export function distToSeg(p: Pt, a: Pt, b: Pt): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-9) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2));
  return dist(p, { x: a.x + abx * t, y: a.y + aby * t });
}

export function hitDimension(p: Pt, walls: Wall[], radius: number): Wall | null {
  let best: Wall | null = null;
  let bestD = radius;
  for (const d of dimensionAnchors(walls)) {
    const mid = midpoint(d.wall.a, d.wall.b);
    const ox = d.point.x - mid.x;
    const oy = d.point.y - mid.y;
    const a = { x: d.wall.a.x + ox, y: d.wall.a.y + oy };
    const b = { x: d.wall.b.x + ox, y: d.wall.b.y + oy };
    const dd = Math.min(distToSeg(p, a, b), dist(p, d.point));
    if (dd < bestD) {
      bestD = dd;
      best = d.wall;
    }
  }
  return best;
}

