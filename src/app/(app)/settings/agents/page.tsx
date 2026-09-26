import Link from "next/link";
import { redirect } from "next/navigation";
import { canManageOrg, requireActiveOrg } from "@/lib/data/orgs";
import { AgentWorkbook } from "./workbook";

export default async function AgentWorkbookPage() {
  const { role, activeOrg } = await requireActiveOrg();
  if (!canManageOrg(role)) redirect("/settings");

  return (
    <div className="mx-auto max-w-3xl space-y-6 print:max-w-none">
      <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground print:hidden">
        ← Settings
      </Link>
      <header className="border-b pb-4">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Owner / admin</p>
        <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">Agent workbook</h1>
        <p className="mt-2 text-base text-muted-foreground">
          How they are built, how you use them, how you teach them. Jump with the pills. Write in the
          boxes — they save on this phone.
        </p>
      </header>
      <AgentWorkbook slug={activeOrg.slug} />
    </div>
  );
}
