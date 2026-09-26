"use server";

import { requirePlatformAdmin } from "@/lib/data/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { snapshotLibraryEntry } from "@/lib/libraries/versions";

export type PacketInput = {
  county: string;
  jurisdiction: string;
  building_department: string;
  building_dept_email: string;
  instructions: string;
  registration_subject: string;
  registration_body: string;
  noc_subject: string;
  noc_body: string;
  public_portal_url?: string;
  noc_route?: string;
  noc_route_target?: string;
};

function revalidateAll() {
  revalidatePath("/libraries");
  revalidatePath("/contractors");
}

export async function saveRegistrationPacket(id: string | null, input: PacketInput) {
  await requirePlatformAdmin();
  const jurisdiction = input.jurisdiction.trim();
  if (!jurisdiction) return { error: "Pick a jurisdiction." };
  const admin = createAdminClient();
  const route = input.noc_route === "email" || input.noc_route === "portal" || input.noc_route === "address" ? input.noc_route : null;
  const row = {
    county: input.county.trim() || null,
    jurisdiction,
    building_department: input.building_department.trim() || null,
    building_dept_email: input.building_dept_email.trim() || null,
    instructions: input.instructions.trim() || null,
    registration_subject: input.registration_subject.trim() || null,
    registration_body: input.registration_body.trim() || null,
    noc_subject: input.noc_subject.trim() || null,
    noc_body: input.noc_body.trim() || null,
    public_portal_url: input.public_portal_url?.trim() || null,
    noc_route: route,
    noc_route_target: input.noc_route_target?.trim() || null,
    updated_at: new Date().toISOString(),
  };
  if (id) {
    const previous = await admin.from("platform_registration_packets" as never).select("*").eq("id", id).maybeSingle();
    const { error } = await admin.from("platform_registration_packets" as never).update(row as never).eq("id", id);
    if (error) return { error: error.message };
    const versions = (admin as unknown as { from: (t: string) => any })
      .from("library_entry_versions")
      .select("version")
      .eq("library", "building_department")
      .eq("entry_id", id)
      .order("version", { ascending: false })
      .limit(1);
    const latest = await versions;
    let version = Number(latest.data?.[0]?.version ?? 0);
    const prior = previous.data as Record<string, unknown> | null;
    if (prior && version === 0) {
      version += 1;
      await snapshotLibraryEntry(admin, {
        orgId: null,
        library: "building_department",
        entryId: id,
        version,
        snapshot: prior,
        changeNote: "Previous building department packet.",
        authorLabel: "platform admin",
      });
    }
    version += 1;
    await snapshotLibraryEntry(admin, {
      orgId: null,
      library: "building_department",
      entryId: id,
      version,
      snapshot: row,
      changeNote: "Building department packet saved.",
      authorLabel: "platform admin",
    });
    revalidateAll();
    return { error: null, id };
  }
  const { data, error } = await admin
    .from("platform_registration_packets" as never)
    .insert(row as never)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  revalidateAll();
  return { error: null, id: (data as { id: string } | null)?.id ?? null };
}

export async function deleteRegistrationPacket(id: string) {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("platform_registration_packets" as never).delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return { error: null };
}

export async function addRegistrationDoc(packetId: string, input: { title: string; kind: string; fileName: string; fileData: string }) {
  await requirePlatformAdmin();
  if (!input.fileData) return { error: "Choose a file." };
  const admin = createAdminClient();
  const { error } = await admin.from("platform_registration_docs" as never).insert({
    packet_id: packetId,
    title: input.title.trim() || input.fileName,
    kind: input.kind || "registration",
    file_name: input.fileName,
    file_data: input.fileData,
  } as never);
  if (error) return { error: error.message };
  revalidateAll();
  return { error: null };
}

export async function deleteRegistrationDoc(id: string) {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("platform_registration_docs" as never).delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAll();
  return { error: null };
}
