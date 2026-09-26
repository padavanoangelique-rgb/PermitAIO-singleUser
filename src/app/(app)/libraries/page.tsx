import { requireActiveOrg } from "@/lib/data/orgs";
import { isPlatformAdmin } from "@/lib/data/platform-admin";
import { createClient } from "@/lib/supabase/server";
import { LibraryTabs } from "./library-tabs";
import { FormsLibraryBody } from "../forms-library/forms-library-body";
import { NoaLibraryBody } from "../noa-library/noa-library-body";
import { PlatformLibraryBody } from "./platform-library-body";
import { CorrectionsLibraryBody } from "./corrections-library-body";
import { ReviewQueue, type PendingUpdate } from "@/components/libraries/review-queue";

function from(supabase: Awaited<ReturnType<typeof createClient>>, name: string) {
  return (supabase as unknown as { from: (t: string) => any }).from(name);
}

export default async function LibrariesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { activeOrg } = await requireActiveOrg();
  const { tab } = await searchParams;
  const which =
    tab === "noa" ? "noa" : tab === "platform" ? "platform" : tab === "corrections" ? "corrections" : "forms";
  const admin = which === "platform" ? await isPlatformAdmin() : false;
  const supabase = await createClient();
  const pendingRes = await from(supabase, "proposed_updates")
    .select("id, kind, library, why, proposed, previous, author_label, created_at")
    .eq("org_id", activeOrg.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(30);
  const pending = (pendingRes.error ? [] : (pendingRes.data as PendingUpdate[] | null)) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Shared files</p>
          <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight">Libraries</h1>
          <p className="text-sm text-muted-foreground">
            Forms, NOAs, building departments, and corrections. Changes wait for review. Notes and dates do not.
          </p>
        </div>
        <LibraryTabs tab={which} />
      </div>
      <ReviewQueue rows={pending} />
      {which === "noa" ? (
        <NoaLibraryBody />
      ) : which === "platform" ? (
        <PlatformLibraryBody isAdmin={admin} />
      ) : which === "corrections" ? (
        <CorrectionsLibraryBody />
      ) : (
        <FormsLibraryBody />
      )}
    </div>
  );
}