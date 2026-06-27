"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { DEPARTMENTS } from "@/lib/constants";

type UserOption = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

const TIMELINE_PRESETS = [
  { label: "6 months", months: 6 },
  { label: "1 year",   months: 12 },
  { label: "2 years",  months: 24 },
  { label: "3 years",  months: 36 },
  { label: "Custom",   months: 0 },
];

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function toDateInput(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function NewProjectButton({
  users,
  currentUserId,
  currentUserName,
  currentUserEmail,
  autoOpen = false,
  entities,
  departments,
  locations,
}: {
  users: UserOption[];
  currentUserId: string;
  currentUserName?: string | null;
  currentUserEmail?: string | null;
  autoOpen?: boolean;
  /** Master-driven dropdown values; fall back to hardcoded lists */
  entities?: string[];
  departments?: string[];
  locations?: string[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  // ── Ensure the logged-in user always appears in the picker ──────────────
  const allUsers: UserOption[] = React.useMemo(() => {
    const alreadyIn = users.some((u) => u.id === currentUserId);
    if (alreadyIn) return users;
    return [
      {
        id: currentUserId,
        name: currentUserName ?? null,
        email: currentUserEmail ?? "me",
        image: null,
      },
      ...users,
    ];
  }, [users, currentUserId, currentUserName, currentUserEmail]);

  const today = toDateInput(new Date());

  const [open, setOpen] = React.useState(autoOpen);
  const [loading, setLoading] = React.useState(false);
  const [timelinePreset, setTimelinePreset] = React.useState("12");
  const [form, setForm] = React.useState({
    name: "",
    description: "",
    entity: "",
    department: "",
    location: "",
    priority: "MEDIUM",
    status: "PLANNING",
    startDate: today,
    endDate: toDateInput(addMonths(new Date(), 12)),
    budget: "",
    color: "#f59e0b",
    ownerId: currentUserId,
    projectManagerId: currentUserId,
  });
  // Project members — assignees are limited to this list later
  const [memberIds, setMemberIds] = React.useState<string[]>([]);
  const [memberSearch, setMemberSearch] = React.useState("");

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function applyPreset(months: string) {
    setTimelinePreset(months);
    const m = parseInt(months, 10);
    if (m > 0) {
      const start = form.startDate ? new Date(form.startDate) : new Date();
      update("endDate", toDateInput(addMonths(start, m)));
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    // Clean up ?new=1 from the URL when the dialog closes
    if (!next && autoOpen) {
      router.replace("/projects");
    }
  }

  async function submit() {
    if (form.name.trim().length < 2) {
      toast({ title: "Project name must be at least 2 characters", variant: "error" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          entity: form.entity || null,
          department: form.department || null,
          location: form.location || null,
          priority: form.priority,
          memberIds,
          status: form.status,
          budget: form.budget ? Number(form.budget) : null,
          color: form.color,
          ownerId: form.ownerId,
          projectManagerId: form.projectManagerId || null,
          startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
          endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Server error ${res.status}`);
      }

      const { project } = await res.json();
      toast({ title: "Project created!", variant: "success" });
      setOpen(false);
      router.push(`/projects/${project.id}?view=gantt`);
      router.refresh();
    } catch (e) {
      toast({
        title: "Could not create project",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="brand">
          <Plus /> New Project
        </Button>
      </DialogTrigger>

      <DialogContent className="w-[95vw] max-w-5xl">
        <DialogHeader>
          <DialogTitle>Create a new project</DialogTitle>
          <DialogDescription>
            Set up the basics — you can refine everything later.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 grid-cols-4">
          {/* Project name — col span 3 */}
          <div className="space-y-1.5 col-span-3">
            <Label htmlFor="np-name">Project name *</Label>
            <Input
              id="np-name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Q3 Marketing Campaign"
              autoFocus
            />
          </div>

          {/* Colour — col span 1 */}
          <div className="space-y-1.5">
            <Label htmlFor="np-color">Colour</Label>
            <Input
              id="np-color"
              type="color"
              value={form.color}
              onChange={(e) => update("color", e.target.value)}
              className="h-9 w-full p-1"
            />
          </div>

          {/* Description — full width */}
          <div className="space-y-1.5 col-span-4">
            <Label htmlFor="np-desc">Description</Label>
            <Textarea
              id="np-desc"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="What is this project about?"
              rows={2}
            />
          </div>

          {/* Entity */}
          <div className="space-y-1.5">
            <Label>Entity / Division</Label>
            {entities && entities.length > 0 ? (
              <Select value={form.entity} onValueChange={(v) => update("entity", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select entity" />
                </SelectTrigger>
                <SelectContent>
                  {entities.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="np-entity"
                value={form.entity}
                onChange={(e) => update("entity", e.target.value)}
                placeholder="National Group India"
              />
            )}
          </div>

          {/* Department */}
          <div className="space-y-1.5">
            <Label>Department</Label>
            <Select value={form.department} onValueChange={(v) => update("department", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {(departments && departments.length > 0 ? departments : DEPARTMENTS).map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label>Location</Label>
            {locations && locations.length > 0 ? (
              <Select value={form.location} onValueChange={(v) => update("location", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="np-location"
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
                placeholder="City / Branch"
              />
            )}
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={form.priority} onValueChange={(v) => update("priority", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => (
                  <SelectItem key={p} value={p}>
                    {p.charAt(0) + p.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Project Manager */}
          <div className="space-y-1.5">
            <Label>Project Manager</Label>
            <Select value={form.projectManagerId} onValueChange={(v) => update("projectManagerId", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select PM" />
              </SelectTrigger>
              <SelectContent>
                {allUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name ?? u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Owner */}
          <div className="space-y-1.5">
            <Label>Project Owner</Label>
            <Select value={form.ownerId} onValueChange={(v) => update("ownerId", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Owner" />
              </SelectTrigger>
              <SelectContent>
                {allUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name ?? u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => update("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["PLANNING", "ACTIVE", "ON_HOLD"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.charAt(0) + s.slice(1).toLowerCase().replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Budget */}
          <div className="space-y-1.5">
            <Label htmlFor="np-budget">Budget (USD)</Label>
            <Input
              id="np-budget"
              type="number"
              min={0}
              value={form.budget}
              onChange={(e) => update("budget", e.target.value)}
              placeholder="50000"
            />
          </div>

          {/* Timeline preset — full width */}
          <div className="space-y-1.5 col-span-4">
            <Label>Timeline</Label>
            <div className="flex flex-wrap gap-2">
              {TIMELINE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(String(preset.months))}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    timelinePreset === String(preset.months)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Start date */}
          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="np-start">Start date</Label>
            <Input
              id="np-start"
              type="date"
              value={form.startDate}
              onChange={(e) => {
                update("startDate", e.target.value);
                const m = parseInt(timelinePreset, 10);
                if (m > 0 && e.target.value) {
                  update("endDate", toDateInput(addMonths(new Date(e.target.value), m)));
                }
              }}
            />
          </div>

          {/* End date */}
          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="np-end">End date</Label>
            <Input
              id="np-end"
              type="date"
              value={form.endDate}
              onChange={(e) => {
                update("endDate", e.target.value);
                setTimelinePreset("0");
              }}
            />
          </div>

          {/* Members — full width */}
          <div className="space-y-1.5 col-span-4">
            <Label>Members</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search members by name or email…"
                className="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
              />
            </div>
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto thin-scroll rounded-md border p-2">
              {allUsers
                .filter((u) => {
                  const q = memberSearch.toLowerCase();
                  return (
                    !q ||
                    (u.name ?? "").toLowerCase().includes(q) ||
                    u.email.toLowerCase().includes(q)
                  );
                })
                .map((u) => {
                const isOwnerOrPm =
                  u.id === form.ownerId || u.id === form.projectManagerId;
                const active = isOwnerOrPm || memberIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    disabled={isOwnerOrPm}
                    onClick={() =>
                      setMemberIds((m) =>
                        m.includes(u.id)
                          ? m.filter((x) => x !== u.id)
                          : [...m, u.id],
                      )
                    }
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "hover:bg-muted",
                      isOwnerOrPm && "opacity-70 cursor-default",
                    )}
                    title={isOwnerOrPm ? "Owner / PM is always a member" : u.email}
                  >
                    {u.name?.split(" ")[0] ?? u.email}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Only members appear in the task assignee list. Owner and PM are always included.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="brand" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
