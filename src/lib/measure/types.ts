export type Pt = { x: number; y: number };

export type Tool =
  | "draw"
  | "door"
  | "window"
  | "size"
  | "erase"
  | "select"
  | "label"
  | "furnish"
  | "schedule";

export type FurnitureKind =
  | "bed"
  | "sofa"
  | "table"
  | "desk"
  | "chair"
  | "toilet"
  | "sink"
  | "shower"
  | "tub"
  | "fridge"
  | "stove"
  | "nightstand";

export type OpeningType = "door" | "window";

export type Wall = {
  id: string;
  a: Pt;
  b: Pt;
};

export type Opening = {
  id: string;
  wallId: string;
  /** Center of the opening along the wall, 0–1. */
  t: number;
  width: number;
  height: number;
  type: OpeningType;
  /** Flip hinge / swing to the other side of the wall. */
  flip: boolean;
  /** Schedule mark: 1, 2, 3… */
  mark: string;
  config: string;
  room: string;
  notes: string;
};

export type Label = {
  id: string;
  x: number;
  y: number;
  text: string;
};

export type Furniture = {
  id: string;
  kind: FurnitureKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
};

export type Annotation = {
  id: string;
  points: Pt[];
};

export type Camera = {
  panX: number;
  panY: number;
  zoom: number;
};

export type Plan = {
  id: string;
  name: string;
  jobNumber: string;
  address: string;
  walls: Wall[];
  openings: Opening[];
  labels: Label[];
  furniture: Furniture[];
  annotations: Annotation[];
  updatedAt: number;
};

export type Selection =
  | { kind: "wall"; id: string }
  | { kind: "opening"; id: string }
  | { kind: "furniture"; id: string }
  | { kind: "label"; id: string }
  | { kind: "vertex"; wallId: string; end: "a" | "b" }
  | null;

export type Room = {
  id: string;
  polygon: Pt[];
  centroid: Pt;
  area: number;
  name?: string;
};

export const FURNITURE_DEFAULTS: Record<
  FurnitureKind,
  { w: number; h: number; label: string }
> = {
  bed: { w: 6.5, h: 5, label: "Bed" },
  sofa: { w: 7, h: 3, label: "Sofa" },
  table: { w: 5, h: 3, label: "Table" },
  desk: { w: 4.5, h: 2.2, label: "Desk" },
  chair: { w: 1.8, h: 1.8, label: "Chair" },
  toilet: { w: 1.6, h: 2.4, label: "Toilet" },
  sink: { w: 2.2, h: 1.6, label: "Sink" },
  shower: { w: 3.2, h: 3.2, label: "Shower" },
  tub: { w: 5, h: 2.6, label: "Tub" },
  fridge: { w: 3, h: 2.6, label: "Fridge" },
  stove: { w: 2.6, h: 2.6, label: "Stove" },
  nightstand: { w: 2, h: 1.8, label: "Nightstand" },
};

export const WINDOW_CONFIGS = [
  "SH",
  "HS XO",
  "HS OX",
  "Fixed",
  "Casement",
  "Picture",
  "Awning",
  "SGD",
] as const;

export const DOOR_CONFIGS = [
  "Entry X",
  "Entry XX",
  "SGD XO",
  "SGD OX",
  "Outswing",
  "Inswing",
] as const;

export const ROOM_STAMPS = [
  "Living",
  "Kitchen",
  "Dining",
  "Bedroom",
  "Bath",
  "Laundry",
  "Closet",
  "Garage",
  "Office",
  "Hall",
] as const;

export const WALL_THICKNESS = 0.42;
export const DOOR_WIDTH = 2.67;
export const DOOR_HEIGHT = 6.67;
export const WINDOW_WIDTH = 3;
export const WINDOW_HEIGHT = 5;
export const MIN_WALL = 0.6;
export const PX_PER_FOOT = 28;
export const GRID = 1;
export const SNAP_GRID = 0.5;
