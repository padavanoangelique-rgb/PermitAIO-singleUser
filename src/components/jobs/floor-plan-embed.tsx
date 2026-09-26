"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "next-themes";
import { Loader2 } from "lucide-react";

const OVERLAY_V = "20260923b";

// Ids of the overlay stylesheet / scripts injected into the editor after it loads.
const OVERLAY_IDS = [
  "floor-plan-theme-css",
  "floor-plan-grid-color-src",
  "floor-plan-egress-label-src",
  "floor-plan-cad-pdf-src",
  "wellington-schedule-src",
  "boca-schedule-src",
  "floor-plan-size-grid-src",
];

// Marks an injected element once it has finished (or failed) loading.
function trackLoad(el: HTMLElement) {
  const done = () => el.setAttribute("data-paio-loaded", "1");
  el.addEventListener("load", done);
  el.addEventListener("error", done);
}

function setNativeValue(field: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(field, value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

function injectScript(doc: Document, id: string, src: string) {
  const existing = doc.getElementById(id) as HTMLScriptElement | null;
  if (existing && existing.src.includes(OVERLAY_V)) return;
  if (existing) existing.remove();
  const script = doc.createElement("script");
  script.id = id;
  script.src = src;
  trackLoad(script);
  doc.body.appendChild(script);
}

function injectStylesheet(doc: Document, id: string, href: string) {
  let link = doc.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = doc.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    trackLoad(link);
    doc.head.appendChild(link);
  }
  link.href = href;
}

function lockPanel(doc: Document) {
  const panel = doc.getElementById("floorplan-panel");
  if (panel) {
    panel.classList.add("collapsed");
    panel.style.setProperty("width", "0", "important");
    panel.style.setProperty("min-width", "0", "important");
    panel.style.setProperty("max-width", "0", "important");
    panel.style.setProperty("overflow", "hidden", "important");
    panel.style.setProperty("opacity", "0", "important");
    panel.style.setProperty("pointer-events", "none", "important");
  }
  const btn = doc.getElementById("panel-collapse-btn");
  if (btn) btn.remove();
}

export function FloorPlanEmbed({
  orgId,
  jobId,
  isPlatformAdmin: isPlatformAdminProp = false,
}: {
  orgId: string;
  jobId: string;
  isPlatformAdmin?: boolean;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const tokenRef = useRef<string>("");
  const jobMetaRef = useRef<{ name: string; address: string; folio: string; jobNumber: string }>({
    name: "",
    address: "",
    folio: "",
    jobNumber: "",
  });
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { resolvedTheme } = useTheme();
  const themeRef = useRef<string>("light");
  const [ready, setReady] = useState(false);

  function currentTheme() {
    return themeRef.current === "dark" ? "dark" : "light";
  }

  // The editor file ships its original look and the overlay stylesheet/scripts
  // are injected after it loads, so the original design used to flash first.
  // Keep the frame hidden (spinner shown) until the overlay has loaded; falls
  // back after 3s so the editor can never stay hidden.
  function revealWhenOverlayReady() {
    const startedAt = Date.now();
    const check = () => {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) {
        setReady(true);
        return;
      }
      const loaded = OVERLAY_IDS.every(
        (id) => doc.getElementById(id)?.getAttribute("data-paio-loaded") === "1",
      );
      if (loaded || Date.now() - startedAt > 3000) {
        window.setTimeout(() => setReady(true), 150);
        return;
      }
      window.setTimeout(check, 40);
    };
    check();
  }

  function applyChrome(doc: Document) {
    doc.documentElement.dataset.theme = currentTheme();
    lockPanel(doc);
    injectStylesheet(doc, "floor-plan-theme-css", `/floor-plan-theme.css?v=${OVERLAY_V}`);
    injectScript(doc, "floor-plan-grid-color-src", `/floor-plan-grid-color.js?v=${OVERLAY_V}`);
    injectScript(doc, "floor-plan-egress-label-src", `/floor-plan-egress-label.js?v=${OVERLAY_V}`);
    injectScript(doc, "floor-plan-cad-pdf-src", `/floor-plan-cad-pdf.js?v=${OVERLAY_V}`);
    injectScript(doc, "wellington-schedule-src", `/wellington-schedule.js?v=${OVERLAY_V}`);
    injectScript(doc, "boca-schedule-src", `/boca-schedule.js?v=${OVERLAY_V}`);
    injectScript(doc, "floor-plan-size-grid-src", `/floor-plan-size-grid.js?v=${OVERLAY_V}`);
    injectScript(doc, "floor-plan-float-src", `/floor-plan-float.js?v=${OVERLAY_V}`);
    injectScript(doc, "pbc-schedule-src", `/pbc-schedule.js?v=${OVERLAY_V}`);
    injectScript(doc, "miami-schedule-src", `/miami-schedule.js?v=${OVERLAY_V}`);
    const nameEl = doc.getElementById("pi-name") as HTMLInputElement | null;
    const addrEl = doc.getElementById("pi-address") as HTMLInputElement | null;
    const { name, address, folio, jobNumber } = jobMetaRef.current;
    if (nameEl && name) setNativeValue(nameEl, name);
    if (addrEl && address) setNativeValue(addrEl, address);
    ["pi-pcn", "pi-job"].forEach((id) => {
      let el = doc.getElementById(id) as HTMLInputElement | null;
      if (!el) {
        el = doc.createElement("input");
        el.type = "hidden";
        el.id = id;
        doc.body.appendChild(el);
      }
      if (id === "pi-pcn" && folio) el.value = folio;
      if (id === "pi-job" && jobNumber) el.value = jobNumber;
    });
    return Boolean(nameEl || addrEl);
  }

  function applyJobHeader() {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return false;
    return applyChrome(doc);
  }

  useEffect(() => {
    if (!resolvedTheme) return;
    themeRef.current = resolvedTheme === "dark" ? "dark" : "light";
    applyJobHeader();
  }, [resolvedTheme]);

  useEffect(() => {
    const supabase = createClient();

    function buildSrc(token: string) {
      const params = new URLSearchParams({
        sb_url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        sb_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        access_token: token,
        org_id: orgId,
        job_id: jobId,
        theme: themeRef.current,
        is_platform_admin: isPlatformAdminProp ? "1" : "0",
        job_client: jobMetaRef.current.name,
        job_address: jobMetaRef.current.address,
        job_folio: jobMetaRef.current.folio,
        job_number: jobMetaRef.current.jobNumber,
      });
      return `/floor-plan-creator.html?${params.toString()}`;
    }

    if (!resolvedTheme) return;
    themeRef.current = resolvedTheme === "dark" ? "dark" : "light";

    Promise.all([
      supabase.auth.getSession(),
      supabase
        .from("jobs")
        .select("client_name, address, city, folio_number, job_number")
        .eq("id", jobId)
        .maybeSingle(),
    ]).then(([sessionRes, jobRes]) => {
      const token = sessionRes.data.session?.access_token ?? "";
      tokenRef.current = token;
      const job = jobRes.data;
      const addressParts = [job?.address, job?.city].filter(Boolean);
      jobMetaRef.current = {
        name: job?.client_name ?? "",
        address: addressParts.join(", "),
        folio: job?.folio_number ?? "",
        jobNumber: job?.job_number ?? "",
      };
      setReady(false);
      setSrc(buildSrc(token));
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "TOKEN_REFRESHED" || !session?.access_token) return;
      if (session.access_token === tokenRef.current) return;
      tokenRef.current = session.access_token;
      setReady(false);
      setSrc(buildSrc(session.access_token));
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [orgId, jobId, isPlatformAdminProp]);

  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/30">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <iframe
        ref={iframeRef}
        src={src}
        title="Floor Plan Builder"
        className="h-full w-full border-0"
        style={{ visibility: ready ? "visible" : "hidden" }}
        onLoad={() => {
          applyJobHeader();
          window.setTimeout(applyJobHeader, 200);
          window.setTimeout(applyJobHeader, 800);
          revealWhenOverlayReady();
        }}
      />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
