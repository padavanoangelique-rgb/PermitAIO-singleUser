"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { Tables } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Link2, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useTechSlots, useTechLabel } from "@/components/tech-slots-provider";
import { HOA_DOC_KINDS, hoaDocKindFromPath, hoaDocPath, type HoaDocKind } from "@/lib/hoa/documents";
import { saveHoaNotes } from "@/app/(app)/hoa/actions";
import { HOA_JOB_STATUSES } from "@/lib/hoa/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Hoa = Tables<"hoas">;
type HoaJob = Tables<"hoa_jobs">;
type HoaDocument = Tables<"hoa_documents">;

const KIND_SECTIONS: { id: HoaDocKind; hint: string }[] = [
  { id: "blank_form", hint: "Blank ARC / application your company uses for this HOA" },
  { id: "coi", hint: "Certificate of insurance named for this association" },
  { id: "certificate", hint: "Approval letters and other certificates" },
  { id: "other", hint: "Anything else this HOA needs" },
];

export function HoaDetail({
  hoa,
  jobs,
  documents,
  orgId,
  spineId,
  onEdit,
  onDelete,
  onAddJob,
  onJobPatched,
  onDeleteJob,
  onDocsChanged,
  onHoaPatched,
}: {
  hoa: Hoa;
  jobs: HoaJob[];
  documents: HoaDocument[];
  orgId: string;
  spineId?: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onAddJob: () => void;
  onJobPatched: (next: HoaJob) => void;
  onDeleteJob: (job: HoaJob) => void;
  onDocsChanged: () => void;
  onHoaPatched?: (next: Hoa) => void;
}) {
  const { hoaTechs } = useTechSlots();
  const { hoaLabel } = useTechLabel();
  const [notes, setNotes] = useState(hoa.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [uploading, setUploading] = useState<HoaDocKind | null>(null);
  const [coiExpires, setCoiExpires] = useState("");
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function handleSaveNotes() {
    setSavingNotes(true);
    const result = await saveHoaNotes(hoa.id, notes);
    if (!("error" in result && result.error) && spineId) {
      const supabase = createClient();
      await supabase.from("hoa_org_overlays" as never).upsert(
        {
          org_id: orgId,
          hoa_spine_id: spineId,
          notes,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "org_id,hoa_spine_id" },
      );
    }
    setSavingNotes(false);
    if ("error" in result && result.error) return alert(result.error);
    onHoaPatched?.({ ...hoa, notes });
  }

  async function patchJob(job: HoaJob, next: Partial<HoaJob>) {
    const supabase = createClient();
    const { error } = await supabase.from("hoa_jobs").update(next).eq("id", job.id).eq("org_id", orgId);
    if (error) return alert(`Couldn't save that change: ${error.message}`);
    onJobPatched({ ...job, ...next });
  }

  async function handleUpload(kind: HoaDocKind, file: File | undefined) {
    if (!file) return;
    setUploading(kind);
    const supabase = createClient();
    const path = hoaDocPath({ orgId, hoaId: hoa.id, kind, fileName: file.name });
    const { error: upErr } = await supabase.storage.from("hoa-documents").upload(path, file);
    if (upErr) {
      setUploading(null);
      return alert(`Couldn't upload that file: ${upErr.message}`);
    }
    const { error: dbErr } = await supabase.from("hoa_documents").insert({
      org_id: orgId,
      hoa_id: hoa.id,
      file_name: file.name,
      storage_path: path,
    });
    if (!dbErr && kind === "coi" && spineId) {
      await supabase.from("hoa_org_overlays" as never).upsert(
        {
          org_id: orgId,
          hoa_spine_id: spineId,
          coi_storage_path: path,
          coi_expires_on: coiExpires || null,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "org_id,hoa_spine_id" },
      );
    }
    if (!dbErr && kind === "blank_form" && spineId) {
      await supabase.from("hoa_org_overlays" as never).upsert(
        {
          org_id: orgId,
          hoa_spine_id: spineId,
          arc_form_storage_path: path,
          arc_form_file_name: file.name,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "org_id,hoa_spine_id" },
      );
    }
    setUploading(null);
    if (dbErr) return alert(`Couldn't save that file: ${dbErr.message}`);
    onDocsChanged();
  }

  async function handleDownload(doc: HoaDocument) {
    const win = window.open("", "_blank");
    const supabase = createClient();
    const { data, error } = await supabase.storage.from("hoa-documents").createSignedUrl(doc.storage_path, 60);
    if (error || !data) {
      win?.close();
      return alert(`Couldn't open that file: ${error?.message ?? "unknown error"}`);
    }
    if (win) win.location.href = data.signedUrl;
    else window.open(data.signedUrl, "_blank");
  }

  async function handleDeleteDoc(doc: HoaDocument) {
    const supabase = createClient();
    await supabase.storage.from("hoa-documents").remove([doc.storage_path]);
    const { error } = await supabase.from("hoa_documents").delete().eq("id", doc.id).eq("org_id", orgId);
    if (error) return alert(`Couldn't remove that file: ${error.message}`);
    onDocsChanged();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">{hoa.name}</h2>
          <p className="text-sm text-muted-foreground">{hoa.address || "No address on file."}</p>
          <p className="mt-1 text-xs text-muted-foreground">Files and notes stay on {orgId ? "this company" : "your company"} — other contractors do not see them.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-full" onClick={onEdit}>
            <Pencil /> Edit contact
          </Button>
          <Button variant="outline" size="sm" className="rounded-full text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 /> Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Management Co." value={hoa.mgmt_co} />
        <Field label="Contact Name" value={hoa.contact_name} />
        <Field label="Phone" value={hoa.phone} />
        <Field label="Email" value={hoa.email} />
      </div>

      <section>
        <h3 className="text-sm font-semibold">Qualifications / submittal requirements</h3>
        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{hoa.qualifications || "None on file. Use Edit contact to add them."}</p>
      </section>

      <section>
        <h3 className="text-sm font-semibold">Company notes</h3>
        <Textarea
          className="mt-2 min-h-[96px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What this HOA wants from your company…"
        />
        <Button size="sm" className="mt-2 rounded-full" disabled={savingNotes} onClick={() => void handleSaveNotes()}>
          {savingNotes ? "Saving…" : "Save notes"}
        </Button>
      </section>

      {KIND_SECTIONS.map((section) => {
        const kindDocs = documents.filter((d) => hoaDocKindFromPath(d.storage_path) === section.id);
        const label = HOA_DOC_KINDS.find((k) => k.id === section.id)?.label ?? section.id;
        return (
          <section key={section.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">{label}</h3>
                <p className="text-xs text-muted-foreground">{section.hint}</p>
              </div>
              <button
                type="button"
                disabled={uploading === section.id}
                onClick={() => inputs.current[section.id]?.click()}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-violet-600 px-3.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                {uploading === section.id ? "Uploading…" : "Upload"}
              </button>
              <input
                ref={(el) => {
                  inputs.current[section.id] = el;
                }}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  void handleUpload(section.id, e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
            {section.id === "coi" ? (
              <label className="mt-2 flex max-w-xs items-center gap-2 text-sm text-muted-foreground">
                Expires
                <Input type="date" className="h-8" value={coiExpires} onChange={(e) => setCoiExpires(e.target.value)} />
              </label>
            ) : null}
            {kindDocs.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">None uploaded for this company yet.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {kindDocs.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between rounded-xl px-2 py-1.5 hover:bg-muted/40">
                    <button type="button" onClick={() => void handleDownload(doc)} className="flex min-w-0 items-center gap-2 text-left">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-medium">{doc.file_name}</span>
                    </button>
                    <button type="button" onClick={() => void handleDeleteDoc(doc)} className="text-destructive hover:opacity-70">
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Jobs in this community ({jobs.length})</h3>
          <Button size="sm" className="rounded-full" onClick={onAddJob}>
            <Plus /> Add job
          </Button>
        </div>
        {jobs.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No jobs linked yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border/60">
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="w-24 font-medium tabular-nums">{j.job_number || "—"}</span>
                <span className="min-w-0 flex-1 truncate">{j.job_name || j.address}</span>
                <Select value={j.status || HOA_JOB_STATUSES[0]} onValueChange={(status) => void patchJob(j, { status })}>
                  <SelectTrigger size="sm" className="h-8 w-[10.5rem] rounded-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOA_JOB_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={j.assigned_to || "unassigned"}
                  onValueChange={(v) => void patchJob(j, { assigned_to: v === "unassigned" ? "" : v })}
                >
                  <SelectTrigger size="sm" className="h-8 w-[8.5rem] rounded-full">
                    <SelectValue>{j.assigned_to ? hoaLabel(j.assigned_to) : "Unassigned"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {hoaTechs.map((tech) => (
                      <SelectItem key={tech} value={tech}>
                        {hoaLabel(tech)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {j.job_id ? (
                  <Link href={`/jobs/${j.job_id}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                    <Link2 className="h-3.5 w-3.5" /> Job
                  </Link>
                ) : null}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDeleteJob(j)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}
