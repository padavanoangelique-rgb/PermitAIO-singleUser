"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Tables } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { HOA_JOB_STATUSES, NO_HOA_TECH } from "@/lib/hoa/constants";
import { useTechSlots, useTechLabel } from "@/components/tech-slots-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DateField } from "@/components/ui/date-field";
import { HoaCombobox } from "./hoa-combobox";
import { HoaModal } from "./hoa-modal";
import { PanelSkeleton } from "@/components/ui/loading-skeletons";

type Job = Tables<"jobs">;
type Hoa = Tables<"hoas">;
type HoaJob = Tables<"hoa_jobs">;

export function SingleJobHoaPanel({ job, orgName }: { job: Job; orgName: string }) {
  const { hoaTechs } = useTechSlots();
  const { hoaLabel } = useTechLabel();
  const [hoas, setHoas] = useState<Hoa[]>([]);
  const [linked, setLinked] = useState<HoaJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [newHoaId, setNewHoaId] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addHoaOpen, setAddHoaOpen] = useState(false);
  const [addHoaInitialName, setAddHoaInitialName] = useState("");
  const [hoaTech, setHoaTech] = useState(job.hoa_tech || "unassigned");

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [hoasRes, linkedRes] = await Promise.all([
      supabase.from("hoas").select("*").eq("org_id", job.org_id).order("name", { ascending: true }),
      supabase.from("hoa_jobs").select("*").eq("org_id", job.org_id).eq("job_id", job.id).maybeSingle(),
    ]);
    setHoas(hoasRes.data ?? []);
    setLinked(linkedRes.data ?? null);
    setLoading(false);
  }, [job.id, job.org_id]);
  useEffect(() => { void load(); }, [load]);

  const hoaOptions = useMemo(() => hoas.map((h) => ({ id: h.id, name: h.name, mgmt_co: h.mgmt_co })), [hoas]);
  const linkedHoa = linked ? hoas.find((h) => h.id === linked.hoa_id) ?? null : null;

  async function linkHoa() {
    if (!newHoaId) return setError("Choose an HOA first.");
    setLinking(true);
    setError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("hoa_jobs")
      .insert({
        org_id: job.org_id,
        hoa_id: newHoaId,
        job_id: job.id,
        job_number: job.job_number,
        job_name: job.client_name,
        address: job.address || "",
        status: HOA_JOB_STATUSES[0],
        assigned_to: job.hoa_tech && job.hoa_tech !== NO_HOA_TECH ? job.hoa_tech : "",
      })
      .select()
      .single();
    setLinking(false);
    if (err || !data) return setError(err?.message ?? "Couldn't link that HOA.");
    setLinked(data);
  }

  async function update(patch: Partial<Pick<HoaJob, "status" | "assigned_to" | "assigned_date" | "date_submitted" | "date_approved" | "notes">>) {
    if (!linked) return;
    const previous = linked;
    setLinked({ ...linked, ...patch });
    const supabase = createClient();
    const { error: err } = await supabase.from("hoa_jobs").update(patch).eq("id", linked.id).eq("org_id", job.org_id);
    if (err) {
      setLinked(previous);
      alert(`Couldn't save that change: ${err.message}`);
    }
  }

  async function saveHoaTech(next: string) {
    const previous = hoaTech;
    const value = next === "unassigned" ? "" : next;
    setHoaTech(next);
    const supabase = createClient();
    const { error: err } = await supabase.from("jobs").update({ hoa_tech: value }).eq("id", job.id);
    if (err) {
      setHoaTech(previous);
      alert(`Couldn't save HOA tech: ${err.message}. Run supabase/38_jobs_hoa_tech.sql if the column is missing.`);
      return;
    }
    if (linked && value && value !== NO_HOA_TECH) {
      await update({ assigned_to: value });
    }
  }

  async function unlink() {
    if (!linked) return;
    if (!confirm("Remove this job's HOA submission? The HOA and any documents stay in your directory.")) return;
    const supabase = createClient();
    const { error: err } = await supabase.from("hoa_jobs").delete().eq("id", linked.id).eq("org_id", job.org_id);
    if (err) return alert(`Couldn't remove that link: ${err.message}`);
    setLinked(null);
  }

  if (loading) return <PanelSkeleton cards={1} />;

  return (
    <div className="space-y-4">
      <Card className="gap-2 py-4">
        <CardHeader className="flex-row items-center justify-between px-5 py-0">
          <CardTitle className="text-base font-heading">HOA Tracker</CardTitle>
          <Button asChild variant="outline" size="sm"><Link href="/hoa">View in HOA Tracker</Link></Button>
        </CardHeader>
        <CardContent className="space-y-3 px-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">HOA tech</p>
          <Select value={hoaTech} onValueChange={(v) => void saveHoaTech(v)}>
            <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              <SelectItem value={NO_HOA_TECH}>{NO_HOA_TECH}</SelectItem>
              {hoaTechs.map((t) => <SelectItem key={t} value={t}>{hoaLabel(t)}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Assign the HOA tech now. You can pick the community later. Use NO HOA when there is no association.
          </p>
        </CardContent>
      </Card>

      {!linked ? (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <p className="text-sm font-medium">Link this job to an HOA</p>
            <p className="text-sm text-muted-foreground">Pick the community this property belongs to. This creates an HOA submission tracked from here and from the org-wide HOA Tracker.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex-1">
                <HoaCombobox
                  hoas={hoaOptions}
                  value={newHoaId}
                  onChange={setNewHoaId}
                  onCreateNew={(initial) => {
                    setAddHoaInitialName(initial);
                    setAddHoaOpen(true);
                  }}
                />
              </div>
              <Button disabled={linking} onClick={linkHoa}>{linking ? "Linking…" : "Link HOA"}</Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {hoas.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No HOAs in your directory yet — use “Add new HOA…” above to create the first one.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base font-heading">
              {linkedHoa?.name ?? "HOA"} <Badge variant="secondary" className="ml-2">{linked.status}</Badge>
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={unlink}>Unlink</Button>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Job status</p>
              <Select value={linked.status ?? HOA_JOB_STATUSES[0]} onValueChange={(v) => update({ status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{HOA_JOB_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Assigned to</p>
              <Select value={linked.assigned_to || "unassigned"} onValueChange={(v) => {
                void saveHoaTech(v);
                void update({ assigned_to: v === "unassigned" || v === NO_HOA_TECH ? "" : v });
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  <SelectItem value={NO_HOA_TECH}>{NO_HOA_TECH}</SelectItem>
                  {hoaTechs.map((t) => <SelectItem key={t} value={t}>{hoaLabel(t)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <DateField label="Date assigned" value={linked.assigned_date ?? null} onSave={(next) => update({ assigned_date: next })} />
            </div>
            <div className="space-y-1.5">
              <DateField label="Date submitted" value={linked.date_submitted ?? null} onSave={(next) => update({ date_submitted: next })} />
            </div>
            <div className="space-y-1.5">
              <DateField label="Date approved" value={linked.date_approved ?? null} onSave={(next) => update({ date_approved: next })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
              <Textarea
                key={linked.id}
                rows={3}
                defaultValue={linked.notes ?? ""}
                onBlur={(e) => {
                  const next = e.target.value;
                  if (next !== (linked.notes ?? "")) update({ notes: next });
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <HoaModal
        open={addHoaOpen}
        onOpenChange={setAddHoaOpen}
        orgId={job.org_id}
        hoa={null}
        initialName={addHoaInitialName}
        onSaved={(created) => {
          setHoas((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
          setNewHoaId(created.id);
          setAddHoaOpen(false);
        }}
      />
    </div>
  );
}
