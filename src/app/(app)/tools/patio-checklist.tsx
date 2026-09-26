"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { buildPatioChecklistPdf } from "@/lib/tools/patio-checklist-pdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELD = "mt-1";
const FIRST_ITEMS = [
  { key: "smoke", label: "Smoke alarm" },
  { key: "intLight", label: "Interior light" },
  { key: "extLight", label: "Exterior light" },
  { key: "switch", label: "Switch that controls both lights" },
  { key: "intOutlet", label: "Interior outlet" },
  { key: "extOutlet", label: "Exterior outlet" },
] as const;

type ItemKey = (typeof FIRST_ITEMS)[number]["key"];
type YesNo = "" | "yes" | "no";

export function PatioChecklist({ orgId }: { orgId: string }) {
  const [jobNumber, setJobNumber] = useState("");
  const [rooms, setRooms] = useState("");
  const [floor, setFloor] = useState("First floor");
  const [answers, setAnswers] = useState<Record<ItemKey, YesNo>>({
    smoke: "",
    intLight: "",
    extLight: "",
    switch: "",
    intOutlet: "",
    extOutlet: "",
  });
  const photoRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [busy, setBusy] = useState("");
  const [mail, setMail] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);

  const firstFloor = floor === "First floor";

  async function findJob() {
    const q = jobNumber.trim();
    if (!q) return null;
    const supabase = createClient();
    const exact = await supabase
      .from("jobs")
      .select("id, job_number, client_name")
      .eq("org_id", orgId)
      .eq("job_number", q)
      .maybeSingle();
    if (exact.data) return exact.data;
    const fuzzy = await supabase
      .from("jobs")
      .select("id, job_number, client_name")
      .eq("org_id", orgId)
      .ilike("job_number", `${q}%`)
      .limit(1)
      .maybeSingle();
    return fuzzy.data;
  }

  async function collectPhotos() {
    const photos: { bytes: Uint8Array; name: string; caption: string }[] = [];
    for (const item of FIRST_ITEMS) {
      const file = photoRefs.current[item.key]?.files?.[0];
      if (!file) continue;
      photos.push({
        bytes: new Uint8Array(await file.arrayBuffer()),
        name: file.name,
        caption: item.label,
      });
    }
    return photos;
  }

  async function saveToJob() {
    setBusy("Building report…");
    setMail("");
    const job = await findJob();
    if (!job) {
      setBusy("");
      setMail("Type a job number that exists in PermitAIO.");
      return;
    }
    setJobId(job.id);
    const items = firstFloor
      ? FIRST_ITEMS.map((item) => ({
          label: item.label,
          answer: answers[item.key] === "yes" ? "Yes" : answers[item.key] === "no" ? "No" : "Not answered",
        }))
      : [{ label: "First-floor electrical / smoke", answer: "Not required — patio is not first floor" }];
    const photos = firstFloor ? await collectPhotos() : [];
    const bytes = await buildPatioChecklistPdf({
      jobNumber: job.job_number,
      clientName: job.client_name,
      rooms,
      floor,
      items,
      photos,
    });
    setBusy("Saving to job…");
    const supabase = createClient();
    const path = `${job.id}/patio-checklist-${Date.now()}.pdf`;
    const { error: upErr } = await supabase.storage.from("job-files").upload(path, new Uint8Array(bytes), {
      contentType: "application/pdf",
      upsert: false,
    });
    if (upErr) {
      setBusy("");
      setMail(upErr.message);
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    const { error: insErr } = await supabase.from("job_files").insert({
      org_id: orgId,
      job_id: job.id,
      file_name: `${job.job_number}-patio-checklist.pdf`,
      storage_path: path,
      size_bytes: bytes.byteLength,
      uploaded_by: auth.user?.id ?? null,
      category: "patio-checklist",
    });
    if (insErr) {
      setBusy("");
      setMail(insErr.message);
      return;
    }
    const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${job.job_number}-patio-checklist.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    setBusy("");
    setMail(`Saved to job ${job.job_number}. Mark the same items on the floor plan.`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link href="/tools" className="text-sm text-muted-foreground hover:text-foreground">
          ← Tools
        </Link>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">Sunroom / patio checklist</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Answer the field questions, add photos, save the report to the job. Then mark each item on the floor plan.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Job</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="job">Job number</Label>
            <Input
              id="job"
              className={FIELD}
              value={jobNumber}
              onChange={(e) => setJobNumber(e.target.value)}
              placeholder="92300-1"
            />
          </div>
          <div>
            <Label htmlFor="rooms">What rooms lead out to the patio?</Label>
            <Input
              id="rooms"
              className={FIELD}
              value={rooms}
              onChange={(e) => setRooms(e.target.value)}
              placeholder="Kitchen, living, master"
            />
          </div>
          <div>
            <Label htmlFor="floor">What floor is the patio on?</Label>
            <select
              id="floor"
              className="mt-1 block h-11 w-full rounded-full border border-input bg-background px-3 text-sm"
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
            >
              <option>First floor</option>
              <option>Second floor</option>
              <option>Other</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {firstFloor ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">First floor — take a photo of each</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {FIRST_ITEMS.map((item) => (
              <div key={item.key} className="grid gap-2 border-b pb-3 last:border-0 last:pb-0 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="text-sm font-medium">{item.label}?</p>
                  <div className="mt-1 flex gap-2">
                    {(["yes", "no"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAnswers((prev) => ({ ...prev, [item.key]: v }))}
                        className={`inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold shadow-sm ${
                          answers[item.key] === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {v === "yes" ? "Yes" : "No"}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  ref={(el) => {
                    photoRefs.current[item.key] = el;
                  }}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="text-xs"
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              After you save, open the floor plan and mark smoke, lights, switch, and outlets so the permit package is complete.
            </p>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">First-floor smoke, lights, and outlets are skipped for this patio.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void saveToJob()} disabled={!!busy}>
          {busy || "Save report to job"}
        </Button>
        {jobId ? (
          <Button asChild variant="outline">
            <Link href={`/jobs/${jobId}/floor-plan`}>Mark on floor plan</Link>
          </Button>
        ) : null}
      </div>
      {mail ? <p className="text-sm text-muted-foreground">{mail}</p> : null}
    </div>
  );
}
