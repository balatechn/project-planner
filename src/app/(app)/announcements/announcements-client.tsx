"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import {
  Plus,
  Pencil,
  Trash2,
  Pin,
  PinOff,
  Eye,
  EyeOff,
  Megaphone,
  Info,
  CheckCircle2,
  AlertTriangle,
  Siren,
} from "lucide-react";
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

type AnnouncementType = "INFO" | "SUCCESS" | "WARNING" | "URGENT";

type Announcement = {
  id: string;
  title: string;
  body: string;
  type: AnnouncementType;
  isActive: boolean;
  isPinned: boolean;
  expiresAt: string | null;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string | null; image: string | null };
};

const TYPE_CONFIG: Record<
  AnnouncementType,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  INFO: {
    label: "Info",
    icon: Info,
    color: "text-blue-600",
    bg: "bg-blue-500/10 border-blue-500/30",
  },
  SUCCESS: {
    label: "Update",
    icon: CheckCircle2,
    color: "text-green-600",
    bg: "bg-green-500/10 border-green-500/30",
  },
  WARNING: {
    label: "Warning",
    icon: AlertTriangle,
    color: "text-amber-600",
    bg: "bg-amber-500/10 border-amber-500/30",
  },
  URGENT: {
    label: "Urgent",
    icon: Siren,
    color: "text-red-600",
    bg: "bg-red-500/10 border-red-500/30",
  },
};

type FormState = {
  title: string;
  body: string;
  type: AnnouncementType;
  isPinned: boolean;
  expiresAt: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  body: "",
  type: "INFO",
  isPinned: false,
  expiresAt: "",
};

export function AnnouncementsClient({
  initialAnnouncements,
  isAdmin,
}: {
  initialAnnouncements: Announcement[];
  isAdmin: boolean;
}) {
  const [items, setItems] = React.useState<Announcement[]>(initialAnnouncements);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState("");
  const [deleting, setDeleting] = React.useState<string | null>(null);

  async function reload() {
    const res = await fetch(isAdmin ? "/api/announcements?all=1" : "/api/announcements");
    if (res.ok) {
      const data = await res.json();
      setItems(data.announcements ?? []);
    }
  }

  function openNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(a: Announcement) {
    setEditingId(a.id);
    setForm({
      title: a.title,
      body: a.body,
      type: a.type,
      isPinned: a.isPinned,
      expiresAt: a.expiresAt ? a.expiresAt.slice(0, 16) : "",
    });
    setFormError("");
    setFormOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.title.trim() || !form.body.trim()) {
      setFormError("Title and message are required.");
      return;
    }
    setSaving(true);
    try {
      const url = editingId
        ? `/api/announcements/${editingId}`
        : "/api/announcements";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          body: form.body.trim(),
          type: form.type,
          isPinned: form.isPinned,
          expiresAt: form.expiresAt || null,
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

  async function handleToggle(a: Announcement, field: "isActive" | "isPinned") {
    const res = await fetch(`/api/announcements/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: !a[field] }),
    });
    if (res.ok) await reload();
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/announcements/${id}`, { method: "DELETE" });
    if (res.ok) { setDeleting(null); await reload(); }
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Announcements"
          description={
            isAdmin
              ? "Create and manage team announcements"
              : "Latest updates from your team"
          }
        />
        {isAdmin && (
          <Button onClick={openNew} className="flex-shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            New Announcement
          </Button>
        )}
      </div>

      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <Megaphone className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">No announcements</p>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Announcement
            </Button>
          )}
        </div>
      )}

      <div className="space-y-3">
        {items.map((a) => {
          const cfg = TYPE_CONFIG[a.type];
          const Icon = cfg.icon;
          return (
            <div
              key={a.id}
              className={cn(
                "rounded-xl border p-5 space-y-3 transition-opacity",
                cfg.bg,
                !a.isActive && "opacity-50",
              )}
            >
              <div className="flex items-start gap-3">
                <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", cfg.color)} />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={cn("border text-[11px] px-1.5 py-0", cfg.bg, cfg.color)}
                    >
                      {cfg.label}
                    </Badge>
                    {a.isPinned && (
                      <Pin className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    {!a.isActive && (
                      <Badge variant="secondary" className="text-[11px] px-1.5 py-0">
                        Hidden
                      </Badge>
                    )}
                    <h3 className="font-semibold text-sm">{a.title}</h3>
                  </div>
                  <p className="text-sm text-foreground/90 whitespace-pre-line">{a.body}</p>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>By {a.author.name ?? "Admin"}</span>
                    <span>{format(parseISO(a.createdAt), "MMM d, yyyy · h:mm a")}</span>
                    {a.expiresAt && (
                      <span>
                        Expires {format(parseISO(a.expiresAt), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title={a.isPinned ? "Unpin" : "Pin"}
                      onClick={() => handleToggle(a, "isPinned")}
                    >
                      {a.isPinned ? (
                        <PinOff className="h-4 w-4" />
                      ) : (
                        <Pin className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title={a.isActive ? "Hide" : "Show"}
                      onClick={() => handleToggle(a, "isActive")}
                    >
                      {a.isActive ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Edit"
                      onClick={() => openEdit(a)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      title="Delete"
                      onClick={() => setDeleting(a.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Form dialog */}
      <Dialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setFormError("");
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Announcement" : "New Announcement"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ann-title">Title *</Label>
              <Input
                id="ann-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. System maintenance on Friday"
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ann-body">Message *</Label>
              <Textarea
                id="ann-body"
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Announcement details…"
                rows={4}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ann-type">Type</Label>
                <select
                  id="ann-type"
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, type: e.target.value as AnnouncementType }))
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="INFO">ℹ️ Info</option>
                  <option value="SUCCESS">✅ Update</option>
                  <option value="WARNING">⚠️ Warning</option>
                  <option value="URGENT">🚨 Urgent</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ann-expires">Expires (optional)</Label>
                <Input
                  id="ann-expires"
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="ann-pinned"
                type="checkbox"
                checked={form.isPinned}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isPinned: e.target.checked }))
                }
                className="h-4 w-4 accent-primary"
              />
              <Label htmlFor="ann-pinned" className="cursor-pointer">
                Pin to top of announcements
              </Label>
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editingId ? "Save Changes" : "Publish"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Announcement?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This announcement will be permanently removed.
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
