type PinJob = {
  id: string;
  job_number: string;
  client_name: string;
  city: string | null;
  address: string | null;
  pmChecked?: boolean;
};

const BOX = { minLat: 26.28, maxLat: 26.9, minLng: -80.42, maxLng: -79.98 };

const CITIES: { name: string; lat: number; lng: number }[] = [
  { name: "Palm Beach Gardens", lat: 26.82, lng: -80.14 },
  { name: "West Palm", lat: 26.72, lng: -80.05 },
  { name: "West Palm Beach", lat: 26.72, lng: -80.05 },
  { name: "Wellington", lat: 26.66, lng: -80.27 },
  { name: "Loxahatchee", lat: 26.69, lng: -80.3 },
  { name: "Lake Worth", lat: 26.62, lng: -80.07 },
  { name: "Boynton", lat: 26.53, lng: -80.08 },
  { name: "Boynton Beach", lat: 26.53, lng: -80.08 },
  { name: "Delray", lat: 26.46, lng: -80.07 },
  { name: "Delray Beach", lat: 26.46, lng: -80.07 },
  { name: "Boca", lat: 26.37, lng: -80.13 },
  { name: "Boca Raton", lat: 26.37, lng: -80.13 },
  { name: "Palm Beach", lat: 26.68, lng: -80.04 },
];

function project(lat: number, lng: number) {
  const x = ((lng - BOX.minLng) / (BOX.maxLng - BOX.minLng)) * 100;
  const y = ((BOX.maxLat - lat) / (BOX.maxLat - BOX.minLat)) * 100;
  return { x: Math.min(96, Math.max(4, x)), y: Math.min(94, Math.max(6, y)) };
}

function cityOf(job: { city: string | null; address: string | null }) {
  const raw = (job.city || job.address || "").toLowerCase();
  return CITIES.find((c) => raw.includes(c.name.toLowerCase())) ?? null;
}

export function jobLat(job: { city: string | null; address: string | null }) {
  return cityOf(job)?.lat ?? 26.5;
}

function pinOf(job: PinJob, index: number) {
  const city = cityOf(job);
  const lat = (city?.lat ?? 26.55) + (index % 5) * 0.012 - 0.02;
  const lng = (city?.lng ?? -80.12) + (index % 3) * 0.018 - 0.018;
  return { ...project(lat, lng), city: city?.name || job.city || "" };
}

export function InstallMap({
  jobs,
  onOpen,
}: {
  jobs: PinJob[];
  onOpen?: (jobId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-heading text-3xl">Map</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Blue pins are jobs where the project manager has checked in. Dark pins are still waiting. Tap a pin to open the job.
        </p>
      </header>
      <div className="overflow-hidden rounded-2xl bg-muted/30">
        <div className="relative aspect-[16/9]">
          <svg viewBox="0 0 100 56" className="h-full w-full" aria-hidden>
            <text x="8" y="10" fontSize="2.2" className="fill-muted-foreground" opacity="0.5">
              PALM BEACH · BROWARD
            </text>
            {CITIES.filter((c, i, arr) => arr.findIndex((x) => x.lat === c.lat && x.lng === c.lng) === i).map((c) => {
              const p = project(c.lat, c.lng);
              return (
                <text key={c.name} x={p.x} y={p.y + 6} fontSize="2" textAnchor="middle" className="fill-muted-foreground" opacity="0.45">
                  {c.name.split(" ")[0].toUpperCase()}
                </text>
              );
            })}
            {jobs.map((job, i) => {
              const p = pinOf(job, i);
              const short = job.job_number.replace(/-\d+$/, "").slice(-3);
              return (
                <g key={job.id} className="cursor-pointer" onClick={() => onOpen?.(job.id)}>
                  <circle cx={p.x} cy={p.y} r="3.2" className={job.pmChecked ? "fill-primary" : "fill-foreground"} />
                  <text x={p.x} y={p.y + 0.8} textAnchor="middle" fontSize="2.1" className={job.pmChecked ? "fill-primary-foreground" : "fill-background"}>
                    {job.pmChecked ? "PM" : short}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {jobs.map((job) => (
          <li key={job.id}>
            <button
              type="button"
              onClick={() => onOpen?.(job.id)}
              className="flex w-full items-center gap-2 rounded-2xl px-2 py-2 text-left text-sm hover:bg-muted/40"
            >
              <span className="inline-flex h-8 min-w-[5.5rem] items-center justify-center rounded-full bg-primary px-2 text-sm font-semibold tabular-nums text-primary-foreground">{job.job_number}</span>
              <span className="inline-flex h-8 min-w-0 items-center truncate rounded-full bg-violet-600 px-3 text-sm font-semibold text-white">{job.client_name}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{job.city || ""}</span>
              <span className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold ${job.pmChecked ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}>
                {job.pmChecked ? "PM in" : "Waiting"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
