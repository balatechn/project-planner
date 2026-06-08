"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Menu, Search } from "lucide-react";
import type { Role } from "@prisma/client";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { NotificationsBell } from "@/components/notifications-bell";
import { Input } from "@/components/ui/input";

export function AppShell({
  user,
  children,
}: {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: Role;
  };
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const router = useRouter();

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar
        role={user.role}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur lg:px-6">
          <button
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <form onSubmit={onSearch} className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects and tasks…"
              className="pl-9"
            />
          </form>

          <div className="ml-auto flex items-center gap-1">
            <NotificationsBell />
            <ThemeToggle />
            <div className="mx-1 h-6 w-px bg-border" />
            <UserMenu
              name={user.name}
              email={user.email}
              image={user.image}
              role={user.role}
            />
          </div>
        </header>

        <main className="flex-1 animate-fade-in p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
