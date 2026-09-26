"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ROLE_GUIDES, roleGuideBySlug } from "@/lib/marketing/role-guides";
import { FILL_BLUE, FILL_GREEN, FILL_PURPLE } from "@/lib/ui/fills";

export function RoleGuideChart({
  initialSlug = "sales",
  linkMode = "path",
  dark = false,
}: {
  initialSlug?: string;
  linkMode?: "path" | "hash";
  dark?: boolean;
}) {
  const [slug, setSlug] = useState(initialSlug);

  useEffect(() => {
    const fromHash = window.location.hash.replace(/^#/, "");
    const fromPath = window.location.pathname.split("/").filter(Boolean).pop();
    const candidate = fromHash || fromPath;
    if (candidate && ROLE_GUIDES.some((r) => r.slug === candidate)) setSlug(candidate);
  }, []);

  function select(next: string) {
    setSlug(next);
    if (typeof window === "undefined") return;
    if (linkMode === "hash") {
      window.history.replaceState(null, "", `/#${next}`);
    } else {
      window.history.replaceState(null, "", `/guides/${next}`);
    }
  }

  const role = roleGuideBySlug(slug);
  const fills = [FILL_PURPLE, FILL_BLUE, FILL_GREEN];
  const head = "text-primary";
  const body = "text-foreground/90";
  const mute = "text-muted-foreground";

  return (
    <div id="roles" className="scroll-mt-16">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {ROLE_GUIDES.map((r, i) => {
          const on = r.slug === role.slug;
          return (
            <button
              key={r.slug}
              type="button"
              onClick={() => select(r.slug)}
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

      <div className="mt-6">
        <p className={`text-xs font-semibold tracking-wide uppercase ${head}`}>{role.app}</p>
        <h3 className="mt-1 font-heading text-2xl font-semibold tracking-tight">{role.role}</h3>
        <p className={`mt-3 max-w-3xl ${mute}`}>{role.purpose}</p>

        <div className="mt-4 text-sm">
          {role.login ? (
            <Link href="/login" className={`font-medium underline-offset-4 hover:underline ${head}`}>
              Open PermitAIO login
            </Link>
          ) : (
            <span className={mute}>No office login — wait for the contractor link.</span>
          )}
        </div>

        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <h4 className={`text-xs font-semibold uppercase tracking-wide ${head}`}>This app</h4>
            <ul className={`mt-3 space-y-2 text-sm ${body}`}>
              {role.features.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className={`text-xs font-semibold uppercase tracking-wide ${head}`}>You can</h4>
            <ul className={`mt-3 space-y-2 text-sm ${body}`}>
              {role.can.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h4 className={`mt-6 text-xs font-semibold uppercase tracking-wide ${head}`}>How to use</h4>
            <ol className={`mt-3 list-decimal space-y-2 pl-5 text-sm ${body}`}>
              {role.how.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
          <div>
            <h4 className={`text-xs font-semibold uppercase tracking-wide ${head}`}>Never</h4>
            <ul className={`mt-3 space-y-2 text-sm ${body}`}>
              {role.never.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}