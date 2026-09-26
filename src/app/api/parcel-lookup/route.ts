import { NextResponse } from "next/server";
import { lookupParcel, type ParcelCountyKey } from "@/lib/parcel/lookup";

const KEYS: ParcelCountyKey[] = ["miami-dade", "broward", "palm-beach"];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const county = url.searchParams.get("county") as ParcelCountyKey | null;
  const q = url.searchParams.get("q") ?? "";
  if (!county || !KEYS.includes(county)) {
    return NextResponse.json({ error: "county must be miami-dade, broward, or palm-beach" }, { status: 400 });
  }
  if (q.trim().length < 3) {
    return NextResponse.json({ results: [] });
  }
  try {
    const results = await lookupParcel(county, q);
    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lookup failed";
    return NextResponse.json({ error: message, results: [] }, { status: 502 });
  }
}
