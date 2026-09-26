import { NextResponse } from "next/server";
import { requireUser } from "@/lib/data/orgs";
import { createAdminClient } from "@/lib/supabase/admin";
import type { HoaSpineSeedRow } from "@/lib/hoa/spine";
import seed from "@/lib/hoa/spine-seed.json";

export const maxDuration = 60;

const BATCH = 250;

export async function POST() {
  await requireUser();

  const rows = seed as HoaSpineSeedRow[];
  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Admin client missing." }, { status: 500 });
  }

  const existing = await admin.from("hoa_spine").select("id", { count: "exact", head: true });
  if (existing.error) {
    return NextResponse.json(
      {
        error: existing.error.message,
        needSql: /hoa_spine|schema cache|does not exist/i.test(existing.error.message),
      },
      { status: 500 },
    );
  }

  let upserted = 0;
  let failed = "";

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH).map((row) => ({
      name: row.name,
      county: row.county,
      city: row.city,
      mgmt_co: row.mgmt_co,
      contact_name: row.contact_name,
      phone: row.phone,
      email: row.email,
      address: row.address,
    }));
    const { error, count } = await admin
      .from("hoa_spine")
      .upsert(chunk, { onConflict: "name_norm,county", count: "exact" });
    if (error) {
      const retry = await admin.from("hoa_spine").upsert(chunk, { count: "exact" });
      if (retry.error) {
        failed = retry.error.message;
        break;
      }
      upserted += retry.count ?? chunk.length;
      continue;
    }
    upserted += count ?? chunk.length;
  }

  if (failed) {
    return NextResponse.json(
      {
        error: failed,
        upserted,
        needSql: /hoa_spine|schema cache|does not exist|on conflict/i.test(failed),
      },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, total: rows.length, upserted });
}
