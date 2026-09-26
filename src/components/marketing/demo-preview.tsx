"use client";

import { useEffect, useRef, useState } from "react";

const DEMO_URL = "/demo/index.html";

const ROLES = [
  "Owner / Manager",
  "Permit Tech",
  "HOA Tech",
  "Sales",
  "Install",
  "Warehouse",
  "Service",
  "Measure",
  "Permit Runner",
  "Accounting",
  "Homeowner",
];

/**
 * Landing-page demo: looks like a video poster until clicked, then loads the interactive,
 * no-login demo in place. Can also be opened in a full tab or the browser's fullscreen.
 */
export function DemoPreview() {
  const [playing, setPlaying] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  // In the browser's full screen the demo has to fill the whole screen, not keep its in-page height.
  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFs(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function goFullscreen() {
    const el = frameRef.current;
    if (el && el.requestFullscreen) {
      el.requestFullscreen().catch(() => window.open(DEMO_URL, "_blank", "noopener"));
    } else {
      window.open(DEMO_URL, "_blank", "noopener");
    }
  }

  return (
    <section id="demo" className="px-4 py-16 sm:px-6 md:px-10 md:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex h-8 items-center rounded-full bg-primary/10 px-3 text-sm font-semibold text-primary">
            PermitAIO
          </p>
          <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight md:text-5xl">
            One job number, from measure to inspection.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-foreground">
            PermitAIO is the permit operating system for South Florida window, door and roofing contractors.
            Permits, HOA approvals, warehouse, install and accounting all run on the same job record, with a
            focused app for every role on your team.
          </p>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Try it below with sample data. Pick any role and click through, no login needed. Arrows walk you
            through it step by step.
          </p>
        </div>

        <div
          ref={frameRef}
          className={`mx-auto overflow-hidden border border-border bg-card shadow-xl ${
            isFs ? "flex h-screen w-screen flex-col rounded-none border-0" : "mt-10 rounded-2xl"
          }`}
        >
          <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
            <span className="size-3 rounded-full bg-red-400/80" aria-hidden />
            <span className="size-3 rounded-full bg-amber-400/80" aria-hidden />
            <span className="size-3 rounded-full bg-green-500/80" aria-hidden />
            <span className="ml-3 hidden truncate rounded-md bg-background px-3 py-1 text-xs text-muted-foreground sm:block">
              permitaio.com / demo
            </span>
            <span className="flex-1" />
            {playing ? (
              <>
                <button
                  type="button"
                  onClick={goFullscreen}
                  className="rounded-md border border-border bg-background px-3 py-1 text-xs font-semibold hover:bg-muted"
                >
                  Full screen
                </button>
                <a
                  href={DEMO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90"
                >
                  Open in new tab
                </a>
              </>
            ) : null}
          </div>

          {playing ? (
            <iframe
              title="PermitAIO interactive demo"
              src={DEMO_URL}
              className={`block w-full bg-background ${isFs ? "min-h-0 flex-1" : "h-[640px] md:h-[720px]"}`}
              allow="fullscreen"
              loading="lazy"
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label="Start the interactive demo"
              className="group relative block h-[420px] w-full overflow-hidden bg-gradient-to-br from-primary/15 via-background to-primary/5 text-left md:h-[520px]"
            >
              <div className="absolute inset-0 grid grid-cols-[180px_1fr] opacity-60 max-md:grid-cols-1" aria-hidden>
                <div className="hidden border-r border-border bg-card/70 p-4 md:block">
                  <div className="mb-4 h-6 w-24 rounded bg-primary/30" />
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="mb-2 h-7 rounded-lg bg-muted" />
                  ))}
                </div>
                <div className="p-5">
                  <div className="mb-4 flex flex-wrap gap-2">
                    {ROLES.map((r, i) => (
                      <span
                        key={r}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          i === 1 ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                        }`}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-16 rounded-xl border border-border bg-card" />
                    ))}
                  </div>
                  <div className="mt-4 h-40 rounded-xl border border-border bg-card" />
                </div>
              </div>

              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/40 px-6 text-center backdrop-blur-[1px]">
                <span className="grid size-20 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform group-hover:scale-110">
                  <svg viewBox="0 0 24 24" className="ml-1 size-9 fill-current" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                <span className="font-heading text-2xl font-semibold tracking-tight">Click to start the demo</span>
                <span className="max-w-md text-sm text-muted-foreground">
                  14 user types. Every app. Step-by-step arrows. Sample data only, nothing is saved.
                </span>
              </div>
            </button>
          )}
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Prefer a bigger screen?{" "}
          <a href={DEMO_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline-offset-4 hover:underline">
            Open the full-view demo
          </a>
        </p>
      </div>
    </section>
  );
}
