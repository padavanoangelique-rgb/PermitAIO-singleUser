import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center">
          <BrandLockup align="center" />
        </Link>
        {children}
      </div>
    </div>
  );
}
