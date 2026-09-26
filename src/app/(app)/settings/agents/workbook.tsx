"use client";

import { useEffect, useState } from "react";
import {
  AGENTS,
  LOADED,
  mailboxesForShop,
  NOTE_LABELS,
  NOT_LOADED,
  SPECIALISTS,
  TEACH_WAYS,
  type WorkbookNoteId,
} from "@/lib/chat/workbook";
import { PrintButton } from "../ask/print-button";

const KEY = "permitaio.agent-workbook.v1";

function loadNotes(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function NoteBox({ id, rows = 5 }: { id: WorkbookNoteId; rows?: number }) {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValue(loadNotes()[id] ?? "");
  }, [id]);

  function save(next: string) {
    setValue(next);
    const all = { ...loadNotes(), [id]: next };
    localStorage.setItem(KEY, JSON.stringify(all));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  }

  return (
    <label className="mt-3 block print:break-inside-avoid">
      <span className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {NOTE_LABELS[id]}
        <span className="normal-case tracking-normal">{saved ? "Saved on this phone" : "Autosaves here"}</span>
      </span>
      <textarea
        value={value}
        onChange={(e) => save(e.target.value)}
        rows={rows}
        placeholder="Write here…"
        className="mt-1.5 w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-base leading-relaxed print:min-h-[7rem]"
      />
    </label>
  );
}

const TOC = [
  { href: "#map", label: "The map" },
  { href: "#daily", label: "Every day" },
  { href: "#desks", label: "Desks" },
  { href: "#research", label: "Research" },
  { href: "#teach", label: "Teach him" },
  { href: "#mail", label: "Mail" },
  { href: "#loaded", label: "What’s loaded" },
  { href: "#info", label: "Paste info" },
  { href: "#ideas", label: "My ideas" },
] as const;

function exportNotes() {
  const data = loadNotes();
  const lines = ["PermitAIO agent workbook — my notes", ""];
  for (const [id, label] of Object.entries(NOTE_LABELS)) {
    const text = (data[id] ?? "").trim();
    if (!text) continue;
    lines.push(`## ${label}`, text, "");
  }
  if (lines.length === 2) lines.push("(no notes yet)");
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "permitaio-agent-notes.txt";
  a.click();
  URL.revokeObjectURL(url);
}

export function AgentWorkbook({ slug }: { slug: string }) {
  const mailboxes = mailboxesForShop(slug);
  return (
    <div className="space-y-8 print:space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <nav className="flex flex-wrap gap-2">
          {TOC.map((t) => (
            <a
              key={t.href}
              href={t.href}
              className="inline-flex h-9 items-center rounded-full border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              {t.label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          onClick={exportNotes}
          className="inline-flex h-9 items-center rounded-full border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
        >
          Download my notes
        </button>
        <PrintButton />
      </div>

      <section id="map" className="scroll-mt-20 space-y-3">
        <h2 className="font-heading text-xl font-semibold">The map</h2>
        <p className="text-base leading-relaxed">
          You do not run six chatbots. You run <strong>Xena</strong> (Warrior Manager). Desks are who techs
          talk to. Specialists are who Xena talks to. Mail agents do not chat — they match a job and
          ding the tech.
        </p>
        <div className="rounded-2xl border bg-muted/40 px-4 py-3 font-mono text-sm leading-7">
          You
          <br />
          → Ask PermitAIO (purple button)
          <br />
          → Main · Permit · Corrections · HOA · Support
          <br />
          → Xena (Warrior Manager) asks Investigator + Form Specialist when needed
          <br />
          → Permit mail / HOA mail ding the right tech
        </div>
        <p className="text-base leading-relaxed">
          He only answers from facts on file: jobs, HOA, Libraries, correction lessons, research reports.
          If it is not there, he says so. He does not change status by himself.
        </p>
      </section>

      <section id="daily" className="scroll-mt-20 space-y-3">
        <h2 className="font-heading text-xl font-semibold">Every day</h2>
        <div className="overflow-hidden rounded-2xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 font-semibold">When</th>
                <th className="px-3 py-2 font-semibold">Open</th>
                <th className="px-3 py-2 font-semibold">Say</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-3 py-2">On the phone</td>
                <td className="px-3 py-2 font-medium">Main</td>
                <td className="px-3 py-2">Job # or client name</td>
              </tr>
              <tr>
                <td className="px-3 py-2">Building a packet</td>
                <td className="px-3 py-2 font-medium">Permit</td>
                <td className="px-3 py-2">City + trade. Step by step.</td>
              </tr>
              <tr>
                <td className="px-3 py-2">Association question</td>
                <td className="px-3 py-2 font-medium">HOA</td>
                <td className="px-3 py-2">Association or job #</td>
              </tr>
              <tr>
                <td className="px-3 py-2">App broke</td>
                <td className="px-3 py-2 font-medium">Support</td>
                <td className="px-3 py-2">What you clicked. Waits for you.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted-foreground">
          Settings → their name → turn on Permit tech / HOA tech. Everyone sees Main.
        </p>
      </section>

      <section id="desks" className="scroll-mt-20 space-y-3">
        <h2 className="font-heading text-xl font-semibold">Desks — you talk here</h2>
        <div className="grid gap-3">
          {AGENTS.map((a) => (
            <article key={a.id} className="rounded-2xl border px-4 py-3 print:break-inside-avoid">
              <p className="text-base font-semibold">{a.name}</p>
              <p className="text-xs text-muted-foreground">{a.who}</p>
              <p className="mt-2 text-sm leading-relaxed">{a.use}</p>
              <p className="mt-1 text-sm">
                <span className="text-muted-foreground">Say: </span>
                {a.say}
              </p>
              <NoteBox id={a.note} rows={3} />
            </article>
          ))}
        </div>
      </section>

      <section id="research" className="scroll-mt-20 space-y-3">
        <h2 className="font-heading text-xl font-semibold">Research — he talks here</h2>
        <div className="grid gap-3">
          {SPECIALISTS.map((a) => (
            <article key={a.id} className="rounded-2xl border px-4 py-3 print:break-inside-avoid">
              <p className="text-base font-semibold">{a.name}</p>
              <p className="text-xs text-muted-foreground">{a.who}</p>
              <p className="mt-2 text-sm leading-relaxed">{a.use}</p>
              <NoteBox id={a.note} rows={3} />
            </article>
          ))}
        </div>
      </section>

      <section id="teach" className="scroll-mt-20 space-y-3">
        <h2 className="font-heading text-xl font-semibold">How you teach him</h2>
        <ol className="space-y-3">
          {TEACH_WAYS.map((t, i) => (
            <li key={t.title} className="rounded-2xl border px-4 py-3 print:break-inside-avoid">
              <p className="text-sm font-semibold">
                {i + 1}. {t.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed">{t.how}</p>
            </li>
          ))}
        </ol>
        <NoteBox id="teach" rows={5} />
        <NoteBox id="corrections" rows={4} />
        <NoteBox id="inspections" rows={6} />
      </section>

      <section id="mail" className="scroll-mt-20 space-y-3">
        <h2 className="font-heading text-xl font-semibold">Mail</h2>
        <p className="text-sm text-muted-foreground">
          “Client” means the company name. Guardian is{" "}
          <span className="font-medium text-foreground">guardian_permitagent@permitaio.com</span>. Create
          these as aliases on agent@permitaio.com.
        </p>
        <ul className="space-y-2">
          {mailboxes.map((m) => (
            <li key={m.addr} className="rounded-2xl border px-4 py-3 print:break-inside-avoid">
              <p className="break-all text-sm font-semibold">{m.addr}</p>
              <p className="mt-1 text-sm leading-relaxed">{m.job}</p>
            </li>
          ))}
        </ul>
        <NoteBox id="mail" rows={4} />
      </section>

      <section id="loaded" className="scroll-mt-20 space-y-3">
        <h2 className="font-heading text-xl font-semibold">What’s loaded</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border px-4 py-3">
            <p className="text-sm font-semibold">He has</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
              {LOADED.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border px-4 py-3">
            <p className="text-sm font-semibold">He does not have yet</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
              {NOT_LOADED.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="info" className="scroll-mt-20 space-y-3">
        <h2 className="font-heading text-xl font-semibold">Paste information</h2>
        <p className="text-sm text-muted-foreground">
          Dump checklists, inspection notes, city quirks, or ideas here so you don’t lose them. This box
          is <strong>your scratch pad</strong> — it does not teach him until you use Feed a research
          report, Feed a correction, or Libraries.
        </p>
        <NoteBox id="info" rows={14} />
        <NoteBox id="next" rows={6} />
      </section>

      <section id="ideas" className="scroll-mt-20 space-y-3 print:break-before-page">
        <h2 className="font-heading text-xl font-semibold">Room for you</h2>
        <p className="text-sm text-muted-foreground">
          These boxes save on this phone. Print the page if you want a paper copy. Nothing here is taught
          to him until you use Feed a research report / Feed a correction / Libraries.
        </p>
        <NoteBox id="ideas" rows={10} />
        <NoteBox id="notes" rows={10} />
      </section>
    </div>
  );
}
