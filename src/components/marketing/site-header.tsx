"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";
import { ThemeToggle } from "@/components/theme-toggle";
import { FILL_BLUE } from "@/lib/ui/fills";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navLinks = [
  { href: "/", label: "Product" },
  { href: "/guides", label: "Guides" },
  { href: "/tutorials", label: "Tutorials" },
];

export function SiteHeader({ dark: _dark = false }: { dark?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 md:px-10">
        <Link href="/" aria-label="PermitAIO home" className="min-w-0 shrink">
          <BrandLockup
            iconClassName="h-6 w-6 text-primary"
            nameClassName="font-heading text-base font-semibold tracking-tight"
            taglineClassName="hidden sm:block text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
          />
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground lg:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className="hidden h-9 items-center rounded-full px-3 text-sm font-semibold sm:inline-flex">
            Sign in
          </Link>
          <Link href="/join" className={`hidden h-9 items-center rounded-full px-4 text-sm font-semibold shadow-sm sm:inline-flex ${FILL_BLUE}`}>
            Join
          </Link>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className="inline-flex h-10 w-10 items-center justify-center rounded-full lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(20rem,88vw)]">
              <SheetHeader>
                <SheetTitle>PermitAIO</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-3 py-3 text-base font-medium"
                  >
                    {link.label}
                  </Link>
                ))}
                <Link href="/login" onClick={() => setOpen(false)} className="mt-4 rounded-full border px-3 py-3 text-center text-sm font-semibold">
                  Sign in
                </Link>
                <Link href="/join" onClick={() => setOpen(false)} className={`rounded-full px-3 py-3 text-center text-sm font-semibold ${FILL_BLUE}`}>
                  Join
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}