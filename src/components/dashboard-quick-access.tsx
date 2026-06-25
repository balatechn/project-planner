"use client";

import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  Car,
  CheckSquare,
  Clock,
  FileText,
  FolderKanban,
  GraduationCap,
  HelpCircle,
  Layers,
  Megaphone,
  Users,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  href: string;
  external?: boolean;
  soon?: boolean;
};

function OutlookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20 4H4C2.9 4 2 4.9 2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
    </svg>
  );
}
function TeamsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-9 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zm9.93.19C19.43 14.71 22 15.73 22 18v2h-4v-2c0-1.27-.62-2.36-1.56-3.16A9.16 9.16 0 0 1 17.93 14.19z" />
    </svg>
  );
}
function OneDriveIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
    </svg>
  );
}

const ITEMS: Item[] = [
  { label: "Projects",     icon: FolderKanban,  color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-500/10",    href: "/projects" },
  { label: "My Tasks",     icon: CheckSquare,   color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", href: "/my-tasks" },
  { label: "Calendar",     icon: CalendarDays,  color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/10",  href: "/calendar" },
  { label: "Training",     icon: GraduationCap, color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-500/10",   href: "/training" },
  { label: "Rooms",        icon: Video,         color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10",  href: "/meeting-rooms" },
  { label: "Reports",      icon: BarChart3,     color: "text-teal-600 dark:text-teal-400",     bg: "bg-teal-500/10",    href: "/reports" },
  { label: "Team",         icon: Users,         color: "text-pink-600 dark:text-pink-400",     bg: "bg-pink-500/10",    href: "/team" },
  { label: "Montra Sales", icon: Car,           color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10",  href: "/montra-sales" },
  { label: "Timesheets",   icon: Clock,         color: "text-slate-600 dark:text-slate-400",   bg: "bg-slate-500/10",   href: "/my-timesheets" },
  { label: "Templates",    icon: Layers,        color: "text-cyan-600 dark:text-cyan-400",     bg: "bg-cyan-500/10",    href: "/templates" },
  { label: "Files",        icon: FileText,      color: "text-lime-600 dark:text-lime-400",     bg: "bg-lime-500/10",    href: "/announcements" },
  { label: "Help",         icon: HelpCircle,    color: "text-gray-600 dark:text-gray-400",     bg: "bg-gray-500/10",    href: "/help" },
  {
    label: "Outlook", icon: OutlookIcon as unknown as React.ComponentType<{ className?: string }>,
    color: "text-[#0078D4]", bg: "bg-[#0078D4]/10",
    href: "https://outlook.office.com", external: true,
  },
  {
    label: "Teams", icon: TeamsIcon as unknown as React.ComponentType<{ className?: string }>,
    color: "text-[#6264A7]", bg: "bg-[#6264A7]/10",
    href: "https://teams.microsoft.com", external: true,
  },
  {
    label: "OneDrive", icon: OneDriveIcon as unknown as React.ComponentType<{ className?: string }>,
    color: "text-[#0364B8]", bg: "bg-[#0364B8]/10",
    href: "https://onedrive.live.com", external: true,
  },
  { label: "Announcements", icon: Megaphone, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", href: "/announcements" },
];

export function DashboardQuickAccess() {
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Quick Access
      </p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 lg:grid-cols-8">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const inner = (
            <div
              className={cn(
                "group flex flex-col items-center gap-2 rounded-xl border bg-card p-3 text-center",
                "transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/8 dark:hover:shadow-black/30",
                item.soon && "opacity-50 cursor-not-allowed pointer-events-none",
              )}
            >
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg transition-transform duration-150 group-hover:scale-110", item.bg, item.color)}>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <span className="text-[11px] font-medium leading-tight text-foreground/80">
                {item.label}
                {item.soon && <span className="block text-[9px] text-muted-foreground">Soon</span>}
              </span>
            </div>
          );

          if (item.soon) return <div key={item.label}>{inner}</div>;
          if (item.external) {
            return (
              <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer">
                {inner}
              </a>
            );
          }
          return <Link key={item.label} href={item.href}>{inner}</Link>;
        })}
      </div>
    </div>
  );
}
