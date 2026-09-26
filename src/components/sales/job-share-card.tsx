"use client";

import { useState } from "react";
import { emailHomeownerLink } from "@/app/(app)/sales/actions";
import { BTN_BLUE, BTN_GREEN, FIELD } from "@/lib/ui/chrome";

export function JobShareCard({
  jobId,
  jobNumber,
  clientName,
  address,
  trackUrl,
  permitTitle,
  permitEta,
  hoaTitle,
  hoaEta,
  mail,
  returnTo,
  contractorName,
}: {
  jobId: string;
  jobNumber: string;
  clientName: string;
  address: string;
  trackUrl: string | null;
  permitTitle: string;
  permitEta: string;
  hoaTitle: string;
  hoaEta: string;
  mail?: string;
  returnTo: string;
  contractorName: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!trackUrl) return;
    await navigator.clipboard.writeText(trackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="space-y-3 px-1 py-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer status link</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Homeowner page is stamped as <span className="font-medium text-foreground">{contractorName}</span>. Copy for a text or email it.
          </p>
        </div>
        {mail ? <p className="text-sm text-emerald-700 dark:text-lime-300">{mail}</p> : null}
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl px-3 py-2">
          <dt className="text-xs text-muted-foreground">Permit</dt>
          <dd className="text-sm font-medium">{permitTitle}</dd>
          <dd className="mt-1 text-xs text-muted-foreground">ETA: {permitEta}</dd>
        </div>
        <div className="rounded-2xl px-3 py-2">
          <dt className="text-xs text-muted-foreground">HOA</dt>
          <dd className="text-sm font-medium">{hoaTitle}</dd>
          <dd className="mt-1 text-xs text-muted-foreground">ETA: {hoaEta}</dd>
        </div>
      </dl>

      {trackUrl ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-full bg-muted px-3 py-2 text-xs">{trackUrl}</code>
          <button type="button" onClick={() => void copyLink()} className={BTN_BLUE}>
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-amber-700">Run the homeowner_links SQL in Supabase so a token can be created.</p>
      )}

      <form action={emailHomeownerLink} className="mt-3 flex flex-wrap items-end gap-3">
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="jobNumber" value={jobNumber} />
        <input type="hidden" name="clientName" value={clientName} />
        <input type="hidden" name="address" value={address} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <label className="text-xs">
          Email to
          <input
            name="email"
            type="email"
            required
            placeholder="homeowner@email.com"
            className={`${FIELD} min-w-[240px]`}
          />
        </label>
        <button className={BTN_GREEN} type="submit">
          Send email
        </button>
      </form>
    </section>
  );
}
