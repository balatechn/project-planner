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

  React.useEffect(() => {
    if (searchParams.get("new") === "1") setOpen(true);
  }, [searchParams]);

  const [form, setForm] = React.useState({
    name: "",
    description: "",
    department: "",
    priority: "MEDIUM",
    status: "PLANNING",
    startDate: "",
    endDate: "",
    budget: "",
    color: "#2563eb",
    ownerId: currentUserId,
  });

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
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
          ...form,
          budget: form.budget ? Number(form.budget) : null,
          startDate: form.startDate
            ? new Date(form.startDate).toISOString()
            : null,
          endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
          department: form.department || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to create project");
      }
      const { project } = await res.json();
      toast({ title: "Project created", variant: "success" });
      setOpen(false);
      router.push(`/projects/${project.id}`);
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
      <Button variant="brand" onClick={() => setOpen(true)}>
        <Plus /> New Project
      </Button>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create a new project</DialogTitle>
          <DialogDescription>
            Set up the basics — you can refine everything later.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="name">Project name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Q3 Marketing Campaign"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="What is this project about?"
            />
          </div>

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

          <div className="space-y-1.5">
            <Label htmlFor="start">Start date</Label>
            <Input
              id="start"
              type="date"
              value={form.startDate}
              onChange={(e) => update("startDate", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="end">End date</Label>
            <Input
              id="end"
              type="date"
              value={form.endDate}
              onChange={(e) => update("endDate", e.target.value)}
            />
          </div>

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
