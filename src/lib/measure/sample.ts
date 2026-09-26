import { uid } from "@/lib/measure/uid";
import { nextMark } from "./schedule";
import type { Label, Opening, Plan, Wall } from "./types";

function W(x1: number, y1: number, x2: number, y2: number): Wall {
  return { id: uid("w"), a: { x: x1, y: y1 }, b: { x: x2, y: y2 } };
}

export function createEmptyPlan(name = "New measure"): Plan {
  return {
    id: uid("plan"),
    name,
    jobNumber: "",
    address: "",
    walls: [],
    openings: [],
    labels: [],
    furniture: [],
    annotations: [],
    updatedAt: Date.now(),
  };
}

function O(
  wallId: string,
  t: number,
  width: number,
  height: number,
  type: Opening["type"],
  mark: string,
  config: string,
  room: string,
  flip = false,
): Opening {
  return {
    id: uid("o"),
    wallId,
    t,
    width,
    height,
    type,
    flip,
    mark,
    config,
    room,
    notes: "",
  };
}

/** A compact 1-bed used as the sample measure. */
export function createSamplePlan(): Plan {
  const north = W(0, 0, 30, 0);
  const east = W(30, 0, 30, 22);
  const south = W(30, 22, 0, 22);
  const west = W(0, 22, 0, 0);
  const partition = W(18, 0, 18, 22);
  const livingKitchen = W(0, 13, 18, 13);
  const bathWall = W(10, 13, 10, 22);

  const walls: Wall[] = [north, east, south, west, partition, livingKitchen, bathWall];

  const openings: Opening[] = [];
  const add = (o: Opening) => openings.push({ ...o, mark: o.mark || nextMark(openings) });

  add(O(south.id, 0.83, 3, 6.67, "door", "A", "Entry X", "Living", true));
  add(O(livingKitchen.id, 0.28, 2.67, 6.67, "door", "B", "Entry X", "Kitchen"));
  add(O(partition.id, 0.28, 2.67, 6.67, "door", "C", "Entry X", "Bedroom"));
  add(O(bathWall.id, 0.48, 2.5, 6.67, "door", "D", "Entry X", "Bath", true));
  add(O(north.id, 0.28, 5, 5, "window", "E", "SH", "Living"));
  add(O(north.id, 0.8, 4, 5, "window", "F", "SH", "Bedroom"));
  add(O(west.id, 0.7, 4, 4.5, "window", "G", "HS XO", "Kitchen"));
  add(O(east.id, 0.32, 4, 5, "window", "H", "SH", "Bedroom"));
  add(O(south.id, 0.55, 3, 4, "window", "J", "Fixed", "Living"));

  const labels: Label[] = [
    { id: uid("l"), x: 9, y: 6.4, text: "Living" },
    { id: uid("l"), x: 5, y: 17.4, text: "Kitchen" },
    { id: uid("l"), x: 14, y: 17.4, text: "Bath" },
    { id: uid("l"), x: 24, y: 11, text: "Bedroom" },
  ];

  return {
    id: uid("plan"),
    name: "Sample measure",
    jobNumber: "1042",
    address: "812 Palmetto Ave, Lake Worth",
    walls,
    openings,
    labels,
    furniture: [],
    annotations: [],
    updatedAt: Date.now(),
  };
}

/** Exterior envelope from the live Permit Builder (L-plan, numbered openings). */
export function createBuilderPlan(): Plan {
  const Wmain = 33 + 1 / 12;
  const Hmain = 42 + 4 / 12;
  const bumpW = 14 + 9 / 12;
  const bumpH = 4 + 7 / 12;
  const Wtot = Wmain + bumpW;
  const Htot = Hmain + bumpH;

  const north = W(0, 0, Wtot, 0);
  const east = W(Wtot, 0, Wtot, Htot);
  const southBump = W(Wtot, Htot, Wmain, Htot);
  const westBump = W(Wmain, Htot, Wmain, Hmain);
  const southMain = W(Wmain, Hmain, 0, Hmain);
  const west = W(0, Hmain, 0, 0);

  const walls: Wall[] = [north, east, southBump, westBump, southMain, west];
  const openings: Opening[] = [];
  const add = (o: Opening) => openings.push(o);

  add(O(southMain.id, 0.22, 3, 5.25, "window", "1", "SH", "", true));
  add(O(southMain.id, 0.48, 3, 5.25, "window", "2", "SH", "", true));
  add(O(north.id, 0.22, 4, 5.25, "window", "3", "SH", "", true));
  add(O(north.id, 0.48, 3, 5.25, "window", "4", "SH", "", true));
  add(O(north.id, 0.72, 3, 5.25, "window", "5", "SH", "", true));
  add(O(east.id, 0.22, 3, 5.25, "window", "6", "SH", "", true));
  add(O(east.id, 0.48, 3, 5.25, "window", "7", "SH", "", true));
  add(O(east.id, 0.78, 3, 5.25, "window", "8", "SH", "", true));

  return {
    id: uid("plan"),
    name: "Permit builder",
    jobNumber: "1042",
    address: "Miami-Dade County",
    walls,
    openings,
    labels: [],
    furniture: [],
    annotations: [],
    updatedAt: Date.now(),
  };
}
