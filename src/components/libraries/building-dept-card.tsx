"use client";

import { ExternalLink, Mail, MapPin, Phone } from "lucide-react";
import { FILL_BLUE, FILL_PURPLE } from "@/lib/ui/fills";
import { LIB_PILL } from "./county-fold";
import { linkify, parseContactNotes } from "@/lib/forms/contact-notes";

export function BuildingDeptCard({ notes, city }: { notes: string | null; city: string }) {
  const parsed = parseContactNotes(notes ?? "");
  const hasBody =
    parsed.address.length > 0 ||
    parsed.phone ||
    parsed.emails.length > 0 ||
    parsed.portalUrls.length > 0 ||
    parsed.extra;

  return (
    <div className="space-y-4 rounded-3xl bg-muted/40 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${LIB_PILL} ${FILL_PURPLE}`}>Building Department</span>
        <span className="text-sm text-muted-foreground">{city}</span>
      </div>

      {!hasBody ? (
        <p className="text-sm text-muted-foreground">No contact notes on file yet.</p>
      ) : null}

      {parsed.address.length > 0 ? (
        <div className="flex items-start gap-2 text-base">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="space-y-0.5">
            {parsed.address.map((ln) => (
              <div key={ln}>{ln}</div>
            ))}
          </div>
        </div>
      ) : null}

      {parsed.phone ? (
        <a
          href={`tel:${parsed.phone.replace(/[^0-9+]/g, "")}`}
          className={`${LIB_PILL} ${FILL_BLUE} w-fit`}
        >
          <Phone className="h-3.5 w-3.5" />
          {parsed.phone}
        </a>
      ) : null}

      {parsed.emails.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {parsed.emails.map((email) => (
            <a key={email} href={`mailto:${email}`} className={`${LIB_PILL} ${FILL_BLUE}`}>
              <Mail className="h-3.5 w-3.5" />
              {email}
            </a>
          ))}
        </div>
      ) : null}

      {parsed.portalUrls.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {parsed.portalUrls.map((p) => (
            <a
              key={`${p.label}-${p.url}`}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${LIB_PILL} h-10 ${FILL_BLUE}`}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {p.label === "Link" || p.label === "Portal" ? "Open portal" : p.label}
            </a>
          ))}
        </div>
      ) : null}

      {parsed.extra ? (
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {linkify(parsed.extra)}
        </div>
      ) : notes && !hasBody ? (
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {linkify(notes)}
        </div>
      ) : null}
    </div>
  );
}