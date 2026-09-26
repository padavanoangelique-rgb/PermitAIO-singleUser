"use client";

import { useEffect, useState } from "react";
import { QUESTIONS } from "@/lib/admin/assistant-questions";

const STORAGE_KEY = "permitaio-admin-assistant-v1";

function loadAnswers(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function AssistantIntake() {
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setAnswers(loadAnswers());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
  }, [answers, ready]);

  const total = QUESTIONS.length;
  const done = step >= total;
  const current = step >= 0 && step < total ? QUESTIONS[step] : null;
  const filled = QUESTIONS.filter((q) => (answers[q.id] || "").trim()).length;

  function setAnswer(value: string) {
    if (!current) return;
    setAnswers((prev) => ({ ...prev, [current.id]: value }));
  }

  function download() {
    const blob = new Blob([scriptText(answers)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "virtual-assistant-answers.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(scriptText(answers));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  if (step < 0) {
    return (
      <section className="flex flex-col">
        <p className="text-base leading-relaxed text-foreground">
          One question at a time. Answer the way you would train a new hire: what they may say, and what they must not guess.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Sales, the demo, onboarding, and permit calls. {total} questions. Answers stay in this browser. Companies never see this page.
        </p>
        <button
          type="button"
          onClick={() => setStep(filled > 0 ? firstEmpty(answers) : 0)}
          className="mt-8 h-12 rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
        >
          {filled > 0 ? `Continue · ${filled} answered` : "Start"}
        </button>
      </section>
    );
  }

  if (current) {
    return (
      <section className="flex flex-col">
        <div className="mb-3 flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>{current.section}</span>
          <span>
            {step + 1} of {total}
          </span>
        </div>
        <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-border">
          <div className="h-full bg-primary" style={{ width: `${((step + 1) / total) * 100}%` }} />
        </div>
        <h2 className="font-heading text-xl font-semibold leading-snug text-foreground">{current.prompt}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{current.hint}</p>
        <textarea
          key={current.id}
          value={answers[current.id] || ""}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={current.placeholder}
          rows={7}
          className="mt-5 w-full resize-none rounded-lg border border-border bg-background px-3 py-3 text-base leading-relaxed text-foreground outline-none focus:border-primary"
        />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setStep((n) => Math.max(-1, n - 1))}
            className="h-12 rounded-lg border border-border bg-background text-sm font-semibold"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => setStep((n) => n + 1)}
            className="h-12 rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
          >
            {step === total - 1 ? "Finish" : "Next"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col">
      <h2 className="font-heading text-xl font-semibold text-foreground">That’s the employee.</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {filled} of {total} answered. Blank ones stay blank. It will not invent those.
      </p>
      <div className="mt-4 flex gap-3">
        <button type="button" onClick={copy} className="h-12 flex-1 rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
          {copied ? "Copied" : "Copy answers"}
        </button>
        <button type="button" onClick={download} className="h-12 flex-1 rounded-lg border border-border bg-background text-sm font-semibold">
          Download
        </button>
      </div>
      <ol className="mt-6 flex flex-col gap-4">
        {QUESTIONS.map((q, i) => (
          <li key={q.id}>
            <button type="button" onClick={() => setStep(i)} className="w-full rounded-lg border border-border bg-background px-3 py-3 text-left">
              <span className="block text-xs font-semibold text-primary">{q.section}</span>
              <span className="mt-1 block text-sm font-medium">{q.prompt}</span>
              <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                {(answers[q.id] || "").trim() || "Not answered"}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => setStep(0)} className="mt-4 h-12 rounded-lg border border-border text-sm font-semibold">
        Review from the first question
      </button>
    </section>
  );
}

function firstEmpty(answers: Record<string, string>) {
  const i = QUESTIONS.findIndex((q) => !(answers[q.id] || "").trim());
  return i === -1 ? QUESTIONS.length : i;
}

function scriptText(answers: Record<string, string>) {
  const lines = [
    "VIRTUAL ASSISTANT — ANSWERS",
    "Only say what is written here. If a line is blank, do not guess.",
    "",
  ];
  let section = "";
  for (const q of QUESTIONS) {
    if (q.section !== section) {
      section = q.section;
      lines.push("", section.toUpperCase(), "");
    }
    lines.push(q.prompt);
    lines.push((answers[q.id] || "").trim() || "(not answered)");
    lines.push("");
  }
  return lines.join("\n");
}
