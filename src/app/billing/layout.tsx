import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import { ThemeToggle } from "@/components/theme-toggle";

export default function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/20">
      <header className="flex items-center justify-between border-b border-border bg-background px-6 py-4">
        <Link href="/">
          <BrandLockup />
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-5xl px-6 py-12">{children}</main>
    </div>
  );
}
