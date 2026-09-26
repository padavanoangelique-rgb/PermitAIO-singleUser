"use client";

import { createElement as h, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// Job notes as a timestamped log: one entry per line, newest first, written as "[MM/DD/YY, h:mm AM] text".
// Older single-block notes still show up (each line is its own entry, without a stamp).
function stamp() {
  return new Date().toLocaleString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit", hour: "numeric", minute: "2-digit" });
}

export function JobNotesLog({ value, onSave }: { value: string | null; onSave: (next: string | null) => void }) {
  const [draft, setDraft] = useState("");
  const entries = (value ?? "").split("\n").map((line) => line.trim()).filter(Boolean);

function add() {
  const text = draft.replace(/\s+/g, " ").trim();
  if (!text) return;
  onSave(["[" + stamp() + "] " + text, ...entries].join("\n"));
  setDraft("");
}

function remove(index: number) {
  const next = entries.filter((_, i) => i !== index);
  onSave(next.length ? next.join("\n") : null);
}
  const rows = entries.map((line, index) => {
    const match = line.match(/^\[([^\]]+)\]\s*(.*)$/);
    return h(
      "li",
      { key: index, className: "flex items-start gap-2 rounded-lg bg-muted/40 px-2 py-1.5 text-sm" },
      h(
        "div",
        { className: "min-w-0 flex-1" },
        match ? h("p", { className: "text-[10px] font-medium uppercase tracking-wider text-muted-foreground" }, match[1]) : null,
        h("p", { className: "whitespace-pre-wrap break-words text-base" }, match ? match[2] : line),
        ),
      h(
        "button",
        {
          type: "button",
          title: "Remove note",
          className: "mt-0.5 text-muted-foreground hover:text-destructive",
          onClick: () => {
            if (confirm("Remove this note?")) remove(index);
          },
        },
        h(X, { className: "h-3.5 w-3.5" }),
        ),
      );
  });
  return h(
    "div",
    { className: "min-w-0 space-y-2" },
    rows.length > 0 ? h("ul", { className: "space-y-1.5" }, rows) : h("p", { className: "text-base text-muted-foreground" }, "No notes yet."),
    h(
      "div",
      { className: "flex items-start gap-2" },
      h(Textarea, {
        rows: 1,
        value: draft,
        placeholder: "Add a note…",
        className: "min-h-9 flex-1 border-0 bg-muted/40 px-2 shadow-none focus-visible:ring-0",
        onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
        onKeyDown: (e: { key: string; shiftKey: boolean; preventDefault: () => void }) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            add();
          }
        },
      }),
      h(Button, { type: "button", size: "sm", onClick: add, disabled: !draft.trim() }, h(Plus, { className: "h-3.5 w-3.5" }), "Add note"),
      ),
    );
}
