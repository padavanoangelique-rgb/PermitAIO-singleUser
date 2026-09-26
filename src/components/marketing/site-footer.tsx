import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";

const productLinks = [
  { href: "/", label: "Product" },
  { href: "/guides", label: "Guides" },
  { href: "/tutorials", label: "Tutorials" },
];

const accountLinks = [
  { href: "/signup", label: "Start free" },
  { href: "/join", label: "Join" },
  { href: "/login", label: "Sign in" },
];

const legalLinks = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
];

export function SiteFooter({ dark = false }: { dark?: boolean }) {
  const wrap = dark ? "bg-[#081224] text-[#f4efe4]" : "bg-background text-foreground";
  const muted = dark ? "text-[#f4efe4]/60 hover:text-[#f4efe4]" : "text-muted-foreground hover:text-foreground";
  const label = dark ? "text-[#c4a35a]" : "text-muted-foreground";

  return (
    <footer className={`px-4 py-14 sm:px-6 md:px-10 ${wrap}`}>
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <BrandLockup
              iconClassName={dark ? "h-6 w-6 text-[#c4a35a]" : "h-6 w-6 text-primary"}
              nameClassName={dark ? "font-heading text-lg font-semibold tracking-tight text-[#f4efe4]" : undefined}
              taglineClassName={dark ? "text-[10px] font-medium tracking-wide text-[#c4a35a] uppercase" : undefined}
            />
            <p className={`mt-3 max-w-sm text-sm ${dark ? "text-[#f4efe4]/60" : "text-muted-foreground"}`}>
              One job number, every permit tool connected. Built for windows
              and roofing contractors in Broward, Miami-Dade, and Palm Beach
              counties.
            </p>
          </div>

          {[
            ["Product", productLinks],
            ["Account", accountLinks],
            ["Legal", legalLinks],
          ].map(([title, links]) => (
            <div key={title as string}>
              <p className={`text-xs font-medium tracking-wide uppercase ${label}`}>{title as string}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {(links as { href: string; label: string }[]).map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={`transition-colors ${muted}`}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className={`mt-10 flex flex-col gap-2 pt-6 text-xs md:flex-row md:items-center md:justify-between ${dark ? "text-[#f4efe4]/50" : "text-muted-foreground"}`}>
          <p>© {new Date().getFullYear()} PermitAIO — All in One Permitting. All rights reserved.</p>
          <p>Hialeah, FL</p>
        </div>
      </div>
    </footer>
  );
}