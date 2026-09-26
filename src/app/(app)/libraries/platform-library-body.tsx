import { createClient } from "@/lib/supabase/server";
import { PlatformLibraryBoard } from "@/components/contractors/platform-library-board";
import type { RegistrationDoc, RegistrationPacket } from "@/lib/contractors/packets";

export async function PlatformLibraryBody({ isAdmin }: { isAdmin: boolean }) {
  const supabase = await createClient();
  const [packetsRes, docsRes] = await Promise.all([
    supabase.from("platform_registration_packets" as never).select("*").order("jurisdiction"),
    supabase.from("platform_registration_docs" as never).select("id, packet_id, title, kind, file_name"),
  ]);
  const packets = (packetsRes.error ? [] : (packetsRes.data as RegistrationPacket[] | null)) ?? [];
  const docs = (docsRes.error ? [] : (docsRes.data as RegistrationDoc[] | null)) ?? [];
  const missingTable = Boolean(packetsRes.error || docsRes.error);

  return <PlatformLibraryBoard packets={packets} docs={docs} isAdmin={isAdmin} missingTable={missingTable} />;
}
