import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type ContractorStamp = {
  name: string;
  logoUrl: string | null;
  phone: string | null;
  email: string | null;
};

export async function contractorStampForOrg(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<ContractorStamp> {
  const { data: org } = await supabase.from("organizations").select("name").eq("id", orgId).maybeSingle();
  const { data: profile } = await supabase
    .from("contractor_profiles")
    .select("company_name, logo_url, phone, email, is_default")
    .eq("org_id", orgId)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();

  const logo = profile?.logo_url?.trim() || null;
  return {
    name: profile?.company_name?.trim() || org?.name?.trim() || "Your contractor",
    logoUrl: logo && (logo.startsWith("http") || logo.startsWith("/")) ? logo : null,
    phone: profile?.phone?.trim() || null,
    email: profile?.email?.trim() || null,
  };
}

export function stampFields(stamp: ContractorStamp) {
  return {
    contractorName: stamp.name,
    contractorLogo: stamp.logoUrl,
    contractorPhone: stamp.phone,
    contractorEmail: stamp.email,
  };
}
