import { uid } from "@/lib/measure/uid";
import {
  collectVertices,
  dist,
  lerp,
  mergeCollinear,
  projectOnSegment,
  simplifyRdp,
  snapAngle,
  snapPoint,
  snapToGrid,
  type SnapTarget,
} from "./geometry";
import { MIN_WALL, type Opening, type Pt, type Wall } from "./types";

export type StrokeResult = {
  walls: Wall[];
  splitExisting: { wallId: string; point: Pt }[];
  closed: boolean;
};

export function strokeToWalls(
  raw: Pt[],
  existing: Wall[],
  opts: { epsilon: number; snapRadius: number; ortho: boolean },
): StrokeResult {
  const empty: StrokeResult = { walls: [], splitExisting: [], closed: false };
  if (raw.length < 2) return empty;

  const simplified = simplifyRdp(raw, opts.epsilon);
  if (simplified.length < 2) return empty;

  const first = simplified[0];
  const last = simplified[simplified.length - 1];
  if (!first || !last) return empty;

  const pathLen = simplified.reduce((s, p, i) => {
    const prev = simplified[i - 1];
    return prev ? s + dist(prev, p) : s;
  }, 0);
  if (pathLen < MIN_WALL) return empty;

  const closed = dist(first, last) < Math.max(opts.snapRadius * 1.6, 1.2) && pathLen > 6;

  const target: SnapTarget = {
    vertices: collectVertices(existing),
    walls: existing,
  };

  const stepDeg = opts.ortho ? 90 : 45;
  const points: Pt[] = [];
  const startSnap = snapPoint(first, target, opts.snapRadius);
  points.push(startSnap.point);

  const src = closed ? simplified.slice(0, -1) : simplified;
  for (let i = 1; i < src.length; i++) {
    const p = src[i];
    const prev = points[points.length - 1];
    if (!p || !prev) continue;
    const vec = snapAngle({ x: p.x - prev.x, y: p.y - prev.y }, stepDeg);
    let next = { x: prev.x + vec.x, y: prev.y + vec.y };
    const snapped = snapPoint(next, target, opts.snapRadius);
    next = snapped.point;
    if (dist(prev, next) < MIN_WALL * 0.45) continue;
    points.push(next);
  }

  if (closed) {
    const origin = points[0];
    const tip = points[points.length - 1];
    if (origin && tip && dist(tip, origin) > MIN_WALL * 0.3) {
      const aligned =
        Math.abs(tip.x - origin.x) < opts.snapRadius ||
        Math.abs(tip.y - origin.y) < opts.snapRadius;
      if (aligned) {
        points.push(origin);
      } else {
        const prev = points[points.length - 2] ?? tip;
        const incomingHoriz = Math.abs(tip.y - prev.y) < Math.abs(tip.x - prev.x);
        const corner = incomingHoriz
          ? { x: origin.x, y: tip.y }
          : { x: tip.x, y: origin.y };
        points.push(snapToGrid(corner));
        points.push(origin);
      }
    } else if (origin && tip) {
      points[points.length - 1] = origin;
    }
  }

  const walls: Wall[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    if (dist(a, b) < MIN_WALL) continue;
    walls.push({ id: uid("w"), a, b });
  }

  if (walls.length === 0 && pathLen >= MIN_WALL) {
    const a = snapPoint(first, target, opts.snapRadius).point;
    const vec = snapAngle({ x: last.x - first.x, y: last.y - first.y }, stepDeg);
    const b = snapPoint({ x: a.x + vec.x, y: a.y + vec.y }, target, opts.snapRadius)
      .point;
    if (dist(a, b) >= MIN_WALL) walls.push({ id: uid("w"), a, b });
  }

  const splitExisting: { wallId: string; point: Pt }[] = [];
  const seen = new Set<string>();
  const consider = (pt: Pt) => {
    for (const w of existing) {
      const proj = projectOnSegment(pt, w.a, w.b);
      if (proj.clamped) continue;
      if (proj.t < 0.08 || proj.t > 0.92) continue;
      if (proj.dist > opts.snapRadius) continue;
      const k = `${w.id}:${proj.point.x.toFixed(2)},${proj.point.y.toFixed(2)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      splitExisting.push({ wallId: w.id, point: snapToGrid(proj.point) });
    }
  };
  for (const w of walls) {
    consider(w.a);
    consider(w.b);
  }

  return {
    walls: mergeCollinear(walls),
    splitExisting,
    closed,
  };
}

export function splitWallAt(
  walls: Wall[],
  openings: Opening[],
  wallId: string,
  point: Pt,
): { walls: Wall[]; openings: Opening[] } {
  const wall = walls.find((w) => w.id === wallId);
  if (!wall) return { walls, openings };
  if (dist(point, wall.a) < MIN_WALL * 0.4 || dist(point, wall.b) < MIN_WALL * 0.4) {
    return { walls, openings };
  }
  const t = projectOnSegment(point, wall.a, wall.b).t;
  if (t <= 0.04 || t >= 0.96) return { walls, openings };

  const left: Wall = { id: uid("w"), a: wall.a, b: point };
  const right: Wall = { id: uid("w"), a: point, b: wall.b };
  const nextWalls = walls.flatMap((w) => (w.id === wallId ? [left, right] : [w]));
  const nextOpenings = openings.flatMap((o) => {
    if (o.wallId !== wallId) return [o];
    if (o.t < t) {
      return [{ ...o, wallId: left.id, t: t === 0 ? 0 : o.t / t }];
    }
    return [{ ...o, wallId: right.id, t: (o.t - t) / (1 - t) }];
  });
  return { walls: nextWalls, openings: nextOpenings };
}

export function applySplits(
  walls: Wall[],
  openings: Opening[],
  splits: { wallId: string; point: Pt }[],
): { walls: Wall[]; openings: Opening[] } {
  let w = walls;
  let o = openings;
  for (const s of splits) {
    const next = splitWallAt(w, o, s.wallId, s.point);
    w = next.walls;
    o = next.openings;
  }
  return { walls: w, openings: o };
}

/** Interpolate a preview polyline toward snapped walls (for the lift animation). */
export function previewStroke(raw: Pt[], walls: Wall[], t: number): Pt[] {
  if (walls.length === 0) return raw;
  const target: Pt[] = [walls[0]!.a];
  for (const w of walls) target.push(w.b);
  if (raw.length < 2 || target.length < 2) return target;
  const n = Math.max(raw.length, target.length);
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const rt = i / (n - 1);
    const a = samplePolyline(raw, rt);
    const b = samplePolyline(target, rt);
    out.push(lerp(a, b, t));
  }
  return out;
}

function samplePolyline(pts: Pt[], t: number): Pt {
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1) return pts[0]!;
  const segs: number[] = [0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += dist(pts[i - 1]!, pts[i]!);
    segs.push(total);
  }
  if (total < 1e-6) return pts[0]!;
  const d = t * total;
  for (let i = 1; i < segs.length; i++) {
    if (d <= segs[i]!) {
      const a = segs[i - 1]!;
      const b = segs[i]!;
      const local = (d - a) / (b - a || 1);
      return lerp(pts[i - 1]!, pts[i]!, local);
    }
  }
  return pts[pts.length - 1]!;
}
