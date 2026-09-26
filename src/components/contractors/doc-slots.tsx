"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Download, Paperclip, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FILL_BLUE, FILL_GREEN, FILL_PURPLE } from "@/lib/ui/fills";
import { DATE_PILL_EMPTY, DATE_TONE_SLOT, expireDateTone, formatEtaDate } from "@/lib/inventory/eta";
import {
  COI_COLUMNS,
  CONTRACTOR_DOC_KINDS,
  coiCityOf,
  guessContractorDocKind,
  latestExpiry,
  type CoiKind,
  type ContractorDocKind,
} from "@/lib/contractors/kinds";
import { JURISDICTION_OPTIONS } from "@/lib/contractors/packets";

export type ContractorFile = {
  id: string;
  contractor_id?: string;
  file_name: string;
  storage_path: string;
  label: string | null;
  kind: string | null;
  expires_on: string | null;
};

const PILL = "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold shadow-sm";
const FIELD = "h-8 rounded-full border border-border bg-background px-3 text-sm";
const DOC_ROW =
  "flex w-full flex-wrap items-center gap-2 rounded-2xl px-2 py-1.5 text-left hover:bg-muted/40";
const SLOT_TONE: Record<string, string> = {
  license: FILL_BLUE,
  btr: "bg-sky-600 text-white",
  w9: "bg-amber-500 text-white",
  other: "bg-muted text-foreground",
  coi: FILL_GREEN,
  workers_comp: FILL_PURPLE,
};

function fileKind(file: ContractorFile): ContractorDocKind {
  return guessContractorDocKind(file.kind, file.label);
}

export function DocSlots({
  contractorId,
  orgId,
  files,
  onChange,
}: {
  contractorId: string;
  orgId: string;
  files: ContractorFile[];
  onChange: (next: ContractorFile[]) => void;
}) {
  const companyDocs = files.filter((f) => {
    const kind = fileKind(f);
    return kind !== "coi" && kind !== "workers_comp";
  });

  return (
    <div className="space-y-1">
      {CONTRACTOR_DOC_KINDS.map((kind) => (
        <DocRow
          key={kind.id}
          kind={kind.id}
          label={kind.label}
          contractorId={contractorId}
          orgId={orgId}
          files={companyDocs.filter((f) => fileKind(f) === kind.id)}
          allFiles={files}
          onChange={onChange}
        />
      ))}
      {COI_COLUMNS.map((col) => (
        <CoiRow
          key={col.id}
          kind={col.id}
          title={col.label}
          contractorId={contractorId}
          orgId={orgId}
          files={files.filter((f) => fileKind(f) === col.id)}
          allFiles={files}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

export function CoiQuickPick({
  kind,
  files,
}: {
  kind: CoiKind;
  files: ContractorFile[];
}) {
  const cities = Array.from(new Set(files.map((f) => coiCityOf(f.label)))).sort((a, b) => a.localeCompare(b));
  const [city, setCity] = useState(cities[0] ?? "");
  const selected = files.filter((f) => coiCityOf(f.label) === city);
  const latest = selected[0];
  const expires = latestExpiry(selected.map((f) => f.expires_on));
  const cityKey = cities.join("|");

  useEffect(() => {
    if (city && cities.includes(city)) return;
    setCity(cities[0] ?? "");
    // cities is rebuilt from files; cityKey is the stable fingerprint
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityKey]);

  async function openLatest() {
    if (!latest) return;
    const supabase = createClient();
    const { data, error } = await supabase.storage.from("contractor-docs").createSignedUrl(latest.storage_path, 60);
    if (error || !data) return alert(error?.message ?? "Couldn't open that file.");
    window.open(data.signedUrl, "_blank");
  }

  if (cities.length === 0) {
    return <span className={DATE_PILL_EMPTY}>—</span>;
  }

  return (
    <div className="flex min-w-0 items-center gap-1" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <select
        value={city}
        onChange={(e) => setCity(e.target.value)}
        aria-label={kind === "coi" ? "Liability COI" : "Workers comp COI"}
        className="h-8 min-w-0 flex-1 rounded-full border border-border bg-background px-2 text-xs font-semibold"
      >
        {cities.map((c) => {
          const exp = latestExpiry(files.filter((f) => coiCityOf(f.label) === c).map((f) => f.expires_on));
          return (
            <option key={c} value={c}>
              {c}
              {exp ? ` · ${formatEtaDate(exp)}` : ""}
            </option>
          );
        })}
      </select>
      {latest ? (
        <button type="button" onClick={() => void openLatest()} className={expires ? DATE_TONE_SLOT[expireDateTone(expires)] : DATE_PILL_EMPTY} title={`Open ${latest.file_name}`}>
          {expires ? formatEtaDate(expires) : "Open"}
        </button>
      ) : (
        <span className={DATE_PILL_EMPTY}>—</span>
      )}
    </div>
  );
}

function DocRow({
  kind,
  label,
  contractorId,
  orgId,
  files,
  allFiles,
  onChange,
}: {
  kind: ContractorDocKind;
  label: string;
  contractorId: string;
  orgId: string;
  files: ContractorFile[];
  allFiles: ContractorFile[];
  onChange: (next: ContractorFile[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const expires = latestExpiry(files.map((f) => f.expires_on));
  return (
    <article>
      <button type="button" onClick={() => setOpen((v) => !v)} className={DOC_ROW}>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <span className={`${PILL} ${SLOT_TONE[kind] ?? FILL_BLUE}`}>{label}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {files.length ? `${files.length} on file` : "None"}
        </span>
        <ExpirePill value={expires} />
      </button>
      {open ? (
        <FileList
          kind={kind}
          label={label}
          heading={label}
          contractorId={contractorId}
          orgId={orgId}
          files={files}
          allFiles={allFiles}
          onChange={onChange}
        />
      ) : null}
    </article>
  );
}

function CoiRow({
  kind,
  title,
  contractorId,
  orgId,
  files,
  allFiles,
  onChange,
}: {
  kind: CoiKind;
  title: string;
  contractorId: string;
  orgId: string;
  files: ContractorFile[];
  allFiles: ContractorFile[];
  onChange: (next: ContractorFile[]) => void;
}) {
  const [pending, setPending] = useState<string[]>([]);
  const cities = Array.from(new Set([...files.map((f) => coiCityOf(f.label)), ...pending])).sort((a, b) =>
    a.localeCompare(b),
  );
  const used = new Set(cities);
  const [city, setCity] = useState(cities[0] ?? "");
  const cityFiles = files.filter((f) => coiCityOf(f.label) === city);
  const expires = latestExpiry(cityFiles.map((f) => f.expires_on));
  const cityKey = cities.join("|");

  useEffect(() => {
    if (city && cities.includes(city)) return;
    setCity(cities[0] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityKey]);

  function pickCity(next: string) {
    if (!next) return;
    if (!used.has(next)) setPending((list) => [...list, next]);
    setCity(next);
  }

  return (
    <article>
      <div className={DOC_ROW}>
        <span className={`${PILL} ${SLOT_TONE[kind]}`}>{title}</span>
        <select
          value={city}
          onChange={(e) => pickCity(e.target.value)}
          className={`${FIELD} min-w-[12rem] flex-1`}
          aria-label={`${title} city`}
        >
          {cities.length === 0 ? <option value="">Select a city</option> : null}
          {cities.map((c) => {
            const exp = latestExpiry(files.filter((f) => coiCityOf(f.label) === c).map((f) => f.expires_on));
            const count = files.filter((f) => coiCityOf(f.label) === c).length;
            return (
              <option key={c} value={c}>
                {c}
                {count ? ` · ${count}` : " · add"}
                {exp ? ` · ${formatEtaDate(exp)}` : ""}
              </option>
            );
          })}
          <option value="" disabled>
            — Add city —
          </option>
          {JURISDICTION_OPTIONS.filter((opt) => !used.has(opt.city)).map((opt) => (
            <option key={`${kind}-${opt.label}`} value={opt.city}>
              Add {opt.label}
            </option>
          ))}
        </select>
        <ExpirePill value={expires} />
      </div>
      {city ? (
        <FileList
          kind={kind}
          label={city}
          heading={`${title} · ${city}`}
          contractorId={contractorId}
          orgId={orgId}
          files={cityFiles}
          allFiles={allFiles}
          onChange={onChange}
        />
      ) : (
        <p className="px-8 pb-2 text-sm text-muted-foreground">Pick a city to open that certificate.</p>
      )}
    </article>
  );
}

function FileList({
  kind,
  label,
  heading,
  contractorId,
  orgId,
  files,
  allFiles,
  onChange,
}: {
  kind: ContractorDocKind;
  label: string;
  heading: string;
  contractorId: string;
  orgId: string;
  files: ContractorFile[];
  allFiles: ContractorFile[];
  onChange: (next: ContractorFile[]) => void;
}) {
  const [expires, setExpires] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    const supabase = createClient();
    const safe = file.name.replace(/[^\w.\-]/g, "_");
    const path = `${contractorId}/${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage.from("contractor-docs").upload(path, file);
    if (upErr) {
      setUploading(false);
      alert(upErr.message);
      return;
    }
    const row = {
      org_id: orgId,
      contractor_id: contractorId,
      file_name: file.name,
      storage_path: path,
      size_bytes: file.size,
      label,
      kind,
      expires_on: expires || null,
    };
    let { data, error } = await supabase
      .from("contractor_files" as never)
      .insert(row as never)
      .select("id, contractor_id, file_name, storage_path, label, kind, expires_on")
      .maybeSingle();
    if (error && /kind/i.test(error.message)) {
      const fallback = { ...row } as Record<string, unknown>;
      delete fallback.kind;
      const retry = await supabase
        .from("contractor_files" as never)
        .insert(fallback as never)
        .select("id, contractor_id, file_name, storage_path, label, expires_on")
        .maybeSingle();
      data = retry.data as typeof data;
      error = retry.error;
    }
    setUploading(false);
    if (error || !data) {
      await supabase.storage.from("contractor-docs").remove([path]);
      alert(error?.message ?? "Couldn't save that file.");
      return;
    }
    setExpires("");
    onChange([data as ContractorFile, ...allFiles]);
  }

  async function download(file: ContractorFile) {
    const supabase = createClient();
    const { data, error } = await supabase.storage.from("contractor-docs").createSignedUrl(file.storage_path, 60);
    if (error || !data) return alert(error?.message ?? "Couldn't open that file.");
    window.open(data.signedUrl, "_blank");
  }

  async function setExpiry(file: ContractorFile, next: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("contractor_files" as never)
      .update({ expires_on: next || null } as never)
      .eq("id", file.id);
    if (error) return alert(error.message);
    onChange(allFiles.map((f) => (f.id === file.id ? { ...f, expires_on: next || null } : f)));
  }

  async function remove(file: ContractorFile) {
    if (!confirm(`Remove ${file.file_name}?`)) return;
    const supabase = createClient();
    await supabase.from("contractor_files" as never).delete().eq("id", file.id);
    await supabase.storage.from("contractor-docs").remove([file.storage_path]);
    onChange(allFiles.filter((f) => f.id !== file.id));
  }

  return (
    <div className="space-y-2 px-6 pb-2">
      {files.map((file) => (
        <div key={file.id} className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void download(file)} className={`${PILL} ${FILL_BLUE}`}>
            <Download className="h-3.5 w-3.5" />
            {file.file_name}
          </button>
          <ExpireEditor value={file.expires_on} onSave={(next) => void setExpiry(file, next)} />
          <button type="button" onClick={() => void remove(file)} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={expires}
          onChange={(e) => setExpires(e.target.value)}
          className={FIELD}
          aria-label={`${heading} expiration`}
        />
        <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()} className={`${PILL} ${FILL_PURPLE}`}>
          <Paperclip className="h-3.5 w-3.5" />
          {uploading ? "Uploading…" : "Upload"}
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const picked = e.target.files?.[0];
            if (picked) void upload(picked);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

function ExpirePill({ value }: { value: string | null }) {
  if (!value) return <span className={DATE_PILL_EMPTY}>—</span>;
  return <span className={DATE_TONE_SLOT[expireDateTone(value)]}>{formatEtaDate(value)}</span>;
}

function ExpireEditor({ value, onSave }: { value: string | null; onSave: (next: string) => void }) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const stored = (value ?? "").slice(0, 10);

  useEffect(() => {
    if (!editing) return;
    ref.current?.focus();
    try {
      ref.current?.showPicker();
    } catch {
      /* native input still works */
    }
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={ref}
        type="date"
        defaultValue={stored}
        onChange={(e) => {
          const next = e.target.value;
          if (next && next !== stored) onSave(next);
          setEditing(false);
        }}
        onBlur={() => setEditing(false)}
        className="h-8 w-[4.75rem] rounded-full border border-border bg-background px-1 text-center text-xs"
      />
    );
  }
  return (
    <button type="button" className={stored ? DATE_TONE_SLOT[expireDateTone(stored)] : DATE_PILL_EMPTY} onClick={() => setEditing(true)}>
      {stored ? formatEtaDate(stored) : "—"}
    </button>
  );
}