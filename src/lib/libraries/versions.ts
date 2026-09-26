import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

type AnyClient = SupabaseClient<any, any, any>;

function table(supabase: AnyClient, name: string) {
  return (supabase as unknown as { from: (t: string) => any }).from(name);
}

/** Snapshot a library row. A missing versions table must not block the write. */
export async function snapshotLibraryEntry(
  supabase: AnyClient,
  row: {
    orgId: string | null;
    library: string;
    entryId: string;
    version: number;
    snapshot: Record<string, unknown>;
    changeNote?: string | null;
    authorId?: string | null;
    authorLabel?: string | null;
  },
) {
  const { error } = await table(supabase, "library_entry_versions").insert({
    org_id: row.orgId,
    library: row.library,
    entry_id: row.entryId,
    version: row.version,
    snapshot: row.snapshot,
    change_note: row.changeNote ?? null,
    author_id: row.authorId ?? null,
    author_label: row.authorLabel ?? null,
  });
  if (error && !/duplicate|already exists/i.test(error.message ?? "")) {
    console.error("library version snapshot failed", error.message);
  }
}
