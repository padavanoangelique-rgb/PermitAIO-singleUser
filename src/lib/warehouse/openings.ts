export type OpeningLine = {
  key: string;
  number: string;
  location: string;
  type: string;
  width: string;
  height: string;
  productApproval: string;
  manufacturer: string;
  series: string;
};

type RawWindow = {
  id?: string | number;
  location?: string | null;
  type?: string | null;
  width?: number | string | null;
  height?: number | string | null;
  productApproval?: string | null;
  manufacturer?: string | null;
  series?: string | null;
};

function txt(v: unknown) {
  if (v == null) return "";
  return String(v).trim();
}

export function openingsFromPlan(plan: unknown): OpeningLine[] {
  if (!plan || typeof plan !== "object") return [];
  const windows = (plan as { windows?: RawWindow[] }).windows ?? [];
  return windows.map((w, i) => {
    const number = txt(w.id) || String(i + 1);
    return {
      key: `w-${number}`,
      number,
      location: txt(w.location) || "—",
      type: txt(w.type),
      width: txt(w.width),
      height: txt(w.height),
      productApproval: txt(w.productApproval),
      manufacturer: txt(w.manufacturer),
      series: txt(w.series),
    };
  });
}

export function manualOpenings(windows: number, doors: number): OpeningLine[] {
  const lines: OpeningLine[] = [];
  const w = Math.max(0, Math.floor(windows) || 0);
  const d = Math.max(0, Math.floor(doors) || 0);
  for (let i = 1; i <= w; i++) {
    lines.push({
      key: `mw-${i}`,
      number: String(i),
      location: "Received",
      type: "Window",
      width: "",
      height: "",
      productApproval: "",
      manufacturer: "",
      series: "",
    });
  }
  for (let i = 1; i <= d; i++) {
    lines.push({
      key: `md-${i}`,
      number: String(w + i),
      location: "Received",
      type: "Door",
      width: "",
      height: "",
      productApproval: "",
      manufacturer: "",
      series: "",
    });
  }
  return lines;
}

export function openingsForJob(plan: unknown, manualWindows = 0, manualDoors = 0): OpeningLine[] {
  const fromPlan = openingsFromPlan(plan);
  if (fromPlan.length) return fromPlan;
  return manualOpenings(manualWindows, manualDoors);
}
