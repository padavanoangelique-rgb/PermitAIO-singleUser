import Link from "next/link";
import { PlaybookView } from "@/components/marketing/playbook-view";

export default function SettingsPlaybookPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 print:max-w-none">
      <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground print:hidden">
        ← Settings
      </Link>
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Team</p>
        <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight">Role tutorials</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Buttons to click, reports to print, agents to ask. Print a role and hand it over.
        </p>
      </header>
      <PlaybookView />
    </div>
  );
}
