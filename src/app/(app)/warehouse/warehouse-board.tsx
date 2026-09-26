"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { OpeningLine } from "@/lib/warehouse/openings";
import { Badge } from "@/components/ui/badge";
import { permitIsApproved } from "@/lib/warehouse/permit";
import { saveBrokenOpening, setManualWarehouseCounts, toggleWarehouseOpening } from "./actions";
import { FILL_AMBER, FILL_GREEN } from "@/lib/ui/fills";
import { BTN_BLUE, FIELD, JOB_BTN, LOOKUP, NAME_PILL, TAP_BLUE, TAP_GREEN } from "@/lib/ui/chrome";

export type WarehouseCheckin = {
  opening_key: string;
  received_at: string | null;
  received_by: string | null;
  broken: boolean;
  note: string | null;
  photo_path: string | null;
  photo_name: string | null;
};

export type WarehouseJobRow = {
  id: string;
  job_number: string;
  client_name: string;
  address: string | null;
  city: string | null;
  permit_number: string | null;
  sub_status: string;
  permit_tech: string;
  ready: boolean;
  hasFloorPlan: boolean;
  manualWindows: number;
  manualDoors: number;
  openings: OpeningLine[];
  checkins: WarehouseCheckin[];
};

export function WarehouseBoard({
  job,
  lookup,
  notFound,
  mail,
  tableNote,
}: {
  job: WarehouseJobRow | null;
  lookup: string;
  notFound: boolean;
  mail?: string;
  tableNote?: string;
}) {
  const byKey = new Map((job?.checkins ?? []).map((c) => [c.opening_key, c]));
  const inCount = job ? job.openings.filter((o) => byKey.get(o.key)?.received_at).length : 0;
  const broken = job ? job.openings.filter((o) => byKey.get(o.key)?.broken).length : 0;
  const approved = job ? permitIsApproved(job.sub_status) : false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Warehouse</h1>
        <p className="text-sm text-muted-foreground">Type a job number. The list populates from the floor plan, or enter how many windows and doors arrived.</p>
      </div>

      {mail ? <p className="text-sm text-emerald-700">{mail}</p> : null}
      {tableNote ? <p className="text-sm text-amber-700">{tableNote}</p> : null}

      <form method="get" action="/warehouse" className={LOOKUP}>
        <label className="text-sm font-medium">
          Job number
          <input
            name="job"
            defaultValue={lookup}
            autoFocus
            autoComplete="off"
            placeholder="92300-1"
            className={`${FIELD} min-w-[220px] font-mono text-base`}
          />
        </label>
        <button className={TAP_BLUE} type="submit">
          Pull job
        </button>
        {job ? (
          <a href="/warehouse" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-2 hover:underline">
            Clear
          </a>
        ) : null}
      </form>

      {notFound ? (
        <p className="text-sm text-amber-700">No job matches “{lookup}”. Check the job number and try again.</p>
      ) : null}

      {!job && !notFound ? (
        <p className="text-sm text-muted-foreground">Nothing on this screen until a job number is pulled.</p>
      ) : null}

      {job ? (
        <section className="space-y-4">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={JOB_BTN}>{job.job_number}</span>
                <span className={NAME_PILL}>{job.client_name}</span>
              </div>
              <p className="text-sm text-muted-foreground">{[job.address, job.city].filter(Boolean).join(", ") || "No address"}</p>
              <div className="mt-1">
                {approved ? (
                  <span className={`inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold ${FILL_GREEN}`}>
                    Permit approved
                  </span>
                ) : (
                  <span className={`inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold ${FILL_AMBER}`}>
                    Permit not approved
                  </span>
                )}
              </div>
              {!approved ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Checking product in notifies {job.permit_tech || "the permit tech"} that it arrived before the permit.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Link href={`/jobs/${job.id}/floor-plan`} className={BTN_BLUE}>
                Floor plan
              </Link>
              <a
                href={`/api/jobs/${job.id}/sticker`}
                target="_blank"
                rel="noreferrer"
                className={BTN_BLUE}
              >
                Print job sticker
              </a>
              {job.ready ? <Badge>Need to schedule</Badge> : null}
              {broken ? <Badge variant="destructive">{broken} broken</Badge> : null}
              {job.openings.length ? (
                <span className="text-muted-foreground">
                  {inCount}/{job.openings.length} in
                </span>
              ) : null}
            </div>
          </header>

          {job.hasFloorPlan ? (
            <p className="text-xs text-muted-foreground">Checklist is from the floor plan — product approval on each line.</p>
          ) : job.openings.length === 0 ? (
            <form action={setManualWarehouseCounts} className="space-y-3 px-1 py-2">
              <p className="text-sm">No floor plan on this job. Enter how many windows and doors were received.</p>
              <input type="hidden" name="jobId" value={job.id} />
              <input type="hidden" name="jobNumber" value={job.job_number} />
              <div className="flex flex-wrap gap-3">
                <label className="text-xs">
                  Windows
                  <input name="windows" type="number" min={0} defaultValue={job.manualWindows || ""} className={`${FIELD} w-24`} required />
                </label>
                <label className="text-xs">
                  Doors
                  <input name="doors" type="number" min={0} defaultValue={job.manualDoors || ""} className={`${FIELD} w-24`} required />
                </label>
                <button className={`${TAP_GREEN} self-end`} type="submit">
                  Build checklist
                </button>
              </div>
            </form>
          ) : (
            <form action={setManualWarehouseCounts} className="flex flex-wrap items-end gap-3 text-xs text-muted-foreground">
              <input type="hidden" name="jobId" value={job.id} />
              <input type="hidden" name="jobNumber" value={job.job_number} />
              <span>Manual count — {job.manualWindows} windows, {job.manualDoors} doors.</span>
              <label>
                Windows
                <input name="windows" type="number" min={0} defaultValue={job.manualWindows} className={`${FIELD} w-20`} />
              </label>
              <label>
                Doors
                <input name="doors" type="number" min={0} defaultValue={job.manualDoors} className={`${FIELD} w-20`} />
              </label>
              <button className={TAP_BLUE} type="submit">
                Update count
              </button>
            </form>
          )}

          {job.openings.length ? (
            <>
              <a
                href={`/warehouse/pdf?jobId=${job.id}`}
                className={TAP_BLUE}
              >
                Download checklist PDF
              </a>
              {/* Table stays the layout even on phone (scrolls horizontally,
                  overflow-x-auto above) rather than collapsing to cards —
                  a job's window/door list is dense, comparison-heavy data
                  (type/size/approval per opening), which a card-per-row
                  layout would just turn into a lot of vertical scrolling
                  instead. The fix that matters on a phone is a tap target
                  actually sized for a thumb: the check-in button below is
                  44x44 (was 24x24), with matching row padding. */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-2">In</th>
                      <th className="py-2 pr-2">#</th>
                      <th className="py-2 pr-2">Location</th>
                      <th className="py-2 pr-2">Type</th>
                      <th className="py-2 pr-2">W</th>
                      <th className="py-2 pr-2">H</th>
                      <th className="py-2 pr-2">Product approval</th>
                      <th className="py-2">Broken</th>
                    </tr>
                  </thead>
                  <tbody>
                    {job.openings.map((o) => {
                      const row = byKey.get(o.key);
                      return (
                        <tr key={o.key} className="border-t align-top">
                          <td className="py-3 pr-2">
                            <form action={toggleWarehouseOpening}>
                              <input type="hidden" name="jobId" value={job.id} />
                              <input type="hidden" name="jobNumber" value={job.job_number} />
                              <input type="hidden" name="clientName" value={job.client_name} />
                              <input type="hidden" name="address" value={job.address ?? ""} />
                              <input type="hidden" name="openingKey" value={o.key} />
                              <input type="hidden" name="next" value={row?.received_at ? "0" : "1"} />
                              <button
                                type="submit"
                                className={`flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold ${
                                  row?.received_at
                                    ? "bg-emerald-600 text-white"
                                    : "bg-muted text-muted-foreground"
                                }`}
                                aria-label={row?.received_at ? "Uncheck" : "Check in"}
                              >
                                {row?.received_at ? "✓" : ""}
                              </button>
                            </form>
                          </td>
                          <td className="py-3 pr-2 font-medium">{o.number}</td>
                          <td className="py-3 pr-2">{o.location}</td>
                          <td className="py-3 pr-2">{o.type || "—"}</td>
                          <td className="py-3 pr-2">{o.width || "—"}</td>
                          <td className="py-3 pr-2">{o.height || "—"}</td>
                          <td className="py-3 pr-2">{o.productApproval || "—"}</td>
                          <td className="py-3">
                            <BrokenCell
                              jobId={job.id}
                              jobNumber={job.job_number}
                              openingKey={o.key}
                              broken={!!row?.broken}
                              note={row?.note ?? ""}
                              photoName={row?.photo_name ?? ""}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function BrokenCell({
  jobId,
  jobNumber,
  openingKey,
  broken,
  note,
  photoName,
}: {
  jobId: string;
  jobNumber: string;
  openingKey: string;
  broken: boolean;
  note: string;
  photoName: string;
}) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoPath, setPhotoPath] = useState("");
  const [photoLabel, setPhotoLabel] = useState(photoName);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError("");
    const supabase = createClient();
    const safe = file.name.replace(/[^\w.\-]/g, "_");
    const path = `${jobId}/warehouse/${openingKey}-${Date.now()}-${safe}`;
    const { error: uploadError } = await supabase.storage.from("job-files").upload(path, file);
    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }
    setPhotoPath(path);
    setPhotoLabel(file.name);
    setUploading(false);
  }

  if (!open && broken) {
    return (
      <button type="button" className="text-left text-xs text-red-600 underline-offset-2 hover:underline" onClick={() => setOpen(true)}>
        Broken{note ? ` — ${note}` : ""}
        {photoName ? " · photo" : ""}
      </button>
    );
  }

  if (!open) {
    return (
      <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => setOpen(true)}>
        Flag broken
      </button>
    );
  }

  return (
    <form action={saveBrokenOpening} className="space-y-2 px-1 py-1">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="jobNumber" value={jobNumber} />
      <input type="hidden" name="openingKey" value={openingKey} />
      <input type="hidden" name="photoPath" value={photoPath} />
      <input type="hidden" name="photoName" value={photoLabel} />
      <textarea name="note" defaultValue={note} placeholder="Broken window note" className={`${FIELD} w-56`} rows={2} />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="block text-xs"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      {photoLabel ? <p className="text-xs text-muted-foreground">{uploading ? "Uploading…" : photoLabel}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <button className={TAP_BLUE} type="submit" disabled={uploading}>
          Save
        </button>
        <button className="min-h-9 px-2 text-xs text-muted-foreground" type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
