"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Settings,
  Landmark,
  Boxes,
  Ruler,
  HardHat,
  Wrench,
  Package,
  CalendarClock,
  Handshake,
  Footprints,
  LayoutGrid,
  Library,
  PencilRuler,
  Receipt,
  LifeBuoy,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BrandLockup } from "@/components/brand-lockup";
import { Logo } from "@/components/logo";
import { OrgSwitcher } from "@/components/org-switcher";
import type { OrgMembership } from "@/lib/data/orgs";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  installOnly?: boolean;
  runnerOnly?: boolean;
  serviceOnly?: boolean;
};

const railItems: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Permit Builder", url: "/floor-plans", icon: Ruler },
  { title: "Permit Inventory", url: "/inventory", icon: Boxes },
  { title: "HOA Tracker", url: "/hoa", icon: Landmark },
  { title: "Contractors", url: "/contractors", icon: Building2 },
  { title: "Libraries", url: "/libraries", icon: Library },
];

const appItems: NavItem[] = [
  { title: "Measure Tech", url: "/measure", icon: PencilRuler },
  { title: "Sales", url: "/sales", icon: Handshake },
  { title: "Warehouse", url: "/warehouse", icon: Package },
  { title: "Tools", url: "/tools", icon: Wrench },
  { title: "Permit Runner", url: "/runner", icon: Footprints, runnerOnly: true },
];

const fieldItems: NavItem[] = [
  { title: "Install Dashboard", url: "/install", icon: HardHat, installOnly: true },
  { title: "Ready to schedule", url: "/install/schedule", icon: CalendarClock, installOnly: true },
  { title: "Service Dashboard", url: "/service", icon: LifeBuoy, serviceOnly: true },
];

const settingsItem: NavItem = { title: "Settings", url: "/settings", icon: Settings };
const accountingItem: NavItem = { title: "Accounting", url: "/accounting", icon: Receipt };

const installOnlyItems: NavItem[] = [{ title: "Install Dashboard", url: "/install", icon: HardHat }];
const runnerOnlyItems: NavItem[] = [{ title: "Permit Runner", url: "/runner", icon: Footprints }];
const serviceOnlyItems: NavItem[] = [{ title: "Service Dashboard", url: "/service", icon: LifeBuoy }];

function isActivePath(pathname: string, url: string) {
  return pathname === url || (url !== "/install" && pathname.startsWith(url + "/"));
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActivePath(pathname, item.url)} tooltip={item.title}>
        <Link href={item.url}>
          <item.icon />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar({
  memberships,
  activeSlug,
  showInstall = false,
  restrictToInstall = false,
  showRunner = false,
  restrictToRunner = false,
  showService = false,
  restrictToService = false,
  showAccounting = false,
}: {
  memberships: OrgMembership[];
  activeSlug: string;
  showInstall?: boolean;
  restrictToInstall?: boolean;
  showRunner?: boolean;
  restrictToRunner?: boolean;
  showService?: boolean;
  restrictToService?: boolean;
  showAccounting?: boolean;
}) {
  const pathname = usePathname();
  const restrictedItems = restrictToInstall
    ? installOnlyItems
    : restrictToRunner
      ? runnerOnlyItems
      : restrictToService
        ? serviceOnlyItems
        : null;
  const homeUrl = restrictToInstall ? "/install" : restrictToRunner ? "/runner" : restrictToService ? "/service" : "/dashboard";

  const visibleApps = appItems.filter((item) => !item.runnerOnly || showRunner);
  const visibleField = fieldItems.filter(
    (item) => (!item.installOnly || showInstall) && (!item.serviceOnly || showService),
  );
  const appActive = visibleApps.some((item) => isActivePath(pathname, item.url));

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader>
        <Link href={homeUrl} className="flex items-center justify-center rounded-md px-1 py-1.5 hover:bg-sidebar-accent">
          <span className="group-data-[collapsible=icon]:hidden">
            <BrandLockup
              iconClassName="h-6 w-6 text-sidebar-primary"
              nameClassName="font-heading text-base font-semibold text-sidebar-foreground"
              taglineClassName="text-[9px] font-medium tracking-wide text-sidebar-foreground/60 uppercase"
            />
          </span>
          <Logo className="hidden h-6 w-6 text-sidebar-primary group-data-[collapsible=icon]:block" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {restrictedItems ? (
          <SidebarGroup>
            <SidebarGroupLabel>Navigate</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {restrictedItems.map((item) => (
                  <NavLink key={item.title} item={item} pathname={pathname} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <>
            <SidebarGroup className="group-data-[collapsible=icon]:hidden">
              <SidebarGroupLabel className="flex items-center gap-1.5">
                <Landmark className="h-3.5 w-3.5" />
                Workspace
              </SidebarGroupLabel>
              <SidebarGroupContent className="px-2">
                <OrgSwitcher memberships={memberships} activeSlug={activeSlug} />
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Navigate</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {railItems.map((item) => (
                    <NavLink key={item.title} item={item} pathname={pathname} />
                  ))}

                  {visibleApps.length > 0 ? (
                    <SidebarMenuItem>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <SidebarMenuButton
                            isActive={appActive}
                            aria-label="Apps"
                            title="Apps"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                          >
                            <LayoutGrid />
                            <span>Apps</span>
                          </SidebarMenuButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="right" align="start" className="min-w-48">
                          <DropdownMenuLabel>Apps</DropdownMenuLabel>
                          {visibleApps.map((item) => (
                            <DropdownMenuItem key={item.title} asChild>
                              <Link href={item.url}>
                                <item.icon />
                                {item.title}
                              </Link>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </SidebarMenuItem>
                  ) : null}

                  {visibleField.map((item) => (
                    <NavLink key={item.title} item={item} pathname={pathname} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
      {restrictedItems ? null : (
        <SidebarFooter>
          <SidebarMenu>
            {showAccounting ? <NavLink item={accountingItem} pathname={pathname} /> : null}
            <NavLink item={settingsItem} pathname={pathname} />
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
