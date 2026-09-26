import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg } from "@/lib/data/orgs";
import type { HoaSpineCard } from "./spine";

/** Copy a spine HOA into this org's tracker (or reuse the existing row). */
export async function adoptSpineHoa(spineId: string): Promise<{ id: string; name: string } | { error: string }> {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();

  const { data: spine, error: spineErr } = await supabase
    .from("hoa_spine")
    .select("id, name, city, county, mgmt_co, contact_name, phone, email, address")
    .eq("id", spineId)
    .maybeSingle();
  if (spineErr || !spine) return { error: spineErr?.message ?? "HOA not found in the directory." };

  const card = spine as HoaSpineCard;
  const { data: existing } = await supabase
    .from("hoas")
    .select("id, name")
    .eq("org_id", activeOrg.id)
    .ilike("name", card.name)
    .maybeSingle();
  if (existing) return { id: existing.id, name: existing.name };

  const notes = [card.county, card.city].filter(Boolean).join(" · ");
  const { data: inserted, error } = await supabase
    .from("hoas")
    .insert({
      org_id: activeOrg.id,
      name: card.name,
      mgmt_co: card.mgmt_co,
      contact_name: card.contact_name,
      phone: card.phone,
      email: card.email,
      address: card.address,
      notes,
    })
    .select("id, name")
    .single();
  if (error || !inserted) return { error: error?.message ?? "Couldn't add that HOA." };
  return inserted;
}
