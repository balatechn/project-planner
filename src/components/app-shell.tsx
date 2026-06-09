"use client";

import * as React from "react";
import type { Role } from "@prisma/client";
import { AppTopNav } from "@/components/app-topnav";

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
  return (
    <div className="flex min-h-screen flex-col">
      <AppTopNav user={user} />
      <main className="flex-1 animate-fade-in p-4 lg:p-6 max-w-screen-2xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
