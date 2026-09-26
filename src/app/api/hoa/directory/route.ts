import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/orgs";
import { HOA_SEARCH_LIMIT, spineSearchFilter } from "@/lib/hoa/spine";

export async function GET(request: Request) {
  await requireUser();
  const supabase = await createClient();
  const url = new URL(request.url);

  if (url.searchParams.get("stats") === "1") {
    const { count, error } = await supabase.from("hoa_spine").select("id", { count: "exact", head: true });
    if (error) return NextResponse.json({ total: 0, error: error.message }, { status: 500 });
    return NextResponse.json({ total: count ?? 0 });
  }

  const q = spineSearchFilter(url.searchParams.get("q") ?? "");
  const county = (url.searchParams.get("county") ?? "").trim();
  const city = (url.searchParams.get("city") ?? "").trim();

  if (!county && q.length < 2) {
    return NextResponse.json({ rows: [], total: 0, note: "Pick a county or type at least 2 letters." });
  }

  let query = supabase
    .from("hoa_spine")
    .select("id, name, city, county, mgmt_co, contact_name, phone, email, address")
    .order("name")
    .limit(HOA_SEARCH_LIMIT);

  let countQuery = supabase.from("hoa_spine").select("id", { count: "exact", head: true });

  if (county) {
    query = query.eq("county", county);
    countQuery = countQuery.eq("county", county);
  }
  if (city) {
    query = query.ilike("city", city);
    countQuery = countQuery.ilike("city", city);
  }
  if (q.length >= 2) {
    const filter = `name.ilike.%${q}%,mgmt_co.ilike.%${q}%,city.ilike.%${q}%`;
    query = query.or(filter);
    countQuery = countQuery.or(filter);
  }

  const [{ data, error }, counted] = await Promise.all([query, countQuery]);
  if (error) {
    return NextResponse.json({ rows: [], total: 0, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rows: data ?? [], total: counted.count ?? 0 });
}
