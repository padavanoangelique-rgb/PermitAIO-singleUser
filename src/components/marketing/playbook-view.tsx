"use client";

import { useState } from "react";
import { EVERYONE_AGENTS, PLAYBOOK, playbookBySlug } from "@/lib/marketing/playbook";
import { FILL_BLUE, FILL_GREEN, FILL_PURPLE } from "@/lib/ui/fills";

export function PlaybookView({ initialSlug = "admin" }: { initialSlug?: string }) {
  const [slug, setSlug] = useState(initialSlug);
  const role = playbookBySlug(slug);
  const fills = [FILL_BLUE, FILL_PURPLE, FILL_GREEN];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <p className="text-sm text-muted-foreground">Pick a role. Print that page. Keep it by the desk.</p>
        <button
          type="button"
          onClick={() => window.print()}
          className={`inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold shadow-sm ${FILL_BLUE}`}
        >
          Print this role
        </button>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 print:hidden sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {PLAYBOOK.map((r, i) => {
          const on = r.slug === role.slug;
          return (
            <button
              key={r.slug}
              type="button"
              onClick={() => setSlug(r.slug)}
              className={
                on
                  ? `rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap shadow-sm ${fills[i % fills.length]}`
                  : "rounded-full bg-muted px-3.5 py-1.5 text-sm font-medium text-muted-foreground whitespace-nowrap"
              }
            >
              {r.role}
            </button>
          );
        })}
      </div>

      <article className="space-y-6">
        <header className="border-b pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {role.stage} · lands on {role.lands}
          </p>
          <h2 className="mt-1 font-heading text-3xl font-semibold tracking-tight">{role.role}</h2>
        </header>

        <section>
          <h3 className="font-heading text-lg font-semibold">First time</h3>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-base leading-relaxed">
            {role.first.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>

        {role.clicks.map((block) => (
          <section key={block.title}>
            <h3 className="font-heading text-lg font-semibold">{block.title}</h3>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-base leading-relaxed">
              {block.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </section>
        ))}

        <section>
          <h3 className="font-heading text-lg font-semibold">Reports</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-base leading-relaxed">
            {role.reports.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="font-heading text-lg font-semibold">Agents</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-base leading-relaxed">
            {role.agents.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="font-heading text-lg font-semibold">Never</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-base leading-relaxed">
            {role.never.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      </article>

      <section className="border-t pt-6">
        <h3 className="font-heading text-lg font-semibold">Everyone — Ask PermitAIO</h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-base leading-relaxed">
          {EVERYONE_AGENTS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
