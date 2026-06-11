"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  FolderKanban,
  GanttChartSquare,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import { can } from "@/lib/rbac";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  show?: (role: Role) => boolean;
};

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/projects", label: "Projects", icon: FolderKanban },
      { href: "/portfolio", label: "Portfolio", icon: GanttChartSquare },
      { href: "/my-tasks", label: "My Tasks", icon: CheckSquare },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
    ],
  },
  {
    section: "Insights",
    items: [
      {
        href: "/reports",
        label: "Reports",
        icon: BarChart3,
        show: (r) => can(r, "report:view"),
      },
      {
        href: "/team",
        label: "Team Workload",
        icon: Users,
        show: (r) => can(r, "report:view"),
      },
    ],
  },
  {
    section: "Administration",
    items: [
      {
        href: "/admin/users",
        label: "Users & Roles",
        icon: ShieldCheck,
        show: (r) => can(r, "admin:users"),
      },
      {
        href: "/admin/audit",
        label: "Audit Log",
        icon: Settings,
        show: (r) => can(r, "admin:audit"),
      },
    ],
  },
];

export function AppSidebar({
  role,
  open,
  onClose,
}: {
  role: Role;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-card transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="brand-gradient flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white">
              ◆
            </div>
            <span className="font-semibold tracking-tight">Sharepoint</span>
          </Link>
          <button className="lg:hidden" onClick={onClose} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4 thin-scroll">
          {NAV.map((group) => {
            const items = group.items.filter(
              (item) => !item.show || item.show(role),
            );
            if (items.length === 0) return null;
            return (
              <div key={group.section}>
                <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.section}
                </p>
                <ul className="space-y-1">
                  {items.map((item) => {
                    const active =
                      pathname === item.href ||
                      pathname.startsWith(item.href + "/");
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            active
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="border-t p-4">
          <div className="rounded-lg brand-gradient-subtle p-3 text-xs">
            <p className="font-semibold">Need help?</p>
            <p className="mt-0.5 text-muted-foreground">
              See the docs for setup & deployment guides.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
