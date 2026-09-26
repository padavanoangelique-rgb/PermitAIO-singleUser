"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export function SalesBot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      content: "Questions about PermitAIO? Trial, pricing, who it's for, how a job moves. I'll keep it short.",
    },
  ]);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next);
    setBusy(true);
    try {
      const res = await fetch("/api/chat/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      setMsgs([...next, { role: "assistant", content: data.reply || data.error || "Try again." }]);
    } catch {
      setMsgs([...next, { role: "assistant", content: "Network error." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-50 rounded-full border bg-background px-4 py-2 text-sm font-medium shadow-lg"
        >
          Ask about PermitAIO
        </button>
      )}
      {open && (
        <div className="fixed bottom-4 right-4 z-50 flex h-[26rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border bg-background shadow-xl">
          <div className="flex items-center border-b px-3 py-2 text-sm font-medium">
            PermitAIO
            <button type="button" onClick={() => setOpen(false)} className="ml-auto text-xs text-muted-foreground">
              Close
            </button>
          </div>
          <div className="flex-1 space-y-2 overflow-auto p-3 text-sm">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={m.role === "user" ? "ml-6 rounded-md bg-muted px-2 py-1" : "mr-6 text-muted-foreground"}
              >
                {m.content}
              </div>
            ))}
            {busy && <div className="text-xs text-muted-foreground">Thinking…</div>}
            <div ref={end} />
          </div>
          <form
            className="flex gap-2 border-t p-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Who is this for?"
              className="flex-1 rounded-md border bg-background px-2 py-1 text-sm"
            />
            <button type="submit" disabled={busy} className="text-sm font-medium">
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
