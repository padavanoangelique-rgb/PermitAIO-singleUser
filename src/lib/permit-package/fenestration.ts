export interface FenestrationAsset {
  fileName: string;
  bytes: Uint8Array;
}

const CHART_BY_KEY: Record<string, { file: string; zipName: string } | undefined> = {
  schedule: { file: "broward-fenestration-chart.pdf", zipName: "Broward County Fenestration Chart.pdf" },
  boca: { file: "palm-beach-fenestration-chart.pdf", zipName: "Palm Beach County Fenestration Chart.pdf" },
  martin: { file: "broward-fenestration-chart.pdf", zipName: "Broward County Fenestration Chart.pdf" },
  irc: { file: "broward-fenestration-chart.pdf", zipName: "Broward County Fenestration Chart.pdf" },
  miami: { file: "miami-dade-fenestration-chart.pdf", zipName: "Miami-Dade County Fenestration Chart.pdf" },
  pbc: { file: "palm-beach-fenestration-chart.pdf", zipName: "Palm Beach County Fenestration Chart.pdf" },
  wellington: { file: "palm-beach-fenestration-chart.pdf", zipName: "Village of Wellington Fenestration Chart.pdf" },
};

export async function loadFenestrationChart(jurisdictionKey: string): Promise<FenestrationAsset | null> {
  const entry = CHART_BY_KEY[jurisdictionKey] ?? CHART_BY_KEY.schedule;
  if (!entry) return null;
  try {
    const resp = await fetch(`/fenestration/${entry.file}`, { cache: "force-cache" });
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    return { fileName: entry.zipName, bytes: new Uint8Array(buf) };
  } catch {
    return null;
  }
}
