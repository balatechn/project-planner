"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { Person, ProjectSummary } from "@/types/app";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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

const STATUS_OPTIONS = [
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
] as const;
const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

function toDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

const NONE = "__none__";

export function EditProjectDialog({
  open,
  onClose,
  project,
  projectManagerId,
  allUsers,
  masters,
}: {
  open: boolean;
  onClose: () => void;
  project: ProjectSummary;
  projectManagerId: string | null;
  allUsers: Person[];
  masters: { entities: string[]; departments: string[]; locations: string[]; programTypes: string[] };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);

  const [form, setForm] = React.useState(() => ({
    name: project.name,
    description: project.description ?? "",
    entity: project.entity ?? "",
    department: project.department ?? "",
    location: project.location ?? "",
    programType: (project as { programType?: string | null }).programType ?? "",
    status: project.status as string,
    priority: project.priority as string,
    startDate: toDateInput(project.startDate),
    endDate: toDateInput(project.endDate),
    budget: project.budget ?? "",
    color: project.color,
    projectManagerId: projectManagerId ?? "",
  }));

  // Re-prime the form whenever the dialog re-opens
  React.useEffect(() => {
    if (!open) return;
    setForm({
      name: project.name,
      description: project.description ?? "",
      entity: project.entity ?? "",
      department: project.department ?? "",
      location: project.location ?? "",
      programType: (project as { programType?: string | null }).programType ?? "",
      status: project.status as string,
      priority: project.priority as string,
      startDate: toDateInput(project.startDate),
      endDate: toDateInput(project.endDate),
      budget: project.budget ?? "",
      color: project.color,
      projectManagerId: projectManagerId ?? "",
    });
  }, [open, project, projectManagerId]);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** Keep a legacy value selectable even if it's not in the master list. */
  function withCurrent(options: string[], current: string): string[] {
    return current && !options.includes(current) ? [current, ...options] : options;
  }

  async function save() {
    if (form.name.trim().length < 2) {
      toast({ title: "Project name must be at least 2 characters", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          entity: form.entity || null,
          department: form.department || null,
          location: form.location || null,
          programType: form.programType || null,
          status: form.status,
          priority: form.priority,
          startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
          endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
          budget: form.budget ? Number(form.budget) : null,
          color: form.color,
          projectManagerId: form.projectManagerId || null,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "Save failed");
      }
      toast({ title: "Project updated", variant: "success" });
      onClose();
      router.refresh();
    } catch (e) {
      toast({
        title: "Could not update project",
        description: e instanceof Error ? e.message : undefined,
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Edit project</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto thin-scroll -mx-6 px-6 py-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ep-name">Project name *</Label>
              <Input
                id="ep-name"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ep-desc">Description</Label>
              <Textarea
                id="ep-desc"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Entity / Division</Label>
              <Select value={form.entity || NONE} onValueChange={(v) => update("entity", v === NONE ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select entity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {withCurrent(masters.entities, form.entity).map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select value={form.department || NONE} onValueChange={(v) => update("department", v === NONE ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {withCurrent(masters.departments, form.department).map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Location</Label>
              <Select value={form.location || NONE} onValueChange={(v) => update("location", v === NONE ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {withCurrent(masters.locations, form.location).map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Program</Label>
              <Select value={form.programType || NONE} onValueChange={(v) => update("programType", v === NONE ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select program type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {withCurrent(masters.programTypes, form.programType).map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Project Manager</Label>
              <Select
                value={form.projectManagerId || NONE}
                onValueChange={(v) => update("projectManagerId", v === NONE ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select PM" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {allUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name ?? u.email ?? u.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => update("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0) + s.slice(1).toLowerCase().replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => update("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p.charAt(0) + p.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ep-start">Start date</Label>
              <Input
                id="ep-start"
                type="date"
                value={form.startDate}
                onChange={(e) => update("startDate", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ep-end">End date</Label>
              <Input
                id="ep-end"
                type="date"
                value={form.endDate}
                onChange={(e) => update("endDate", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ep-budget">Budget</Label>
              <Input
                id="ep-budget"
                type="number"
                min={0}
                value={form.budget}
                onChange={(e) => update("budget", e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ep-color">Colour</Label>
              <input
                id="ep-color"
                type="color"
                value={form.color}
                onChange={(e) => update("color", e.target.value)}
                className="h-9 w-16 cursor-pointer rounded border bg-transparent"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-shrink-0 justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="brand" onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
