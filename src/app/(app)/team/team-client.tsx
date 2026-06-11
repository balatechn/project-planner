"use client";

import * as React from "react";
import { Search, Users, Mail, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";

type Member = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  jobTitle: string | null;
  department: string | null;
  weeklyCapacity: number;
  createdAt: string;
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  PROJECT_MANAGER: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  TEAM_MEMBER: "bg-green-500/15 text-green-600 border-green-500/30",
  VIEWER: "bg-zinc-500/15 text-zinc-500 border-zinc-500/30",
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  TEAM_MEMBER: "Team Member",
  VIEWER: "Viewer",
};

function Initials({ name }: { name: string | null }) {
  const parts = (name ?? "?").split(" ").filter(Boolean);
  const letters = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : (name ?? "?").slice(0, 2);
  return <span className="text-sm font-semibold uppercase">{letters}</span>;
}

export function TeamDirectoryClient({
  members,
  departments,
}: {
  members: Member[];
  departments: string[];
}) {
  const [search, setSearch] = React.useState("");
  const [activeDept, setActiveDept] = React.useState("All");

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return members.filter((m) => {
      const matchDept = activeDept === "All" || m.department === activeDept;
      const matchQ =
        !q ||
        (m.name ?? "").toLowerCase().includes(q) ||
        (m.email ?? "").toLowerCase().includes(q) ||
        (m.jobTitle ?? "").toLowerCase().includes(q) ||
        (m.department ?? "").toLowerCase().includes(q);
      return matchDept && matchQ;
    });
  }, [members, search, activeDept]);

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Team Directory"
          description={`${members.length} active team member${members.length !== 1 ? "s" : ""}`}
        />
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team…"
            className="pl-9"
          />
        </div>
      </div>

      {/* Department filter */}
      {departments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {["All", ...departments].map((dept) => (
            <button
              key={dept}
              onClick={() => setActiveDept(dept)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                activeDept === dept
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-transparent bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {dept}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <Users className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">No members found</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((m) => (
          <div
            key={m.id}
            className="rounded-xl border bg-card p-5 space-y-3 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              {m.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.image}
                  alt={m.name ?? ""}
                  className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="h-12 w-12 rounded-full brand-gradient flex items-center justify-center flex-shrink-0">
                  <Initials name={m.name} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate">{m.name ?? "—"}</p>
                {m.jobTitle && (
                  <p className="text-xs text-muted-foreground truncate">{m.jobTitle}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-muted-foreground">
              {m.email && (
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                  <a
                    href={`mailto:${m.email}`}
                    className="truncate hover:text-foreground transition-colors"
                  >
                    {m.email}
                  </a>
                </div>
              )}
              {m.department && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{m.department}</span>
                </div>
              )}
            </div>

            <div className="flex items-center flex-wrap gap-1.5 pt-0.5">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                  ROLE_COLORS[m.role] ?? ROLE_COLORS.VIEWER,
                )}
              >
                {ROLE_LABELS[m.role] ?? m.role}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
