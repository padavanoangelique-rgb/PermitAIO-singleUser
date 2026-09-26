"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function AdminTabs() {
  const pathname = usePathname();
  const tabs = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/trials", label: "Trials & Billing" },
    { href: "/admin/roles", label: "Role Seats" },
    { href: "/admin/install", label: "Install Dashboard" },
    { href: "/admin/service", label: "Service" },
    { href: "/admin/forms", label: "Forms" },
    { href: "/admin/noa", label: "NOA Library" },
    { href: "/admin/requirements", label: "Requirements" },
    { href: "/admin/hoa", label: "HOA Directory" },
    { href: "/admin/email-agent", label: "Email Agent" },
    { href: "/admin/xena", label: "Xena" },
    { href: "/admin/assistant", label: "Assistant" },
    { href: "/admin/sheets", label: "Sheets" },
  ];

  return (
    <nav className="flex items-center gap-1 border-b" aria-label="Owner console sections">
      {tabs.map((tab) => {
        const isActive =
          tab.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "relative -mb-px inline-flex h-10 items-center px-4 text-sm font-medium transition-colors",
              isActive
                ? "border-b-2 border-primary text-foreground"
                : "border-b-2 border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
