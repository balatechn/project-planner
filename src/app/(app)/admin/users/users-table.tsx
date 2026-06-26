"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { Download, Loader2, RefreshCw, Search } from "lucide-react";
import type { Role } from "@prisma/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { initials } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/constants";

type Masters = {
  entities: string[];
  locations: string[];
  departments: string[];
  designations: string[];
};

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: Role;
  department: string | null;
  jobTitle: string | null;
  entity: string | null;
  location: string | null;
  lastLoginAt: string | null;
  isActive: boolean;
};

const NONE = "__none__";

export function UsersTable({
  users,
  masters,
}: {
  users: UserRow[];
  masters: Masters;
}) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState(users);
  const [query, setQuery] = React.useState("");
  const [entityFilter, setEntityFilter] = React.useState("all");
  const [roleFilter, setRoleFilter] = React.useState("all");
  const [syncing, setSyncing] = React.useState(false);

  async function syncMicrosoft() {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/users/sync-microsoft", { method: "POST" });
      if (res.ok) {
        const d = await res.json();
        toast({
          title: `Sync complete — ${d.created} new user${d.created !== 1 ? "s" : ""} added`,
          description: `${d.skipped} already existed · ${d.total} total in directory`,
          variant: "success",
        });
        if (d.created > 0) window.location.reload();
      } else {
        const e = await res.json();
        toast({ title: "Sync failed", description: e.error, variant: "error" });
      }
    } finally {
      setSyncing(false);
    }
  }

  async function patch(id: string, data: Partial<UserRow>) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setRows((r) => r.map((u) => (u.id === id ? { ...u, ...data } : u)));
      toast({ title: "User updated", variant: "success" });
    } else {
      toast({ title: "Update failed", variant: "error" });
    }
  }

  const q = query.trim().toLowerCase();
  const visible = rows.filter((u) => {
    if (q && !(u.name ?? "").toLowerCase().includes(q) && !u.email.toLowerCase().includes(q))
      return false;
    if (entityFilter !== "all" && u.entity !== (entityFilter === NONE ? null : entityFilter))
      return false;
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      {/* Toolbar: search, filters, export */}
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email…"
            className="h-8 w-56 pl-8 text-sm"
          />
        </div>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="h-8 w-44 text-sm">
            <SelectValue placeholder="Entity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entities</SelectItem>
            {masters.entities.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
            <SelectItem value={NONE}>Not set</SelectItem>
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="h-8 w-40 text-sm">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {Object.entries(ROLE_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {visible.length} of {rows.length}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={syncMicrosoft}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {syncing ? "Syncing…" : "Sync Microsoft"}
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8">
            <a href="/api/admin/users/export" download>
              <Download className="h-3.5 w-3.5" /> Export Excel
            </a>
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-3 py-3 font-medium">User</th>
              <th className="px-3 py-3 font-medium hidden md:table-cell">Entity</th>
              <th className="px-3 py-3 font-medium hidden lg:table-cell">Location</th>
              <th className="px-3 py-3 font-medium hidden md:table-cell">Department</th>
              <th className="px-3 py-3 font-medium hidden xl:table-cell">Designation</th>
              <th className="px-3 py-3 font-medium">Role</th>
              <th className="px-3 py-3 font-medium hidden xl:table-cell">Last sign-in</th>
              <th className="px-3 py-3 font-medium text-center">Active</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-8 w-8 shrink-0">
                      {u.image && <AvatarImage src={u.image} alt="" />}
                      <AvatarFallback className="text-[10px]">
                        {initials(u.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium truncate max-w-[160px]">{u.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[160px]">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 hidden md:table-cell">
                  <MasterSelect
                    value={u.entity}
                    options={masters.entities}
                    width="w-36"
                    onChange={(v) => patch(u.id, { entity: v })}
                  />
                </td>
                <td className="px-3 py-2.5 hidden lg:table-cell">
                  <MasterSelect
                    value={u.location}
                    options={masters.locations}
                    width="w-28"
                    onChange={(v) => patch(u.id, { location: v })}
                  />
                </td>
                <td className="px-3 py-2.5 hidden md:table-cell">
                  <MasterSelect
                    value={u.department}
                    options={masters.departments}
                    width="w-32"
                    onChange={(v) => patch(u.id, { department: v })}
                  />
                </td>
                <td className="px-3 py-2.5 hidden xl:table-cell">
                  <MasterSelect
                    value={u.jobTitle}
                    options={masters.designations}
                    width="w-32"
                    onChange={(v) => patch(u.id, { jobTitle: v })}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <Select
                    value={u.role}
                    onValueChange={(v) => patch(u.id, { role: v as Role })}
                  >
                    <SelectTrigger className="h-8 w-36 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2.5 hidden xl:table-cell whitespace-nowrap text-xs text-muted-foreground">
                  {u.lastLoginAt
                    ? formatDistanceToNow(new Date(u.lastLoginAt), { addSuffix: true })
                    : "Never"}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <Switch
                    checked={u.isActive}
                    onCheckedChange={(c) => patch(u.id, { isActive: c })}
                  />
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  No users match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Dropdown backed by a master list. Keeps legacy values visible. */
function MasterSelect({
  value,
  options,
  width,
  onChange,
}: {
  value: string | null;
  options: string[];
  width: string;
  onChange: (value: string | null) => void;
}) {
  // A value set before the master existed still shows correctly
  const all = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <Select
      value={value ?? NONE}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
    >
      <SelectTrigger className={`h-8 ${width} text-sm`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>—</SelectItem>
        {all.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
