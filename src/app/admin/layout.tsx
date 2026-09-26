import Link from "next/link";
import { requireUser } from "@/lib/data/orgs";
import { requirePlatformAdmin } from "@/lib/data/platform-admin";
import { BrandLockup } from "@/components/brand-lockup";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { Badge } from "@/components/ui/badge";
import { AdminTabs } from "./admin-tabs";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  await requirePlatformAdmin();

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/20">
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <BrandLockup iconClassName="h-6 w-6 text-primary" nameClassName="font-heading text-base font-semibold text-foreground" />
          </Link>
          <Badge variant="outline" className="text-xs font-medium">
            Owner Console
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Back to app
          </Link>
          <ThemeToggle />
          <UserMenu email={user.email ?? ""} role="owner" isPlatformAdmin />
        </div>
      </header>
      <div className="border-b bg-background px-4 sm:px-6">
        <AdminTabs />
      </div>
      <main className="w-full flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
