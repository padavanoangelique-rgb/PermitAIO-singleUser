"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatDesk } from "@/lib/chat/bots";
import { FILL_PURPLE } from "@/lib/ui/fills";

type Msg = { role: "user" | "assistant"; content: string };

const GREET: Record<ChatDesk, string> = {
  main: "Ask about any job or client. Or tell me like an assistant: make a note on 100137… / I submitted 86670-1, permit # …",
  permit: "Permit desk. Submittals, notes, status. “Make a note on job #…” or “I submitted 86670-1, permit # …”",
  hoa: "HOA desk. Contacts, notes, meetings, turnaround, that job's HOA side.",
  support: "Tech support. Tell me what broke. I'll log it for owner approval — nothing goes live until then.",
  corrections:
    "Corrections desk. Attach the letter or paste the city comment. I search this job, this city, past lessons, and the library. When the answer is right, say Save this.",
};

const PLACEHOLDER: Record<ChatDesk, string> = {
  main: "Job # — recap, a note, or change status…",
  permit: "Job # — note, submitted, permit #…",
  hoa: "HOA, job #, or contact…",
  support: "What broke…",
  corrections: "Ask, or attach the letter…",
};

const LABELS: Record<ChatDesk, string> = {
  main: "Main",
  permit: "Permit",
  hoa: "HOA",
  support: "Support",
  corrections: "Corrections",
};

function consultedLabel(id: string): string | null {
  if (id === "investigator") return "Investigator";
  if (id === "forms_specialist") return "Form Specialist";
  if (id === "hoa_scout") return "HOA Scout";
  if (id === "permit_scout") return "Permit Scout";
  return null;
}

export function PermitBots({
  desks,
}: {
  desks: { main: boolean; permit: boolean; hoa: boolean; support: boolean; corrections: boolean };
}) {
  const visible = (["main", "permit", "corrections", "hoa", "support"] as ChatDesk[]).filter((id) => desks[id]);
  const [open, setOpen] = useState(false);
  const [bot, setBot] = useState<ChatDesk>("main");
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Record<ChatDesk, Msg[]>>({
    main: [{ role: "assistant", content: GREET.main }],
    permit: [{ role: "assistant", content: GREET.permit }],
    hoa: [{ role: "assistant", content: GREET.hoa }],
    support: [{ role: "assistant", content: GREET.support }],
    corrections: [{ role: "assistant", content: GREET.corrections }],
  });
  const end = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, bot, open]);

  async function send() {
    const text = input.trim();
    if ((!text && !file) || busy) return;
    const shown = file ? `${text ? `${text}\n` : ""}Attached: ${file.name}` : text;
    setInput("");
    const attached = file;
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    const next = [...msgs[bot], { role: "user" as const, content: shown }];
    setMsgs((m) => ({ ...m, [bot]: next }));
    setBusy(true);
    try {
      let res: Response;
      if (attached) {
        const fd = new FormData();
        fd.set("bot", bot);
        fd.set("messages", JSON.stringify(next));
        fd.set("letter", attached);
        res = await fetch("/api/chat", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bot, messages: next }),
        });
      }
      const data = (await res.json()) as { reply?: string; error?: string; consulted?: string[] };
      const names =
        data.consulted?.map(consultedLabel).filter(Boolean).join(" + ") ?? "";
      const reply = data.reply || data.error || "Could not reach the desk.";
      const withCheck = names ? `Checked with ${names}.\n\n${reply}` : reply;
      setMsgs((m) => ({ ...m, [bot]: [...next, { role: "assistant", content: withCheck }] }));
    } catch {
      setMsgs((m) => ({
        ...m,
        [bot]: [...next, { role: "assistant", content: "Network error. Try again." }],
      }));
    } finally {
      setBusy(false);
    }
  }

  const desk = visible.includes(bot) ? bot : "main";
  const canAttach = desk === "corrections" || desk === "permit";

  return (
    <div className="print:hidden">
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`fixed bottom-4 right-4 z-50 ${FILL_PURPLE} rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg`}
        >
          Ask PermitAIO
        </button>
      )}
      {open && (
        <div className="fixed bottom-4 right-4 z-50 flex h-[min(36rem,calc(100dvh-2rem))] w-[min(26rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl border bg-background shadow-xl">
          <div className="shrink-0 border-b">
            <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
              <p className="text-sm font-semibold tracking-tight">Ask PermitAIO</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg leading-none text-muted-foreground hover:bg-muted"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="flex flex-wrap gap-1 px-2 pb-2 pt-1">
              {visible.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setBot(id)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    desk === id ? FILL_PURPLE : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {LABELS[id]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-2 overflow-auto p-3 text-sm">
            {msgs[desk].map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-8 whitespace-pre-wrap rounded-2xl bg-primary px-3 py-2 text-primary-foreground"
                    : "mr-6 whitespace-pre-wrap text-foreground"
                }
              >
                {m.content}
              </div>
            ))}
            {busy && <div className="text-xs text-muted-foreground">Looking it up…</div>}
            <div ref={end} />
          </div>
          <form
            className="border-t p-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            {file ? (
              <div className="mb-2 flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <button
                  type="button"
                  className="text-muted-foreground"
                  onClick={() => {
                    setFile(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  Remove
                </button>
              </div>
            ) : null}
            <div className="flex gap-2">
              {canAttach ? (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/pdf,image/*,.doc,.docx,.txt"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="h-10 shrink-0 rounded-full border px-3 text-sm font-medium"
                    aria-label="Attach letter"
                  >
                    Attach
                  </button>
                </>
              ) : null}
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={PLACEHOLDER[desk]}
                className="h-10 flex-1 rounded-full border border-border bg-background px-3 text-sm"
              />
              <button
                type="submit"
                disabled={busy}
                className={`h-10 rounded-full px-4 text-sm font-semibold ${FILL_PURPLE} disabled:opacity-50`}
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
