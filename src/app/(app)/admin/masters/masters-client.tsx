"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

type MasterTypeKey = "ENTITY" | "LOCATION" | "DEPARTMENT" | "DESIGNATION";
type Option = { id: string; type: MasterTypeKey; name: string; isActive: boolean };
type RoomRow = {
  id: string;
  name: string;
  floor: string | null;
  building: string | null;
  capacity: number;
  contactEmail: string | null;
  color: string;
  isActive: boolean;
};
type HolidayRow = { id: string; date: string; name: string };

const ROLE_MATRIX: string[][] = [
  ["Create / edit projects", "✅", "✅", "✅", "—"],
  ["Archive project", "✅", "✅", "—", "—"],
  ["Delete project", "✅", "—", "—", "—"],
  ["Create / edit / assign tasks", "✅", "✅", "✅", "—"],
  ["Delete task", "Any", "Own", "Own", "—"],
  ["Comment & attach files", "✅", "✅", "✅", "—"],
  ["View reports", "✅", "✅", "✅", "✅"],
  ["Export reports", "✅", "✅", "—", "—"],
  ["Manage templates", "✅", "✅", "—", "—"],
  ["Users, masters, audit, announcements", "✅", "—", "—", "—"],
];

export function MastersClient({
  options,
  rooms,
  holidays,
}: {
  options: Option[];
  rooms: RoomRow[];
  holidays: HolidayRow[];
}) {
  return (
    <Tabs defaultValue="ENTITY">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="ENTITY">Entities</TabsTrigger>
        <TabsTrigger value="LOCATION">Locations</TabsTrigger>
        <TabsTrigger value="DEPARTMENT">Departments</TabsTrigger>
        <TabsTrigger value="DESIGNATION">Designations</TabsTrigger>
        <TabsTrigger value="rooms">Meeting Rooms</TabsTrigger>
        <TabsTrigger value="holidays">Holidays</TabsTrigger>
        <TabsTrigger value="roles">Roles</TabsTrigger>
      </TabsList>

      {(["ENTITY", "LOCATION", "DEPARTMENT", "DESIGNATION"] as const).map((t) => (
        <TabsContent key={t} value={t}>
          <MasterList type={t} initial={options.filter((o) => o.type === t)} />
        </TabsContent>
      ))}

      <TabsContent value="rooms">
        <RoomsTab initial={rooms} />
      </TabsContent>

      <TabsContent value="holidays">
        <HolidaysTab initial={holidays} />
      </TabsContent>

      <TabsContent value="roles">
        <Card>
          <CardContent className="pt-5">
            <p className="mb-3 text-sm text-muted-foreground">
              Roles are built into the platform&apos;s security checks and cannot be
              edited here. Assign roles per user on the Users &amp; Roles page.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="px-3 py-2.5 font-semibold text-muted-foreground">Right</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground">Admin</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground">Project Manager</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground">Team Member</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground">Viewer</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ROLE_MATRIX.map((row) => (
                    <tr key={row[0]}>
                      {row.map((cell, i) => (
                        <td key={i} className={i === 0 ? "px-3 py-2" : "px-3 py-2 text-center text-muted-foreground"}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

/* ── Generic list master (Entity / Location / Department / Designation) ── */
function MasterList({ type, initial }: { type: MasterTypeKey; initial: Option[] }) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState(initial);
  const [newName, setNewName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Option | null>(null);

  async function add() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/masters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "Could not add value (duplicate?)");
      }
      const { option } = await res.json();
      setRows((r) => [...r, option]);
      setNewName("");
      toast({ title: "Added", variant: "success" });
    } catch (e) {
      toast({
        title: "Add failed",
        description: e instanceof Error ? e.message : undefined,
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, data: { name?: string; isActive?: boolean }) {
    const res = await fetch(`/api/admin/masters/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setRows((r) => r.map((o) => (o.id === id ? { ...o, ...data } : o)));
      toast({ title: "Updated", variant: "success" });
    } else {
      toast({ title: "Update failed", variant: "error" });
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/admin/masters/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRows((r) => r.filter((o) => o.id !== id));
      toast({ title: "Deleted", variant: "success" });
    } else {
      toast({ title: "Delete failed", variant: "error" });
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Add new value…"
            className="h-9 max-w-sm"
          />
          <Button variant="brand" size="sm" className="h-9" onClick={add} disabled={busy || !newName.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </Button>
        </div>

        <div className="divide-y rounded-lg border">
          {rows.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No values yet — add the first one above.
            </p>
          )}
          {rows.map((o) => (
            <div key={o.id} className="flex items-center gap-3 px-3 py-2">
              <NameCell value={o.name} onSave={(name) => patch(o.id, { name })} />
              <span className="ml-auto flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{o.isActive ? "Active" : "Hidden"}</span>
                <Switch
                  checked={o.isActive}
                  onCheckedChange={(c) => patch(o.id, { isActive: c })}
                />
                <button
                  onClick={() => setDeleteTarget(o)}
                  className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Hiding a value removes it from dropdowns but keeps it on existing records.
          Deleting removes it from this list only — existing records keep their text.
        </p>

        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title={`Delete "${deleteTarget?.name ?? ""}"?`}
          description="Existing users/projects keep this value as text; it just disappears from dropdowns."
          confirmLabel="Delete"
          onConfirm={async () => {
            if (deleteTarget) await remove(deleteTarget.id);
          }}
        />
      </CardContent>
    </Card>
  );
}

function NameCell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);
  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const v = draft.trim();
        if (v && v !== value) onSave(v);
        else setDraft(value);
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className="h-8 max-w-xs text-sm"
    />
  );
}

/* ── Meeting Rooms tab ── */
function RoomsTab({ initial }: { initial: RoomRow[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const [rows, setRows] = React.useState(initial);
  const [adding, setAdding] = React.useState(false);
  const [newRoom, setNewRoom] = React.useState({ name: "", capacity: "4" });

  async function patch(id: string, data: Partial<RoomRow>) {
    const res = await fetch(`/api/rooms/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setRows((r) => r.map((x) => (x.id === id ? { ...x, ...data } : x)));
      toast({ title: "Room updated", variant: "success" });
    } else {
      toast({ title: "Update failed", variant: "error" });
    }
  }

  async function addRoom() {
    if (!newRoom.name.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoom.name.trim(),
          capacity: Number(newRoom.capacity) || 4,
        }),
      });
      if (!res.ok) throw new Error("Create failed");
      const { room } = await res.json();
      setRows((r) => [...r, room]);
      setNewRoom({ name: "", capacity: "4" });
      toast({ title: "Room added", variant: "success" });
      router.refresh();
    } catch {
      toast({ title: "Could not add room", variant: "error" });
    } finally {
      setAdding(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex flex-wrap gap-2">
          <Input
            value={newRoom.name}
            onChange={(e) => setNewRoom((s) => ({ ...s, name: e.target.value }))}
            placeholder="New room name…"
            className="h-9 max-w-xs"
          />
          <Input
            type="number"
            min={1}
            value={newRoom.capacity}
            onChange={(e) => setNewRoom((s) => ({ ...s, capacity: e.target.value }))}
            placeholder="Seats"
            className="h-9 w-24"
          />
          <Button variant="brand" size="sm" className="h-9" onClick={addRoom} disabled={adding || !newRoom.name.trim()}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add room
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Room</th>
                <th className="px-3 py-2.5 font-medium">Capacity</th>
                <th className="px-3 py-2.5 font-medium hidden md:table-cell">Floor</th>
                <th className="px-3 py-2.5 font-medium hidden lg:table-cell">Notification email</th>
                <th className="px-3 py-2.5 font-medium">Colour</th>
                <th className="px-3 py-2.5 font-medium">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">
                    <NameCell value={r.name} onSave={(name) => patch(r.id, { name })} />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={1}
                      defaultValue={r.capacity}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v > 0 && v !== r.capacity) patch(r.id, { capacity: v });
                      }}
                      className="h-8 w-20 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell">
                    <NameCell value={r.floor ?? ""} onSave={(floor) => patch(r.id, { floor })} />
                  </td>
                  <td className="px-3 py-2 hidden lg:table-cell">
                    <NameCell
                      value={r.contactEmail ?? ""}
                      onSave={(contactEmail) => patch(r.id, { contactEmail })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="color"
                      defaultValue={r.color}
                      onBlur={(e) => e.target.value !== r.color && patch(r.id, { color: e.target.value })}
                      className="h-8 w-12 cursor-pointer rounded border bg-transparent"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Switch
                      checked={r.isActive}
                      onCheckedChange={(c) => patch(r.id, { isActive: c })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Deactivated rooms stop appearing on the booking page; existing bookings are kept.
        </p>
      </CardContent>
    </Card>
  );
}

/* ── Holidays tab ── */
function HolidaysTab({ initial }: { initial: HolidayRow[] }) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState(initial);
  const [date, setDate] = React.useState("");
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function add() {
    if (!date || !name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, name: name.trim() }),
      });
      if (!res.ok) throw new Error("Add failed (duplicate date?)");
      const { holiday } = await res.json();
      setRows((r) =>
        [...r, holiday].sort((a, b) => a.date.localeCompare(b.date)),
      );
      setDate("");
      setName("");
      toast({ title: "Holiday added", variant: "success" });
    } catch (e) {
      toast({
        title: "Could not add holiday",
        description: e instanceof Error ? e.message : undefined,
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/holidays/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRows((r) => r.filter((h) => h.id !== id));
      toast({ title: "Holiday removed", variant: "success" });
    } else {
      toast({ title: "Delete failed", variant: "error" });
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex flex-wrap gap-2">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 w-44"
          />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Holiday name (e.g. Diwali)…"
            className="h-9 max-w-xs"
          />
          <Button variant="brand" size="sm" className="h-9" onClick={add} disabled={busy || !date || !name.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add holiday
          </Button>
        </div>

        <div className="divide-y rounded-lg border">
          {rows.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No holidays yet — add the company calendar above.
            </p>
          )}
          {rows.map((h) => (
            <div key={h.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-32 text-sm font-medium whitespace-nowrap">
                {format(new Date(h.date), "dd MMM yyyy")}
              </span>
              <span className="text-sm text-muted-foreground">{h.name}</span>
              <button
                onClick={() => remove(h.id)}
                className="ml-auto rounded p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                title="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Holidays appear on everyone&apos;s calendar and warn users booking meeting rooms on those days.
        </p>
      </CardContent>
    </Card>
  );
}
