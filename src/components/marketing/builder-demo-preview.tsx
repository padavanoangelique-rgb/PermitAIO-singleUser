"use client";

import { useEffect, useRef, useState } from "react";

const BUILDER_URL = "/demo/builder.html";

const STEPS = ["Draw walls", "Place windows and doors", "Type the sizes", "Auto-calc pressures", "See the schedule"];

/**
 * Second landing-page demo, under the main one: a hands-on Permit Builder sandbox. Visitors draw a floor plan,
 * place openings and get the county schedule. Nothing is saved or downloaded.
 */
export function BuilderDemoPreview() {
  const [playing, setPlaying] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onChange = () => setIsFs(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function goFullscreen() {
    const el = frameRef.current;
    if (el && el.requestFullscreen) {
      el.requestFullscreen().catch(() => window.open(BUILDER_URL, "_blank", "noopener"));
    } else {
      window.open(BUILDER_URL, "_blank", "noopener");
    }
  }

  return (
    <section id="builder-demo" className="scroll-mt-16 px-4 py-16 sm:px-6 md:px-10 md:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex h-8 items-center rounded-full bg-primary/10 px-3 text-sm font-semibold text-primary">
            Permit Builder
          </p>
          <h2 className="mt-4 font-heading text-3xl font-semibold tracking-tight md:text-4xl">
            Build a floor plan and see the schedule appear.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-foreground">
            Draw the walls, drop in windows and doors, type their sizes and press one button. The county window and
            door schedule fills itself in. Nothing you do here is saved or downloaded, so play with it.
          </p>
          <ul className="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-2 text-sm font-semibold">
            {STEPS.map((s, i) => (
              <li key={s} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
                <span className="grid size-5 place-items-center rounded-full bg-primary text-xs text-primary-foreground">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ul>
        </div>

        <div
          ref={frameRef}
          className={`mx-auto mt-10 overflow-hidden border border-border bg-card shadow-xl ${
            isFs ? "flex h-screen flex-col rounded-none" : "rounded-2xl"
          }`}
        >
          <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
            <span className="size-3 rounded-full bg-red-400/80" aria-hidden />
            <span className="size-3 rounded-full bg-amber-400/80" aria-hidden />
            <span className="size-3 rounded-full bg-green-500/80" aria-hidden />
            <span className="ml-3 hidden truncate rounded-md bg-background px-3 py-1 text-xs text-muted-foreground sm:block">
              permitaio.com / permit-builder
            </span>
            <span className="flex-1" />
            {playing ? (
              <>
                <button
                  type="button"
                  onClick={isFs ? () => document.exitFullscreen() : goFullscreen}
                  className="rounded-md border border-border bg-background px-3 py-1 text-xs font-semibold hover:bg-muted"
                >
                  {isFs ? "Exit full screen" : "Full screen"}
                </button>
                <a
                  href={BUILDER_URL}
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
              title="PermitAIO Permit Builder sandbox"
              src={BUILDER_URL}
              className={`block w-full bg-background ${isFs ? "min-h-0 flex-1" : "h-[760px] md:h-[820px]"}`}
              allow="fullscreen"
              loading="lazy"
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label="Start the Permit Builder sandbox"
              className="group relative block h-[380px] w-full overflow-hidden bg-gradient-to-br from-primary/15 via-background to-primary/5 text-left md:h-[460px]"
            >
              <div className="absolute inset-0 opacity-60" aria-hidden>
                <div className="relative m-6 h-[calc(100%-3rem)] rounded-xl border border-border bg-card">
                  <div className="absolute left-[14%] top-[22%] h-[52%] w-[46%] border-4 border-foreground/70" />
                  <div className="absolute left-[60%] top-[22%] h-[30%] w-[22%] border-4 border-foreground/70" />
                  <div className="absolute left-[24%] top-[20.5%] h-2 w-12 rounded bg-primary" />
                  <div className="absolute left-[46%] top-[20.5%] h-2 w-12 rounded bg-primary" />
                  <div className="absolute left-[80.5%] top-[36%] h-12 w-2 rounded bg-primary" />
                </div>
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/40 px-6 text-center backdrop-blur-[1px]">
                <span className="grid size-20 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform group-hover:scale-110">
                  <svg viewBox="0 0 24 24" className="ml-1 size-9 fill-current" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                <span className="font-heading text-2xl font-semibold tracking-tight">Click to build a floor plan</span>
                <span className="max-w-md text-sm text-muted-foreground">
                  Walls, windows, doors, mullions and the county schedule. Sample sandbox, nothing is saved.
                </span>
              </div>
            </button>
          )}
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Prefer a bigger screen?{" "}
          <a
            href={BUILDER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Open the full-view builder
          </a>
        </p>
      </div>
    </section>
  );
}
