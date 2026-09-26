"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Search, Send, Shield, Trash2 } from "lucide-react";
import { FILL_BLUE, FILL_GREEN, FILL_PURPLE } from "@/lib/ui/fills";
import { DATE_PILL_EMPTY, DATE_TONE_SLOT, daysUntil, expireDateTone, formatEtaDate } from "@/lib/inventory/eta";
import { tradeLabel } from "@/lib/jobs/trade";
import { NewContractorDialog } from "@/app/(app)/contractors/new-contractor-dialog";
import { deleteContractorProfile, updateContractorProfile } from "@/lib/actions/contractors";
import { sendContractorEmail } from "@/lib/actions/contractor-mail";
import {
  DEFAULT_REGISTRATION_BODY,
  DEFAULT_REGISTRATION_SUBJECT,
  DEFAULT_UPDATE_BODY,
  DEFAULT_UPDATE_SUBJECT,
  coiCityOf,
  fillContractorTemplate,
  guessContractorDocKind,
} from "@/lib/contractors/kinds";
import { JURISDICTION_OPTIONS, type ContractorRow, type RegistrationDoc, type RegistrationPacket } from "@/lib/contractors/packets";
import { DocSlots, CoiQuickPick, type ContractorFile } from "./doc-slots";

const NAME_PILL = `inline-flex h-9 w-[13rem] min-w-0 shrink-0 items-center justify-center overflow-hidden rounded-full px-3 text-sm font-semibold shadow-sm ${FILL_PURPLE}`;
const TRADE_PILL = `inline-flex h-8 max-w-full items-center truncate rounded-full px-3 text-sm font-semibold ${FILL_BLUE}`;
const BTN = "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold shadow-sm";
const FIELD = "h-9 w-full rounded-full border border-border bg-background px-3 text-sm";
const ROW_GRID =
  "grid w-full grid-cols-[1.25rem_minmax(12rem,1.8fr)_5.25rem_5.5rem_minmax(4.5rem,.7fr)_5.25rem_minmax(7rem,.9fr)_minmax(7rem,.9fr)_5.25rem] items-center gap-x-2";

type ExpiringItem = {
  id: string;
  contractorId: string;
  company: string;
  detail: string;
  expires: string;
};

export function ContractorsBoard({
  contractors,
  files: initialFiles,
  packets,
  packetDocs,
  orgId,
  origin,
}: {
  contractors: ContractorRow[];
  files: ContractorFile[];
  packets: RegistrationPacket[];
  packetDocs: RegistrationDoc[];
  orgId: string;
  origin: string;
}) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [files, setFiles] = useState<ContractorFile[]>(initialFiles);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contractors;
    return contractors.filter((c) =>
      [c.company_name, c.license_number, c.qualifier_name, c.contact_name, c.city, c.trade]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [contractors, query]);

  const filesByContractor = useMemo(() => {
    const map = new Map<string, ContractorFile[]>();
    for (const file of files) {
      const id = file.contractor_id;
      if (!id) continue;
      const list = map.get(id) ?? [];
      list.push(file);
      map.set(id, list);
    }
    return map;
  }, [files]);

  const expiring = useMemo(() => collectExpiring(contractors, files), [contractors, files]);

  function setContractorFiles(contractorId: string, next: ContractorFile[]) {
    setFiles((cur) => [...cur.filter((f) => f.contractor_id !== contractorId), ...next.map((f) => ({ ...f, contractor_id: contractorId }))]);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Contractor dashboard</h1>
          <p className="text-sm text-muted-foreground">Documents as rows. Liability and workers comp — pick the city COI from the dropdown.</p>
        </div>
        <NewContractorDialog />
      </div>

      <ExpiringStrip
        license={expiring.license}
        liability={expiring.liability}
        workers={expiring.workers}
        onOpen={(id) => setOpenId(id)}
      />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search company, license, qualifier"
          className="h-10 w-full rounded-full border border-border bg-background pl-9 pr-3 text-sm"
        />
      </div>

      <div className={`${ROW_GRID} px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground`}>
        <span />
        <span>Company</span>
        <span>Trade</span>
        <span>License #</span>
        <span>Qualifier</span>
        <span>Lic</span>
        <span>Liability COI</span>
        <span>Workers comp</span>
        <span>BTR</span>
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No contractors match that search.</p>
      ) : (
        <div className="space-y-1">
          {filtered.map((contractor) => (
            <ContractorCard
              key={contractor.id}
              contractor={contractor}
              open={openId === contractor.id}
              onToggle={() => setOpenId((id) => (id === contractor.id ? null : contractor.id))}
              packets={packets}
              packetDocs={packetDocs}
              orgId={orgId}
              origin={origin}
              files={filesByContractor.get(contractor.id) ?? []}
              onFiles={(next) => setContractorFiles(contractor.id, next)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function collectExpiring(contractors: ContractorRow[], files: ContractorFile[]) {
  const byId = new Map(contractors.map((c) => [c.id, c]));
  const license: ExpiringItem[] = [];
  const liability: ExpiringItem[] = [];
  const workers: ExpiringItem[] = [];

  for (const contractor of contractors) {
    pushIfSoon(license, {
      id: `${contractor.id}-lic`,
      contractorId: contractor.id,
      company: contractor.company_name,
      detail: "License",
      expires: contractor.license_expires ?? "",
    });
    pushIfSoon(license, {
      id: `${contractor.id}-btr`,
      contractorId: contractor.id,
      company: contractor.company_name,
      detail: "BTR",
      expires: contractor.btr_expires ?? "",
    });
  }

  for (const file of files) {
    const kind = guessContractorDocKind(file.kind, file.label);
    const contractor = file.contractor_id ? byId.get(file.contractor_id) : null;
    if (!contractor || !file.expires_on) continue;
    const item: ExpiringItem = {
      id: file.id,
      contractorId: contractor.id,
      company: contractor.company_name,
      detail: kind === "coi" || kind === "workers_comp" ? coiCityOf(file.label) : kind,
      expires: file.expires_on,
    };
    if (kind === "coi") pushIfSoon(liability, item);
    if (kind === "workers_comp") pushIfSoon(workers, item);
  }

  return { license, liability, workers };
}

function pushIfSoon(list: ExpiringItem[], item: ExpiringItem) {
  const days = daysUntil(item.expires);
  if (days === null || days >= 30) return;
  if (list.some((row) => row.contractorId === item.contractorId && row.detail === item.detail && row.expires === item.expires)) return;
  list.push(item);
  list.sort((a, b) => a.expires.localeCompare(b.expires));
}

function ExpiringStrip({
  license,
  liability,
  workers,
  onOpen,
}: {
  license: ExpiringItem[];
  liability: ExpiringItem[];
  workers: ExpiringItem[];
  onOpen: (id: string) => void;
}) {
  return (
    <section className="grid gap-3 lg:grid-cols-3">
      <ExpireTile title="Documents · under 30 days" items={license} onOpen={onOpen} />
      <ExpireTile title="Liability COI · under 30 days" items={liability} onOpen={onOpen} />
      <ExpireTile title="Workers comp · under 30 days" items={workers} onOpen={onOpen} />
    </section>
  );
}

function ExpireTile({
  title,
  items,
  onOpen,
}: {
  title: string;
  items: ExpiringItem[];
  onOpen: (id: string) => void;
}) {
  return (
    <article className="rounded-2xl px-3 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <Shield className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="font-heading text-2xl font-semibold tabular-nums leading-tight text-primary">{items.length}</p>
          <p className="text-xs text-muted-foreground">{title}</p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing due in the next 30 days.</p>
      ) : (
        <ul className="mt-3 max-h-44 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpen(item.contractorId)}
                className="flex min-h-11 w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-1 py-1.5 text-left hover:bg-muted/50"
              >
                <span className={NAME_PILL} title={item.company}>
                  <span className="truncate">{item.company}</span>
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{item.detail}</span>
                <span className={DATE_TONE_SLOT[expireDateTone(item.expires)]}>{formatEtaDate(item.expires)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function ContractorCard({
  contractor,
  open,
  onToggle,
  packets,
  packetDocs,
  orgId,
  origin,
  files,
  onFiles,
}: {
  contractor: ContractorRow;
  open: boolean;
  onToggle: () => void;
  packets: RegistrationPacket[];
  packetDocs: RegistrationDoc[];
  orgId: string;
  origin: string;
  files: ContractorFile[];
  onFiles: (next: ContractorFile[]) => void;
}) {
  return (
    <article className="rounded-2xl">
      <div className={`${ROW_GRID} rounded-2xl px-2 py-2 hover:bg-muted/40`}>
        <button type="button" onClick={onToggle} className="flex h-8 w-5 items-center justify-center text-muted-foreground" aria-label={open ? "Collapse" : "Expand"}>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <button type="button" onClick={onToggle} className="flex min-w-0 items-center gap-1.5 text-left">
          <span className={NAME_PILL} title={contractor.company_name}>
            <span className="truncate">{contractor.company_name}</span>
          </span>
          {contractor.is_default ? <span className={`${BTN} ${FILL_GREEN}`}>Default</span> : null}
        </button>
        <span className={TRADE_PILL}>{tradeLabel(contractor.trade)}</span>
        <span className="truncate text-sm tabular-nums text-muted-foreground">{contractor.license_number || "—"}</span>
        <span className="min-w-0 truncate text-sm text-muted-foreground">{contractor.qualifier_name || contractor.contact_name || "—"}</span>
        <DateCell value={contractor.license_expires} />
        <CoiQuickPick kind="coi" files={files.filter((f) => guessContractorDocKind(f.kind, f.label) === "coi")} />
        <CoiQuickPick kind="workers_comp" files={files.filter((f) => guessContractorDocKind(f.kind, f.label) === "workers_comp")} />
        <DateCell value={contractor.btr_expires} />
      </div>

      {open ? (
        <div className="space-y-4 px-3 pb-4">
          <p className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Documents</p>
          <DocSlots contractorId={contractor.id} orgId={orgId} files={files} onChange={onFiles} />
          <Fold title="Profile" defaultOpen={false}>
            <ProfileFields contractor={contractor} />
          </Fold>
          <ActionRow pill="Contractor update" tone={FILL_BLUE}>
            <UpdateMail contractor={contractor} files={files} origin={origin} />
          </ActionRow>
          <ActionRow pill="Building department" tone={FILL_PURPLE}>
            <BuildingDeptMail contractor={contractor} packets={packets} packetDocs={packetDocs} files={files} origin={origin} />
          </ActionRow>
        </div>
      ) : null}
    </article>
  );
}

function Fold({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <section>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 rounded-2xl px-2 py-1.5 text-left hover:bg-muted/40">
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</span>
      </button>
      {open ? <div className="px-2 pb-2">{children}</div> : null}
    </section>
  );
}

function ActionRow({ pill, tone, children }: { pill: string; tone: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <article>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 rounded-2xl px-2 py-1.5 text-left hover:bg-muted/40">
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <span className={`${BTN} ${tone}`}>{pill}</span>
      </button>
      {open ? <div className="px-6 pb-2">{children}</div> : null}
    </article>
  );
}

function UpdateMail({
  contractor,
  files,
  origin,
}: {
  contractor: ContractorRow;
  files: ContractorFile[];
  origin: string;
}) {
  return (
    <MailComposer
      contractor={contractor}
      files={files}
      origin={origin}
      kind="update"
      defaultTo={contractor.email ?? ""}
      defaultSubject={DEFAULT_UPDATE_SUBJECT}
      defaultBody={DEFAULT_UPDATE_BODY}
    />
  );
}

function BuildingDeptMail({
  contractor,
  packets,
  packetDocs,
  files,
  origin,
}: {
  contractor: ContractorRow;
  packets: RegistrationPacket[];
  packetDocs: RegistrationDoc[];
  files: ContractorFile[];
  origin: string;
}) {
  const [jurisdiction, setJurisdiction] = useState("");
  const packet = packets.find((p) => p.jurisdiction === jurisdiction);
  const docs = packet ? packetDocs.filter((d) => d.packet_id === packet.id) : [];

  return (
    <div className="space-y-3">
      <select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} className={FIELD}>
        <option value="">Select jurisdiction</option>
        {JURISDICTION_OPTIONS.map((opt) => (
          <option key={opt.label} value={opt.city}>
            {opt.label}
          </option>
        ))}
      </select>
      {packet ? (
        <div className="rounded-2xl bg-muted/30 px-4 py-3 text-sm">
          <p className="font-medium">{packet.building_department || packet.jurisdiction}</p>
          {packet.building_dept_email ? <p className="text-muted-foreground">{packet.building_dept_email}</p> : null}
          <p className="mt-2 whitespace-pre-wrap">{packet.instructions || "No registration instructions on file yet."}</p>
          {docs.length ? (
            <p className="mt-2 text-muted-foreground">Registration packet: {docs.map((d) => d.title).join(", ")}</p>
          ) : null}
        </div>
      ) : jurisdiction ? (
        <p className="text-sm text-muted-foreground">No registration packet for this city yet. Add one under Libraries → Building depts.</p>
      ) : (
        <p className="text-sm text-muted-foreground">Pick a building department to load instructions and send registration.</p>
      )}
      <MailComposer
        key={jurisdiction || "none"}
        contractor={contractor}
        files={files}
        origin={origin}
        kind="registration"
        jurisdiction={jurisdiction || undefined}
        defaultTo={packet?.building_dept_email || ""}
        defaultSubject={packet?.registration_subject || DEFAULT_REGISTRATION_SUBJECT}
        defaultBody={packet?.registration_body || DEFAULT_REGISTRATION_BODY}
        includePlatformDocs
      />
    </div>
  );
}

function MailComposer({
  contractor,
  files,
  origin,
  kind,
  jurisdiction,
  defaultTo,
  defaultSubject,
  defaultBody,
  includePlatformDocs,
}: {
  contractor: ContractorRow;
  files: ContractorFile[];
  origin: string;
  kind: "update" | "registration";
  jurisdiction?: string;
  defaultTo: string;
  defaultSubject: string;
  defaultBody: string;
  includePlatformDocs?: boolean;
}) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [picked, setPicked] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Send to" className={FIELD} />
      <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className={FIELD} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm" />
      <p className="text-xs text-muted-foreground">
        Tokens: {"{{company}} {{license}} {{qualifier}} {{jurisdiction}} {{contact}} {{phone}} {{email}} {{instructions}}"}
      </p>
      {files.length ? (
        <div className="flex flex-wrap gap-2">
          {files.map((file) => {
            const on = picked.includes(file.id);
            return (
              <button
                key={file.id}
                type="button"
                onClick={() => setPicked((ids) => (on ? ids.filter((id) => id !== file.id) : [...ids, file.id]))}
                className={`${BTN} ${on ? FILL_BLUE : "bg-muted text-muted-foreground"}`}
              >
                {file.label || file.file_name}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Attach contractor files after you upload them above.</p>
      )}
      <button
        type="button"
        disabled={sending}
        onClick={async () => {
          setSending(true);
          setStatus(null);
          const preview = fillContractorTemplate(subject, { company: contractor.company_name });
          void preview;
          const result = await sendContractorEmail({
            contractorId: contractor.id,
            kind,
            to,
            subject,
            body,
            fileIds: picked,
            jurisdiction,
            origin,
            includePlatformDocs: !!includePlatformDocs,
          });
          setSending(false);
          setStatus(result.error ? result.error : `Sent to ${result.sentTo}`);
        }}
        className={`${BTN} h-9 ${FILL_BLUE}`}
      >
        <Send className="h-3.5 w-3.5" />
        {sending ? "Sending…" : "Send email"}
      </button>
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
    </div>
  );
}

function DateCell({ value }: { value: string | null }) {
  if (!value) return <span className={DATE_PILL_EMPTY}>—</span>;
  return <span className={DATE_TONE_SLOT[expireDateTone(value)]}>{formatEtaDate(value)}</span>;
}

function ProfileFields({ contractor }: { contractor: ContractorRow }) {
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      action={async (formData) => {
        setPending(true);
        const result = await updateContractorProfile(contractor.id, { error: null }, formData);
        setPending(false);
        setMsg(result.error ?? "Saved");
      }}
    >
      <Field name="company_name" label="Company" defaultValue={contractor.company_name} required />
      <label className="space-y-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Trade
        <select name="trade" defaultValue={contractor.trade} className={`${FIELD} mt-1 normal-case`}>
          <option value="windows">Windows</option>
          <option value="roofing">Roofing</option>
        </select>
      </label>
      <Field name="license_number" label="License #" defaultValue={contractor.license_number} />
      <Field name="qualifier_name" label="Qualifier" defaultValue={contractor.qualifier_name} />
      <Field name="business_tax_receipt_number" label="BTR #" defaultValue={contractor.business_tax_receipt_number} />
      <Field name="contact_name" label="Contact" defaultValue={contractor.contact_name} />
      <Field name="phone" label="Phone" defaultValue={contractor.phone} />
      <Field name="email" label="Email" defaultValue={contractor.email} />
      <Field name="address" label="Address" defaultValue={contractor.address} />
      <Field name="city" label="City" defaultValue={contractor.city} />
      <Field name="state" label="State" defaultValue={contractor.state ?? "FL"} />
      <Field name="zip" label="Zip" defaultValue={contractor.zip} />
      <Field name="license_expires" label="License expires" defaultValue={contractor.license_expires} type="date" />
      <Field name="btr_expires" label="BTR expires" defaultValue={contractor.btr_expires} type="date" />
      <input type="hidden" name="insurance_expires" defaultValue={contractor.insurance_expires ?? ""} />
      <input type="hidden" name="workers_comp_expires" defaultValue={contractor.workers_comp_expires ?? ""} />
      <input type="hidden" name="bonding_company" defaultValue={contractor.bonding_company ?? ""} />
      <input type="hidden" name="bonding_address" defaultValue={contractor.bonding_address ?? ""} />
      <input type="hidden" name="bonding_city" defaultValue={contractor.bonding_city ?? ""} />
      <input type="hidden" name="bonding_state" defaultValue={contractor.bonding_state ?? ""} />
      <input type="hidden" name="bonding_zip" defaultValue={contractor.bonding_zip ?? ""} />
      <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_default" defaultChecked={!!contractor.is_default} />
          Default for this trade
        </label>
        <button type="submit" disabled={pending} className={`${BTN} ${FILL_BLUE}`}>
          {pending ? "Saving…" : "Save profile"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Remove ${contractor.company_name}?`)) void deleteContractorProfile(contractor.id);
          }}
          className={`${BTN} bg-rose-600 text-white`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remove
        </button>
        {msg ? <span className="text-sm text-muted-foreground">{msg}</span> : null}
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  type = "text",
  required,
}: {
  name: string;
  label: string;
  defaultValue: string | null;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="space-y-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {label}
      <input name={name} type={type} required={required} defaultValue={type === "date" ? (defaultValue ?? "").slice(0, 10) : (defaultValue ?? "")} className={`${FIELD} mt-1 normal-case`} />
    </label>
  );
}
