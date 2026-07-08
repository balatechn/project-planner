"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  Car,
  CheckSquare,
  ChevronDown,
  Clock,
  Database,
  FolderKanban,
  FolderTree,
  GanttChartSquare,
  GraduationCap,
  HelpCircle,
  Landmark,
  LayoutDashboard,
  UserCog,
  Layers,
  Menu,
  Megaphone,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
  Video,
  X,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import { can } from "@/lib/rbac";
import { Input } from "@/components/ui/input";
import { NotificationsBell } from "@/components/notifications-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  show?: (role: Role) => boolean;
  accent?: "amber";
  external?: boolean;
};

const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard",  icon: LayoutDashboard },
  { href: "/projects",  label: "Projects",   icon: FolderKanban    },
  { href: "/portfolio", label: "Portfolio",  icon: GanttChartSquare },
  { href: "/my-tasks",  label: "My Tasks",   icon: CheckSquare     },
  { href: "/calendar",       label: "Calendar",     icon: CalendarDays   },
  { href: "/training",       label: "Training",     icon: GraduationCap, accent: "amber" },
  { href: "/meeting-rooms",  label: "Rooms",        icon: Video          },
];

const MORE_NAV: NavItem[] = [
  { href: "https://finance.nationalgroupindia.com/", label: "Finance Portal", icon: Landmark, external: true },
  { href: "http://49.206.25.183:3000/login",         label: "HR Portal",      icon: UserCog,  external: true },
  { href: "/montra-sales",  label: "Montra Sales",   icon: Car         },
  { href: "/team",          label: "Team Directory", icon: Users       },
  { href: "/my-timesheets", label: "My Timesheets",  icon: Clock       },
  { href: "/templates",     label: "Templates",      icon: Layers      },
  { href: "/reports",       label: "Reports",        icon: BarChart3,  show: (r) => can(r, "report:view") },
  { href: "/help",          label: "Help & Guide",   icon: HelpCircle  },
  { href: "/announcements", label: "Announcements",  icon: Megaphone,  show: (r) => can(r, "admin:users") },
  { href: "/admin/masters",  label: "Masters",       icon: Database,   show: (r) => can(r, "admin:users") },
  { href: "/admin/explorer", label: "Explorer",      icon: FolderTree, show: (r) => can(r, "admin:users") },
  { href: "/admin/recycle-bin", label: "Recycle Bin", icon: Trash2,    show: (r) => can(r, "admin:users") },
  { href: "/admin/users",   label: "Users & Roles",  icon: ShieldCheck, show: (r) => can(r, "admin:users") },
  { href: "/admin/audit",   label: "Audit Log",      icon: Settings,   show: (r) => can(r, "admin:audit") },
];

export function AppTopNav({
  user,
}: {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: Role;
  };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const moreRef = React.useRef<HTMLDivElement>(null);

  const visibleMore = MORE_NAV.filter((item) => !item.show || item.show(user.role));

  // Close "More" dropdown when clicking outside
  React.useEffect(() => {
    function handle(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Close mobile menu on route change
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setQuery("");
    }
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      {/* ── Main top bar ── */}
      <header className="sticky top-0 z-40 w-full bg-[hsl(var(--background))] shadow-[0_4px_16px_var(--neu-dark),0_-2px_8px_var(--neu-light)]">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-2 px-4 lg:px-6">

          {/* Logo — National Group India */}
          <Link href="/dashboard" className="flex items-center gap-2 mr-3 flex-shrink-0">
            <Image
              src="https://nationalgroupindia.com/logo_full.webp"
              alt="National Group India"
              width={36}
              height={36}
              className="object-contain flex-shrink-0"
              priority
            />
            <div className="hidden sm:block leading-tight">
              <p className="text-sm font-bold tracking-tight text-foreground leading-none">
                National Group India
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none mt-0.5">
                Sharepoint
              </p>
            </div>
          </Link>

          {/* Desktop nav links — prefetch=true triggers route prefetch on hover */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1">
            {PRIMARY_NAV.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              const isAmber = item.accent === "amber";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  className={cn(
                    "relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all whitespace-nowrap",
                    isAmber
                      ? active
                        ? "text-amber-600 font-semibold [box-shadow:inset_2px_2px_5px_var(--neu-dark),inset_-2px_-2px_5px_var(--neu-light)] bg-[hsl(var(--background))]"
                        : "text-amber-600/70 hover:text-amber-600 hover:[box-shadow:var(--neu-shadow-xs)]"
                      : active
                        ? "text-primary font-semibold [box-shadow:inset_2px_2px_5px_var(--neu-dark),inset_-2px_-2px_5px_var(--neu-light)] bg-[hsl(var(--background))]"
                        : "text-muted-foreground hover:text-foreground hover:[box-shadow:var(--neu-shadow-xs)]",
                  )}
                >
                  <Icon className={cn("h-4 w-4 flex-shrink-0")} />
                  <span className="hidden lg:inline">{item.label}</span>
                  {active && (
                    <span className="absolute bottom-0 left-1/2 h-0.5 w-4/5 -translate-x-1/2 rounded-full bg-primary opacity-60" />
                  )}
                </Link>
              );
            })}

            {/* "More" dropdown */}
            {visibleMore.length > 0 && (
              <div className="relative" ref={moreRef}>
                <button
                  onClick={() => setMoreOpen((v) => !v)}
                  className={cn(
                    "flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    visibleMore.some((item) => isActive(item.href))
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <span className="hidden lg:inline">More</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", moreOpen && "rotate-180")} />
                </button>
                {moreOpen && (
                  <div className="absolute left-0 top-full mt-2 w-48 rounded-xl bg-[hsl(var(--background))] py-1 z-50 [box-shadow:var(--neu-shadow)]">
                    {visibleMore.map((item) => {
                      const active = !item.external && isActive(item.href);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMoreOpen(false)}
                          {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                            active
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-foreground hover:bg-muted",
                          )}
                        >
                          <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* Search */}
          <form onSubmit={onSearch} className="relative flex-1 max-w-xs hidden sm:block ml-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="pl-8 pr-12 h-8 text-sm bg-muted/50 border-0 focus-visible:bg-background focus-visible:border"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              Ctrl K
            </kbd>
          </form>

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-1">
            <NotificationsBell />
            <ThemeToggle />
            <div className="mx-1 h-5 w-px bg-border" />
            <UserMenu
              name={user.name}
              email={user.email}
              image={user.image}
              role={user.role}
            />
            {/* Mobile hamburger */}
            <button
              className="md:hidden ml-1 rounded-lg p-2 hover:bg-muted transition-colors"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-[hsl(var(--background))] [box-shadow:0_4px_16px_var(--neu-dark)]">
            {/* Mobile search */}
            <div className="px-4 pt-3 pb-1 sm:hidden">
              <form onSubmit={onSearch} className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search projects and tasks…"
                  className="pl-9"
                />
              </form>
            </div>
            <nav className="px-3 py-2 space-y-0.5">
              {[...PRIMARY_NAV, ...visibleMore].map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
