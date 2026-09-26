import "server-only";

export type GeoPoint = { lat: number; lng: number };

export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
    const q = address.trim();
    if (!q) return null;
    try {
          const url =
                  "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json&address=" +
                  encodeURIComponent(q);
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) return null;
          const json = (await res.json()) as {
                  result?: { addressMatches?: { coordinates?: { x?: number; y?: number } }[] };
          };
          const c = json.result?.addressMatches?.[0]?.coordinates;
          if (!c || typeof c.x !== "number" || typeof c.y !== "number") return null;
          return { lat: c.y, lng: c.x };
    } catch {
          return null;
    }
}
