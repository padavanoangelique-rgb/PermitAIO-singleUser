import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg } from "@/lib/data/orgs";
import { headers } from "next/headers";
import { ContractorsBoard } from "@/components/contractors/contractors-board";
import type { ContractorFile } from "@/components/contractors/doc-slots";
import type { ContractorRow, RegistrationDoc, RegistrationPacket } from "@/lib/contractors/packets";

export default async function ContractorsPage() {
  const { activeOrg } = await requireActiveOrg();
  const supabase = await createClient();
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || "permitaio.com";
  const proto = hdrs.get("x-forwarded-proto") || "https";

  const [{ data: contractors }, packetsRes, docsRes, filesRes] = await Promise.all([
    supabase.from("contractor_profiles").select("*").eq("org_id", activeOrg.id).order("company_name"),
    supabase.from("platform_registration_packets" as never).select("*").order("jurisdiction"),
    supabase.from("platform_registration_docs" as never).select("id, packet_id, title, kind, file_name"),
    supabase
      .from("contractor_files" as never)
      .select("id, contractor_id, file_name, storage_path, label, kind, expires_on")
      .eq("org_id", activeOrg.id)
      .order("uploaded_at", { ascending: false }),
  ]);

  let files = (filesRes.error ? [] : (filesRes.data as ContractorFile[] | null)) ?? [];
  if (filesRes.error && /kind/i.test(filesRes.error.message)) {
    const retry = await supabase
      .from("contractor_files" as never)
      .select("id, contractor_id, file_name, storage_path, label, expires_on")
      .eq("org_id", activeOrg.id)
      .order("uploaded_at", { ascending: false });
    files = (retry.data as ContractorFile[] | null) ?? [];
  }

  const packets = (packetsRes.error ? [] : (packetsRes.data as RegistrationPacket[] | null)) ?? [];
  const packetDocs = (docsRes.error ? [] : (docsRes.data as RegistrationDoc[] | null)) ?? [];

  return (
    <ContractorsBoard
      contractors={(contractors ?? []) as unknown as ContractorRow[]}
      files={files}
      packets={packets}
      packetDocs={packetDocs}
      orgId={activeOrg.id}
      origin={`${proto}://${host}`}
    />
  );
}
