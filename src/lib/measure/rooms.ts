import { uid } from "@/lib/measure/uid";
import {
  dist,
  keyPt,
  lerp,
  polygonArea,
  polygonCentroid,
  snapToGrid,
  wallNormal,
} from "./geometry";
import type { Label, Opening, Pt, Room, Wall } from "./types";

type Half = { to: string; wallId: string; angle: number };

export function detectRooms(walls: Wall[], labels: Label[]): Room[] {
  const vertexMap = new Map<string, Pt>();
  const adj = new Map<string, Half[]>();

  const node = (p: Pt) => {
    const k = keyPt(snapToGrid(p), 2);
    if (!vertexMap.has(k)) vertexMap.set(k, snapToGrid(p));
    return k;
  };

  for (const w of walls) {
    if (dist(w.a, w.b) < 0.4) continue;
    const ka = node(w.a);
    const kb = node(w.b);
    if (ka === kb) continue;
    const a = vertexMap.get(ka)!;
    const b = vertexMap.get(kb)!;
    const angAB = Math.atan2(b.y - a.y, b.x - a.x);
    const angBA = Math.atan2(a.y - b.y, a.x - b.x);
    const la = adj.get(ka) ?? [];
    la.push({ to: kb, wallId: w.id, angle: angAB });
    adj.set(ka, la);
    const lb = adj.get(kb) ?? [];
    lb.push({ to: ka, wallId: w.id, angle: angBA });
    adj.set(kb, lb);
  }

  for (const [, list] of adj) {
    list.sort((a, b) => a.angle - b.angle);
  }

  const used = new Set<string>();
  const rooms: Room[] = [];
  let largestAbs = 0;
  let largestIndex = -1;

  const halfKey = (from: string, to: string) => `${from}>${to}`;

  for (const [from, list] of adj) {
    for (const h of list) {
      const startKey = halfKey(from, h.to);
      if (used.has(startKey)) continue;

      const polyKeys: string[] = [from];
      let curr = from;
      let next = h.to;
      let guard = 0;
      let ok = true;
      while (guard++ < 80) {
        const hk = halfKey(curr, next);
        if (used.has(hk) && polyKeys.length > 1) {
          ok = false;
          break;
        }
        used.add(hk);
        if (next === from) break;
        polyKeys.push(next);
        const edges = adj.get(next);
        if (!edges || edges.length === 0) {
          ok = false;
          break;
        }
        const incoming = Math.atan2(
          vertexMap.get(curr)!.y - vertexMap.get(next)!.y,
          vertexMap.get(curr)!.x - vertexMap.get(next)!.x,
        );
        let idx = edges.findIndex((e) => Math.abs(e.angle - incoming) < 1e-6);
        if (idx < 0) {
          let best = 0;
          let bestDelta = Infinity;
          edges.forEach((e, i) => {
            let d = e.angle - incoming;
            while (d < 0) d += Math.PI * 2;
            if (d < bestDelta) {
              bestDelta = d;
              best = i;
            }
          });
          idx = best;
        }
        const pick = edges[(idx - 1 + edges.length) % edges.length];
        if (!pick) {
          ok = false;
          break;
        }
        curr = next;
        next = pick.to;
      }

      if (!ok || polyKeys.length < 3) continue;
      const polygon = polyKeys
        .map((k) => vertexMap.get(k))
        .filter((p): p is Pt => !!p);
      if (polygon.length < 3) continue;
      const area = polygonArea(polygon);
      const abs = Math.abs(area);
      if (abs < 4) continue;
      const centroid = polygonCentroid(polygon);
      const room: Room = {
        id: uid("r"),
        polygon,
        centroid,
        area: abs,
      };
      if (abs > largestAbs) {
        largestAbs = abs;
        largestIndex = rooms.length;
      }
      rooms.push(room);
    }
  }

  const interiors = rooms.filter((_, i) => i !== largestIndex || rooms.length === 1);
  // Prefer counterclockwise (positive area) interior faces; drop huge outer wrap.
  const filtered = interiors.filter((r) => r.area < largestAbs * 0.98 || rooms.length === 1);

  for (const room of filtered) {
    const hit = labels.find((l) => pointInRoom(l, room));
    if (hit) room.name = hit.text;
  }
  return filtered.sort((a, b) => b.area - a.area);
}

function pointInRoom(p: { x: number; y: number }, room: Room): boolean {
  const poly = room.polygon;
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

export function roomAtPoint(p: Pt, rooms: Room[]): Room | null {
  let best: Room | null = null;
  for (const r of rooms) {
    if (pointInRoom(p, r) && (!best || r.area < best.area)) best = r;
  }
  return best;
}

export function openingTouchesRoom(o: Opening, wall: Wall, room: Room): boolean {
  const center = lerp(wall.a, wall.b, o.t);
  const n = wallNormal(wall);
  const a = { x: center.x + n.x * 0.7, y: center.y + n.y * 0.7 };
  const b = { x: center.x - n.x * 0.7, y: center.y - n.y * 0.7 };
  return pointInRoom(center, room) || pointInRoom(a, room) || pointInRoom(b, room);
}

export function nextRoomName(text: string, labels: Label[]): string {
  const raw = text.trim() || "Room";
  const base = raw.replace(/\s+\d+$/, "");
  const used = labels
    .map((l) => l.text)
    .filter((t) => t === base || t.startsWith(`${base} `));
  if (used.length === 0) return raw;
  return `${base} ${used.length + 1}`;
}
