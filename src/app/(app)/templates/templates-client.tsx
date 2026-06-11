"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Layers, Plus, Pencil, Trash2, FolderPlus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Template = {
  id: string;
  name: string;
  description: string | null;
  department: string | null;
  isSystem: boolean;
  taskCount: number;
  createdAt: string;
  updatedAt: string;
};

const STARTER_TEMPLATES: Array<{
  name: string;
  description: string;
  department: string;
  tasks: { title: string; status: string; priority: string }[];
}> = [
  {
    name: "Software Development Sprint",
    description: "Standard 2-week sprint with planning, development, testing and review phases.",
    department: "Engineering",
    tasks: [
      { title: "Sprint Planning", status: "NOT_STARTED", priority: "HIGH" },
      { title: "Design / Architecture", status: "NOT_STARTED", priority: "HIGH" },
      { title: "Development", status: "NOT_STARTED", priority: "HIGH" },
      { title: "Code Review", status: "NOT_STARTED", priority: "MEDIUM" },
      { title: "QA Testing", status: "NOT_STARTED", priority: "HIGH" },
      { title: "UAT Sign-off", status: "NOT_STARTED", priority: "HIGH" },
      { title: "Deployment", status: "NOT_STARTED", priority: "CRITICAL" },
      { title: "Sprint Retrospective", status: "NOT_STARTED", priority: "MEDIUM" },
    ],
  },
  {
    name: "Marketing Campaign",
    description: "End-to-end campaign launch from strategy to post-campaign analysis.",
    department: "Marketing",
    tasks: [
      { title: "Campaign Strategy", status: "NOT_STARTED", priority: "HIGH" },
      { title: "Creative Brief", status: "NOT_STARTED", priority: "HIGH" },
      { title: "Content Creation", status: "NOT_STARTED", priority: "MEDIUM" },
      { title: "Design Assets", status: "NOT_STARTED", priority: "MEDIUM" },
      { title: "Review & Approvals", status: "NOT_STARTED", priority: "HIGH" },
      { title: "Campaign Launch", status: "NOT_STARTED", priority: "CRITICAL" },
      { title: "Performance Monitoring", status: "NOT_STARTED", priority: "MEDIUM" },
      { title: "Post-Campaign Report", status: "NOT_STARTED", priority: "LOW" },
    ],
  },
  {
    name: "Onboarding New Employee",
    description: "Structured onboarding checklist for new team members.",
    department: "Human Resources",
    tasks: [
      { title: "Send Welcome Email", status: "NOT_STARTED", priority: "HIGH" },
      { title: "Set Up IT Accounts", status: "NOT_STARTED", priority: "CRITICAL" },
      { title: "Workspace Setup", status: "NOT_STARTED", priority: "HIGH" },
      { title: "HR Documentation", status: "NOT_STARTED", priority: "HIGH" },
      { title: "Team Introduction", status: "NOT_STARTED", priority: "MEDIUM" },
      { title: "Role Briefing", status: "NOT_STARTED", priority: "HIGH" },
      { title: "30-Day Check-in", status: "NOT_STARTED", priority: "MEDIUM" },
    ],
  },
];

export function TemplatesClient({
  templates: initialTemplates,
  isAdmin,
}: {
  templates: Template[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [templates, setTemplates] = React.useState<Template[]>(initialTemplates);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ name: "", description: "", department: "" });
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState("");
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [seeding, setSeeding] = React.useState(false);
  const [useDialog, setUseDialog] = React.useState<Template | null>(null);

  async function reload() {
    const res = await fetch("/api/templates");
    if (res.ok) {
      const data = await res.json();
      setTemplates(data.templates ?? []);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.name.trim()) { setFormError("Name is required."); return; }
    setSaving(true);
    try {
      const url = editingId ? `/api/templates/${editingId}` : "/api/templates";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          department: form.department.trim() || null,
          blueprint: { tasks: [] },
        }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error ?? "Failed to save."); return; }
      setFormOpen(false);
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    if (res.ok) { setDeleting(null); await reload(); }
  }

  async function seedStarters() {
    setSeeding(true);
    try {
      for (const tpl of STARTER_TEMPLATES) {
        await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: tpl.name,
            description: tpl.description,
            department: tpl.department,
            blueprint: { tasks: tpl.tasks },
            isSystem: true,
          }),
        });
      }
      await reload();
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Project Templates"
          description="Reusable project blueprints to kick-start new work"
        />
        {isAdmin && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {templates.length === 0 && (
              <Button variant="outline" onClick={seedStarters} disabled={seeding}>
                <Sparkles className="mr-2 h-4 w-4" />
                {seeding ? "Adding…" : "Add Starter Templates"}
              </Button>
            )}
            <Button
              onClick={() => {
                setEditingId(null);
                setForm({ name: "", description: "", department: "" });
                setFormError("");
                setFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          </div>
        )}
      </div>

      {templates.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <Layers className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">No templates yet</p>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={seedStarters} disabled={seeding}>
                <Sparkles className="mr-2 h-4 w-4" />
                {seeding ? "Adding Starters…" : "Add Starter Templates"}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <div
            key={t.id}
            className="rounded-xl border bg-card p-5 space-y-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate">{t.name}</h3>
                {t.department && (
                  <Badge variant="outline" className="text-[11px] px-1.5 py-0">
                    {t.department}
                  </Badge>
                )}
              </div>
              {t.isSystem && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex-shrink-0">
                  System
                </Badge>
              )}
            </div>

            {t.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">
                {t.taskCount} task{t.taskCount !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => setUseDialog(t)}
                >
                  <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
                  Use Template
                </Button>
                {isAdmin && !t.isSystem && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditingId(t.id);
                        setForm({
                          name: t.name,
                          description: t.description ?? "",
                          department: t.department ?? "",
                        });
                        setFormError("");
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleting(t.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) setFormError(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Template" : "New Template"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Name *</Label>
              <Input
                id="tpl-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Software Development Sprint"
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-dept">Department</Label>
              <Input
                id="tpl-dept"
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                placeholder="e.g. Engineering"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-desc">Description</Label>
              <Textarea
                id="tpl-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Brief description of this template…"
              />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editingId ? "Save" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Use Template dialog */}
      <Dialog open={!!useDialog} onOpenChange={(o) => !o && setUseDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Use Template</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Create a new project pre-populated with tasks from{" "}
            <strong>{useDialog?.name}</strong>?
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setUseDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (useDialog) {
                  router.push(`/projects?new=1&templateId=${useDialog.id}`);
                  setUseDialog(null);
                }
              }}
            >
              <FolderPlus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Template?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This template will be permanently deleted.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleting && handleDelete(deleting)}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
