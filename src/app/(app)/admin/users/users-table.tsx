"use client";

import * as React from "react";
import type { Role } from "@prisma/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: Role;
  department: string | null;
  jobTitle: string | null;
  isActive: boolean;
};

export function UsersTable({ users }: { users: UserRow[] }) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState(users);

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

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-4 py-3 font-medium">User</th>
            <th className="px-4 py-3 font-medium">Department</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Active</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className="border-b last:border-0">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    {u.image && <AvatarImage src={u.image} alt="" />}
                    <AvatarFallback className="text-[10px]">
                      {initials(u.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{u.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {u.department ?? "—"}
              </td>
              <td className="px-4 py-3">
                <Select
                  value={u.role}
                  onValueChange={(v) => patch(u.id, { role: v as Role })}
                >
                  <SelectTrigger className="w-44">
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
              <td className="px-4 py-3">
                <Switch
                  checked={u.isActive}
                  onCheckedChange={(c) => patch(u.id, { isActive: c })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
