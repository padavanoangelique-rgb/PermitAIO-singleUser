"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { FILL_BLUE, FILL_GREEN, FILL_PURPLE } from "@/lib/ui/fills";
import {
  DEFAULT_NOC_BODY,
  DEFAULT_NOC_SUBJECT,
  DEFAULT_REGISTRATION_BODY,
  DEFAULT_REGISTRATION_SUBJECT,
} from "@/lib/contractors/kinds";
import { JURISDICTION_OPTIONS, type RegistrationDoc, type RegistrationPacket } from "@/lib/contractors/packets";
import {
  addRegistrationDoc,
  deleteRegistrationDoc,
  deleteRegistrationPacket,
  saveRegistrationPacket,
} from "@/lib/actions/platform-registration";
import { FORM_COUNTIES, type FormCounty } from "@/lib/forms/folio";
import { LIB_PILL, LibrarySearch } from "@/components/libraries/county-fold";
import { linkify } from "@/lib/forms/contact-notes";

const BTN = "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold shadow-sm";
const FIELD = "h-9 w-full rounded-xl border border-border bg-background px-3 text-sm";
const LABEL = "text-[11px] font-medium uppercase tracking-wide text-[#667085]";
const INK = "font-[family-name:var(--font-plus-jakarta),ui-sans-serif] text-[15px] text-[#171717]";

function packetCounty(packet: RegistrationPacket): string {
  if (packet.county && FORM_COUNTIES.includes(packet.county as FormCounty)) return packet.county;
  const match = JURISDICTION_OPTIONS.find((o) => o.city === packet.jurisdiction);
  return match?.county ?? "Other";
}

export function PlatformLibraryBoard({
  packets,
  docs,
  isAdmin,
  missingTable,
}: {
  packets: RegistrationPacket[];
  docs: RegistrationDoc[];
  isAdmin: boolean;
  missingTable: boolean;
}) {
  const [query, setQuery] = useState("");
  const [countyFilter, setCountyFilter] = useState<string>("All");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return packets.filter((p) => {
      const county = packetCounty(p);
      if (countyFilter !== "All" && county !== countyFilter) return false;
      if (!q) return true;
      return [p.jurisdiction, p.county, p.building_department, p.building_dept_email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [packets, query, countyFilter]);

  const openPacket = packets.find((p) => p.id === openId) ?? null;
  const openDocs = docs.filter((d) => d.packet_id === openId);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        One line per city. Click a row to open the packet.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <LibrarySearch value={query} onChange={setQuery} placeholder="Search jurisdiction" />
        {isAdmin ? (
          <button type="button" onClick={() => setCreating(true)} className={`${BTN} ${FILL_GREEN}`}>
            <Plus className="h-3.5 w-3.5" />
            Add jurisdiction
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {["All", ...FORM_COUNTIES].map((name) => {
          const count =
            name === "All" ? packets.length : packets.filter((p) => packetCounty(p) === name).length;
          const on = countyFilter === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => setCountyFilter(name)}
              className={`${BTN} ${on ? FILL_PURPLE : "bg-white text-[#171717] ring-1 ring-black/5"}`}
            >
              {name}
              <span className="opacity-80">{count}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && !creating ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {missingTable
            ? "This tab holds registration packets for each building department — add a jurisdiction to start."
            : "No jurisdiction packets yet."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
          <div className="hidden grid-cols-[minmax(11rem,1.3fr)_9rem_minmax(12rem,1.6fr)_3.5rem] gap-x-3 border-b border-black/5 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-[#667085] sm:grid">
            <span>Jurisdiction</span>
            <span>County</span>
            <span>Email</span>
            <span className="text-right">Docs</span>
          </div>
          {filtered
            .slice()
            .sort((a, b) => packetCounty(a).localeCompare(packetCounty(b)) || a.jurisdiction.localeCompare(b.jurisdiction))
            .map((packet) => {
              const county = packetCounty(packet);
              const n = docs.filter((d) => d.packet_id === packet.id).length;
              const email = (packet.building_dept_email ?? "").trim();
              return (
                <button
                  key={packet.id}
                  type="button"
                  onClick={() => setOpenId(packet.id)}
                  className="grid w-full grid-cols-1 items-center gap-x-3 border-b border-black/5 px-4 py-2.5 text-left last:border-0 hover:bg-[#F8FAFC] sm:grid-cols-[minmax(11rem,1.3fr)_9rem_minmax(12rem,1.6fr)_3.5rem]"
                >
                  <span className={`${INK} truncate font-semibold`}>{packet.jurisdiction}</span>
                  <span className="truncate text-sm text-[#667085]">{county}</span>
                  <span className={`truncate text-sm ${email ? "text-[#156CDD]" : "text-[#667085]"}`}>{email || "—"}</span>
                  <span className="text-right text-sm tabular-nums text-[#667085]">{n}</span>
                </button>
              );
            })}
        </div>
      )}

      {creating && isAdmin ? (
        <PacketCard
          packet={null}
          docs={[]}
          isAdmin
          onClose={() => setCreating(false)}
        />
      ) : null}

      {openPacket ? (
        <PacketCard
          packet={openPacket}
          docs={openDocs}
          isAdmin={isAdmin}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </div>
  );
}

function PacketCard({
  packet,
  docs,
  isAdmin,
  onClose,
}: {
  packet: RegistrationPacket | null;
  docs: RegistrationDoc[];
  isAdmin: boolean;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(!packet);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10">
      <div className="relative mb-10 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className={`${INK} text-xl font-semibold`}>{packet?.jurisdiction || "New jurisdiction"}</p>
            <p className="mt-0.5 text-sm text-[#667085]">{packet?.county || "Select a city"}</p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && packet ? (
              <button type="button" onClick={() => setEditing((v) => !v)} className={`${BTN} ${FILL_BLUE}`}>
                {editing ? "View" : "Edit"}
              </button>
            ) : null}
            <button type="button" onClick={onClose} className={`${BTN} bg-muted text-[#171717]`}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {editing && isAdmin ? (
          <PacketEditor packet={packet} docs={docs} onClose={onClose} />
        ) : (
          <PacketRead packet={packet} docs={docs} />
        )}
      </div>
    </div>
  );
}

function dash(value: string | null | undefined) {
  const v = (value ?? "").trim();
  return v || null;
}

function PacketRead({ packet, docs }: { packet: RegistrationPacket | null; docs: RegistrationDoc[] }) {
  if (!packet) return null;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <ReadField label="Building department" value={packet.building_department} />
        <ReadField label="Building department email" value={packet.building_dept_email} mail />
        <ReadField label="Public permit search" value={packet.public_portal_url ?? null} />
        <ReadField
          label="Where to send the NOC"
          value={
            packet.noc_route
              ? `${packet.noc_route}: ${packet.noc_route_target || "not on file"}`
              : null
          }
        />
      </div>
      <div>
        <p className={LABEL}>How to complete contractor registration</p>
        {dash(packet.instructions) ? (
          <div className={`mt-1 whitespace-pre-wrap leading-relaxed ${INK}`}>{linkify(packet.instructions!)}</div>
        ) : (
          <p className="mt-1 text-[#667085]">—</p>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className={LABEL}>Contractor registration email</p>
          <p className={`mt-1 ${INK}`}>{dash(packet.registration_subject) ?? "—"}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-[#171717]">{dash(packet.registration_body) ?? "—"}</p>
        </div>
        <div>
          <p className={LABEL}>NOC email / upload link</p>
          <p className={`mt-1 ${INK}`}>{dash(packet.noc_subject) ?? "—"}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-[#171717]">{dash(packet.noc_body) ?? "—"}</p>
        </div>
      </div>
      <div>
        <p className={LABEL}>Documents</p>
        {docs.length === 0 ? (
          <p className="mt-1 text-[#667085]">—</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {docs.map((d) => (
              <li key={d.id} className={`${LIB_PILL} ${d.kind === "noc" ? FILL_GREEN : FILL_PURPLE}`}>
                {d.title}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ReadField({ label, value, mail }: { label: string; value: string | null; mail?: boolean }) {
  const shown = dash(value);
  return (
    <div>
      <p className={LABEL}>{label}</p>
      {shown && mail ? (
        <a href={`mailto:${shown}`} className="mt-1 inline-block text-sm text-[#156CDD]">
          {shown}
        </a>
      ) : (
        <p className={`mt-1 ${shown ? INK : "text-[#667085]"}`}>{shown ?? "—"}</p>
      )}
    </div>
  );
}

function PacketEditor({
  packet,
  docs,
  onClose,
}: {
  packet: RegistrationPacket | null;
  docs: RegistrationDoc[];
  onClose?: () => void;
}) {
  const opt = JURISDICTION_OPTIONS.find((o) => o.city === packet?.jurisdiction);
  const [county, setCounty] = useState(packet?.county || opt?.county || "");
  const [jurisdiction, setJurisdiction] = useState(packet?.jurisdiction || "");
  const [dept, setDept] = useState(packet?.building_department || "");
  const [email, setEmail] = useState(packet?.building_dept_email || "");
  const [instructions, setInstructions] = useState(packet?.instructions || "");
  const [regSubject, setRegSubject] = useState(packet?.registration_subject || DEFAULT_REGISTRATION_SUBJECT);
  const [regBody, setRegBody] = useState(packet?.registration_body || DEFAULT_REGISTRATION_BODY);
  const [nocSubject, setNocSubject] = useState(packet?.noc_subject || DEFAULT_NOC_SUBJECT);
  const [nocBody, setNocBody] = useState(packet?.noc_body || DEFAULT_NOC_BODY);
  const [portalUrl, setPortalUrl] = useState(packet?.public_portal_url || "");
  const [nocRoute, setNocRoute] = useState(packet?.noc_route || "");
  const [nocTarget, setNocTarget] = useState(packet?.noc_route_target || "");
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [id, setId] = useState(packet?.id ?? null);

  async function save() {
    setPending(true);
    const result = await saveRegistrationPacket(id, {
      county,
      jurisdiction,
      building_department: dept,
      building_dept_email: email,
      instructions,
      registration_subject: regSubject,
      registration_body: regBody,
      noc_subject: nocSubject,
      noc_body: nocBody,
      public_portal_url: portalUrl,
      noc_route: nocRoute,
      noc_route_target: nocTarget,
    });
    setPending(false);
    if (result.error) return setMsg(result.error);
    if (result.id) setId(result.id);
    setMsg("Saved");
    onClose?.();
  }

  const byCounty = useMemo(() => {
    const map = new Map<string, typeof JURISDICTION_OPTIONS>();
    for (const countyName of FORM_COUNTIES) map.set(countyName, []);
    for (const option of JURISDICTION_OPTIONS) {
      const list = map.get(option.county) ?? [];
      list.push(option);
      map.set(option.county, list);
    }
    return FORM_COUNTIES.map((name) => ({ county: name, options: map.get(name) ?? [] }));
  }, []);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={`space-y-1 ${LABEL}`}>
          Jurisdiction
          <select
            value={jurisdiction}
            onChange={(e) => {
              const city = e.target.value;
              setJurisdiction(city);
              const match = JURISDICTION_OPTIONS.find((o) => o.city === city);
              if (match) setCounty(match.county);
            }}
            className={`${FIELD} mt-1 normal-case font-normal text-[#171717]`}
          >
            <option value="">Select</option>
            {byCounty.map((group) => (
              <optgroup key={group.county} label={group.county}>
                {group.options.map((o) => (
                  <option key={o.label} value={o.city}>
                    {o.city}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className={`space-y-1 ${LABEL}`}>
          Building department
          <input value={dept} onChange={(e) => setDept(e.target.value)} className={`${FIELD} mt-1 normal-case font-normal text-[#171717]`} />
        </label>
        <label className={`space-y-1 ${LABEL} sm:col-span-2`}>
          Building department email
          <input value={email} onChange={(e) => setEmail(e.target.value)} className={`${FIELD} mt-1 normal-case font-normal text-[#171717]`} />
        </label>
        <label className={`space-y-1 ${LABEL} sm:col-span-2`}>
          Public permit search (no login)
          <input value={portalUrl} onChange={(e) => setPortalUrl(e.target.value)} placeholder="https://… use {permit} where the permit number goes" className={`${FIELD} mt-1 normal-case font-normal text-[#171717]`} />
        </label>
        <label className={`space-y-1 ${LABEL}`}>
          Where to send the NOC
          <select value={nocRoute} onChange={(e) => setNocRoute(e.target.value)} className={`${FIELD} mt-1 normal-case font-normal text-[#171717]`}>
            <option value="">Not on file</option>
            <option value="email">Email</option>
            <option value="portal">Portal</option>
            <option value="address">Address</option>
          </select>
        </label>
        <label className={`space-y-1 ${LABEL}`}>
          NOC email, portal, or address
          <input value={nocTarget} onChange={(e) => setNocTarget(e.target.value)} className={`${FIELD} mt-1 normal-case font-normal text-[#171717]`} />
        </label>
      </div>
      <label className={`block space-y-1 ${LABEL}`}>
        How to complete contractor registration
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={8}
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal normal-case text-[#171717]"
        />
      </label>
      <div className="grid gap-3 lg:grid-cols-2">
        <EmailFields title="Contractor registration email" subject={regSubject} body={regBody} onSubject={setRegSubject} onBody={setRegBody} />
        <EmailFields title="NOC email / upload link" subject={nocSubject} body={nocBody} onSubject={setNocSubject} onBody={setNocBody} />
      </div>
      {id ? <PacketDocs packetId={id} docs={docs} /> : <p className="text-sm text-muted-foreground">Save the packet first, then attach registration documents.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => void save()} className={`${BTN} ${FILL_BLUE}`}>
          {pending ? "Saving…" : "Save packet"}
        </button>
        {id ? (
          <button
            type="button"
            className={`${BTN} bg-rose-600 text-white`}
            onClick={() => {
              if (confirm("Remove this jurisdiction packet?")) void deleteRegistrationPacket(id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        ) : null}
        {msg ? <span className="text-sm text-muted-foreground">{msg}</span> : null}
      </div>
    </div>
  );
}

function EmailFields({
  title,
  subject,
  body,
  onSubject,
  onBody,
}: {
  title: string;
  subject: string;
  body: string;
  onSubject: (v: string) => void;
  onBody: (v: string) => void;
}) {
  return (
    <div className="rounded-xl bg-[#F8FAFC] px-3 py-3">
      <p className={`mb-2 ${LABEL}`}>{title}</p>
      <input value={subject} onChange={(e) => onSubject(e.target.value)} className={`${FIELD} mb-2`} />
      <textarea value={body} onChange={(e) => onBody(e.target.value)} rows={8} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
    </div>
  );
}

function PacketDocs({ packetId, docs }: { packetId: string; docs: RegistrationDoc[] }) {
  const [kind, setKind] = useState("registration");
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div className="space-y-2">
      <p className={LABEL}>Contractor registration documents</p>
      {docs.map((doc) => (
        <div key={doc.id} className="flex flex-wrap items-center gap-2">
          <span className={`${BTN} ${doc.kind === "noc" ? FILL_GREEN : FILL_PURPLE}`}>{doc.kind}</span>
          <span className="text-sm">{doc.title}</span>
          <button type="button" className="text-sm text-muted-foreground" onClick={() => void deleteRegistrationDoc(doc.id)}>
            Remove
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={FIELD + " max-w-[10rem]"}>
          <option value="registration">Registration</option>
          <option value="noc">NOC</option>
          <option value="other">Other</option>
        </select>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Label" className={`${FIELD} max-w-[12rem]`} />
        <label className={`${BTN} ${FILL_BLUE} cursor-pointer`}>
          {pending ? "Uploading…" : "Upload"}
          <input
            type="file"
            className="hidden"
            disabled={pending}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setPending(true);
              const data = await fileToBase64(file);
              const result = await addRegistrationDoc(packetId, {
                title: title || file.name,
                kind,
                fileName: file.name,
                fileData: data,
              });
              setPending(false);
              if (result.error) alert(result.error);
              else setTitle("");
            }}
          />
        </label>
      </div>
    </div>
  );
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const comma = text.indexOf(",");
      resolve(comma >= 0 ? text.slice(comma + 1) : text);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
