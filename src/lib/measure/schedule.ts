import { formatFeet, formatInches, inchesOf } from "./geometry";
import type { Opening, OpeningType, Plan } from "./types";

export function nextMark(openings: Opening[]): string {
  const used = new Set(openings.map((o) => o.mark));
  let n = 1;
  while (used.has(String(n))) n += 1;
  return String(n);
}

export function renumberOpenings(openings: Opening[]): Opening[] {
  const needs = openings.some((o) => !/^\d+$/.test(o.mark || ""));
  if (!needs) return openings;
  return openings.map((o, i) => ({ ...o, mark: String(i + 1) }));
}

export function defaultConfig(type: OpeningType): string {
  return type === "door" ? "Entry X" : "SH";
}

export function openingUnit(type: OpeningType): "feet" | "inches" {
  return type === "window" ? "inches" : "feet";
}

export function openingSizeLabel(o: Opening): string {
  if (o.type === "window") {
    return `${formatInches(o.width)} × ${formatInches(o.height)}`;
  }
  return `${formatFeet(o.width)} × ${formatFeet(o.height)}`;
}

export function scheduleRows(plan: Plan) {
  return [...plan.openings].sort((a, b) => a.mark.localeCompare(b.mark, undefined, { numeric: true }));
}

export function scheduleCsv(plan: Plan): string {
  const header = ["Mark", "Type", "Config", "Width", "Height", "Room", "Notes"];
  const lines = [header.join(",")];
  for (const o of scheduleRows(plan)) {
    const width = o.type === "window" ? formatInches(o.width) : formatFeet(o.width);
    const height = o.type === "window" ? formatInches(o.height) : formatFeet(o.height);
    const cells = [o.mark, o.type, o.config, width, height, o.room, o.notes].map(csvCell);
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function migrateOpening(o: Opening, index: number, all: Opening[]): Opening {
  return {
    ...o,
    height: o.height ?? (o.type === "door" ? 6.67 : 5),
    mark: o.mark || nextMark(all.slice(0, index)),
    config: o.config || defaultConfig(o.type),
    room: o.room ?? "",
    notes: o.notes ?? "",
  };
}

export function openingInches(o: Opening): { widthIn: number; heightIn: number } {
  return { widthIn: inchesOf(o.width), heightIn: inchesOf(o.height) };
}