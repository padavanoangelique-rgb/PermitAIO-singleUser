"use client";

import { createElement as h, useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { createClient } from "@/lib/supabase/client";

export type MapStop = { id: string; lat: number; lng: number; label: string; order: number };

type LeafletModule = typeof import("leaflet");

async function loadLeaflet(): Promise<LeafletModule> {
    const mod = (await import("leaflet")) as unknown as LeafletModule & { default?: LeafletModule };
    return mod.default ?? mod;
}

function ensureLeafletCss() {
    if (typeof document === "undefined" || document.getElementById("leaflet-css")) return;
    const link = document.createElement("link");
    link.id = "leaflet-css";
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
}

const STOP_STYLE =
    "background:#2563eb;color:#fff;border-radius:9999px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font:700 13px sans-serif;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)";
const TECH_STYLE =
    "background:#16a34a;color:#fff;border-radius:9999px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font:700 11px sans-serif;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)";

export function ServiceRouteMap({
    orgId,
    techId,
    techName,
    stops,
}: {
    orgId: string;
    techId: string;
    techName: string;
    stops: MapStop[];
}) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<LeafletMap | null>(null);
    const stopLayerRef = useRef<Marker[]>([]);
    const techMarkerRef = useRef<Marker | null>(null);
    const [ready, setReady] = useState(false);
    const [techSeen, setTechSeen] = useState<string>("");

  useEffect(() => {
        let cancelled = false;
        (async () => {
                ensureLeafletCss();
                const L = await loadLeaflet();
                if (cancelled || !containerRef.current || mapRef.current) return;
                const map = L.map(containerRef.current).setView([26.6, -80.1], 10);
                L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                          attribution: "&copy; OpenStreetMap contributors",
                          maxZoom: 19,
                }).addTo(map);
                mapRef.current = map;
                setReady(true);
        })();
        return () => {
                cancelled = true;
                if (mapRef.current) {
                          mapRef.current.remove();
                          mapRef.current = null;
                }
                techMarkerRef.current = null;
                stopLayerRef.current = [];
        };
  }, []);

  useEffect(() => {
        if (!ready) return;
        let cancelled = false;
        (async () => {
                const L = await loadLeaflet();
                const map = mapRef.current;
                if (cancelled || !map) return;
                for (const m of stopLayerRef.current) m.remove();
                stopLayerRef.current = [];
                const bounds: [number, number][] = [];
                for (const s of stops) {
                          const icon = L.divIcon({
                                      className: "",
                                      html: `<div style="${STOP_STYLE}">${s.order}</div>`,
                                      iconSize: [28, 28],
                                      iconAnchor: [14, 14],
                          });
                          const popup = document.createElement("span");
                          popup.textContent = `#${s.order} ${s.label}`;
                          const marker = L.marker([s.lat, s.lng], { icon }).addTo(map).bindPopup(popup);
                          stopLayerRef.current.push(marker);
                          bounds.push([s.lat, s.lng]);
                }
                if (techMarkerRef.current) bounds.push([techMarkerRef.current.getLatLng().lat, techMarkerRef.current.getLatLng().lng]);
                if (bounds.length > 0) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
        })();
        return () => {
                cancelled = true;
        };
  }, [ready, stops]);

  useEffect(() => {
        if (!ready || !techId) return;
        let cancelled = false;
        const supabase = createClient() as unknown as {
                from: (t: string) => {
                          select: (c: string) => {
                                      eq: (a: string, b: string) => {
                                                    eq: (a: string, b: string) => {
                                                                    maybeSingle: () => Promise<{ data: { lat: number; lng: number; updated_at: string } | null }>;
                                                    };
                                      };
                          };
                };
        };
        async function poll() {
                const res = await supabase
                  .from("service_tech_locations")
                  .select("lat, lng, updated_at")
                  .eq("org_id", orgId)
                  .eq("service_tech_id", techId)
                  .maybeSingle();
                const row = res.data;
                const map = mapRef.current;
                if (cancelled || !row || !map) return;
                const L = await loadLeaflet();
                const pos: [number, number] = [Number(row.lat), Number(row.lng)];
                if (techMarkerRef.current) {
                          techMarkerRef.current.setLatLng(pos);
                } else {
                          const icon = L.divIcon({
                                      className: "",
                                      html: `<div style="${TECH_STYLE}">TECH</div>`,
                                      iconSize: [32, 32],
                                      iconAnchor: [16, 16],
                          });
                          const popup = document.createElement("span");
                          popup.textContent = techName;
                          techMarkerRef.current = L.marker(pos, { icon, zIndexOffset: 1000 }).addTo(map).bindPopup(popup);
                }
                setTechSeen(new Date(row.updated_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
        }
        void poll();
        const interval = setInterval(() => void poll(), 30000);
        return () => {
                cancelled = true;
                clearInterval(interval);
        };
  }, [ready, orgId, techId, techName]);

  return h(
        "div",
    { className: "space-y-1" },
        h("div", { ref: containerRef, className: "h-72 w-full overflow-hidden rounded-2xl border" }),
        h(
                "p",
          { className: "text-xs text-muted-foreground" },
                techSeen ? `${techName} last seen ${techSeen}` : `${techName}: no location shared yet`,
              ),
      );
}
