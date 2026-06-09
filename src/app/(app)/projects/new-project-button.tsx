"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
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
import { DEPARTMENTS } from "@/lib/constants";

type UserOption = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

const TIMELINE_PRESETS = [
  { label: "6 months", months: 6 },
  { label: "1 year", months: 12 },
  { label: "2 years", months: 24 },
  { label: "3 years", months: 36 },
  { label: "Custom", months: 0 },
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
}: {
  users: UserOption[];
  currentUserId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [timelinePreset, setTimelinePreset] = React.useState("12");

  React.useEffect(() => {
    if (searchParams.get("new") === "1") setOpen(true);
  }, [searchParams]);

  const today = toDateInput(new Date());

  const [form, setForm] = React.useState({
    name: "",
    description: "",
    entity: "",
    department: "",
    priority: "MEDIUM",
    status: "PLANNING",
    startDate: today,
    endDate: toDateInput(addMonths(new Date(), 12)),
    budget: "",
    color: "#f59e0b",
    ownerId: currentUserId,
    projectManagerId: currentUserId,
  });

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

  async function submit() {
    if (form.name.trim().length < 2) {
      toast({ title: "Project name is too short", variant: "error" });
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
          priority: form.priority,
          status: form.status,
          budget: form.budget ? Number(form.budget) : null,
          color: form.color,
          ownerId: form.ownerId,
          projectManagerId: form.projectManagerId || null,
          startDate: form.startDate
            ? new Date(form.startDate).toISOString()
            : null,
          endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to create project");
      }
      const { project } = await res.json();
      toast({ title: "Project created", variant: "success" });
      setOpen(false);
      router.push(`/projects/${project.id}?view=gantt`);
      router.refresh();
    } catch (e) {
      toast({
        title: "Could not create project",
        description: e instanceof Error ? e.message : undefined,
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o && searchParams.get("new")) router.replace("/projects");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="brand">
          <Plus /> New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a new project</DialogTitle>
          <DialogDescription>
            Set up the basics — you can refine everything later.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Project name */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="name">Project name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Q3 Marketing Campaign"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="What is this project about?"
              rows={2}
            />
          </div>

          {/* Entity */}
          <div className="space-y-1.5">
            <Label htmlFor="entity">Entity / Division</Label>
            <Input
              id="entity"
              value={form.entity}
              onChange={(e) => update("entity", e.target.value)}
              placeholder="ACME Corp — APAC"
            />
          </div>

          {/* Department */}
          <div className="space-y-1.5">
            <Label>Department</Label>
            <Select
              value={form.department}
              onValueChange={(v) => update("department", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Project Manager */}
          <div className="space-y-1.5">
            <Label>Project Manager</Label>
            <Select
              value={form.projectManagerId}
              onValueChange={(v) => update("projectManagerId", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select PM" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name ?? u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Owner */}
          <div className="space-y-1.5">
            <Label>Project owner</Label>
            <Select
              value={form.ownerId}
              onValueChange={(v) => update("ownerId", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Owner" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name ?? u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select
              value={form.priority}
              onValueChange={(v) => update("priority", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => (
                  <SelectItem key={p} value={p}>
                    {p.charAt(0) + p.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => update("status", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["PLANNING", "ACTIVE", "ON_HOLD"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.charAt(0) + s.slice(1).toLowerCase().replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Timeline preset */}
          <div className="space-y-1.5 sm:col-span-2">
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
          <div className="space-y-1.5">
            <Label htmlFor="start">Start date</Label>
            <Input
              id="start"
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
          <div className="space-y-1.5">
            <Label htmlFor="end">End date</Label>
            <Input
              id="end"
              type="date"
              value={form.endDate}
              onChange={(e) => {
                update("endDate", e.target.value);
                setTimelinePreset("0"); // custom
              }}
            />
          </div>

          {/* Budget */}
          <div className="space-y-1.5">
            <Label htmlFor="budget">Budget (USD)</Label>
            <Input
              id="budget"
              type="number"
              min={0}
              value={form.budget}
              onChange={(e) => update("budget", e.target.value)}
              placeholder="50000"
            />
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label htmlFor="color">Color</Label>
            <Input
              id="color"
              type="color"
              value={form.color}
              onChange={(e) => update("color", e.target.value)}
              className="h-9 w-full p-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
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
