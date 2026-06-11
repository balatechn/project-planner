"use client";

import * as React from "react";
import type { Metadata } from "next";
import {
  Play,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  X,
  Search,
  Clock,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";

// Utility: turn a video URL into an embeddable src
function toEmbedUrl(url: string): { type: "iframe" | "video"; src: string } {
  try {
    const u = new URL(url);

    // YouTube
    const ytMatch =
      u.hostname.includes("youtube.com")
        ? u.searchParams.get("v")
        : u.hostname === "youtu.be"
        ? u.pathname.slice(1)
        : null;
    if (ytMatch) {
      return { type: "iframe", src: `https://www.youtube.com/embed/${ytMatch}?rel=0` };
    }

    // Vimeo
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return { type: "iframe", src: `https://player.vimeo.com/video/${id}` };
    }

    // Direct video file
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) {
      return { type: "video", src: url };
    }

    // Default: try as iframe (handles Google Drive, Loom, etc.)
    return { type: "iframe", src: url };
  } catch {
    return { type: "iframe", src: url };
  }
}

type Video = {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string;
  thumbnail: string | null;
  category: string | null;
  duration: string | null;
  isPublished: boolean;
  orderIndex: number;
  uploadedBy: { id: string; name: string | null; image: string | null };
  createdAt: string;
};

type FormState = {
  title: string;
  description: string;
  videoUrl: string;
  thumbnail: string;
  category: string;
  duration: string;
  isPublished: boolean;
};

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  videoUrl: "",
  thumbnail: "",
  category: "",
  duration: "",
  isPublished: true,
};

export default function TrainingPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const [videos, setVideos] = React.useState<Video[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState<string>("All");

  // Player modal
  const [playing, setPlaying] = React.useState<Video | null>(null);

  // Form dialog
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState("");

  // Delete confirm
  const [deleting, setDeleting] = React.useState<string | null>(null);

  // Load videos
  const loadVideos = React.useCallback(async () => {
    try {
      const res = await fetch("/api/training");
      if (res.ok) {
        const data = await res.json();
        setVideos(data.videos ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { loadVideos(); }, [loadVideos]);

  // Derived categories
  const categories = React.useMemo(() => {
    const cats = new Set(videos.map((v) => v.category).filter(Boolean) as string[]);
    return ["All", ...Array.from(cats).sort()];
  }, [videos]);

  // Filtered list
  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return videos.filter((v) => {
      const matchCat = activeCategory === "All" || v.category === activeCategory;
      const matchQ =
        !q ||
        v.title.toLowerCase().includes(q) ||
        (v.description ?? "").toLowerCase().includes(q) ||
        (v.category ?? "").toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [videos, search, activeCategory]);

  // Open form for new or edit
  function openNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setFormOpen(true);
  }
  function openEdit(v: Video) {
    setEditingId(v.id);
    setForm({
      title: v.title,
      description: v.description ?? "",
      videoUrl: v.videoUrl,
      thumbnail: v.thumbnail ?? "",
      category: v.category ?? "",
      duration: v.duration ?? "",
      isPublished: v.isPublished,
    });
    setFormError("");
    setFormOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.title.trim() || !form.videoUrl.trim()) {
      setFormError("Title and Video URL are required.");
      return;
    }
    setSaving(true);
    try {
      const url = editingId ? `/api/training/${editingId}` : "/api/training";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          videoUrl: form.videoUrl.trim(),
          thumbnail: form.thumbnail.trim() || null,
          category: form.category.trim() || null,
          duration: form.duration.trim() || null,
          isPublished: form.isPublished,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error ?? "Failed to save."); return; }
      setFormOpen(false);
      await loadVideos();
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePublish(v: Video) {
    const res = await fetch(`/api/training/${v.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !v.isPublished }),
    });
    if (res.ok) await loadVideos();
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/training/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDeleting(null);
      await loadVideos();
    }
  }

  if (loading) return null; // loading.tsx handles this

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Training Videos"
          description="Watch team training and onboarding resources"
        />
        {isAdmin && (
          <Button onClick={openNew} className="flex-shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            Add Video
          </Button>
        )}
      </div>

      {/* Search + filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search videos…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                activeCategory === cat
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-transparent bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <Play className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">
            {videos.length === 0 ? "No training videos yet" : "No videos match your search"}
          </p>
          {isAdmin && videos.length === 0 && (
            <Button variant="outline" onClick={openNew} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add First Video
            </Button>
          )}
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((v) => (
            <div
              key={v.id}
              className="group relative rounded-xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Thumbnail / preview */}
              <button
                onClick={() => setPlaying(v)}
                className="relative w-full aspect-video bg-muted flex items-center justify-center overflow-hidden focus-visible:outline-none"
              >
                {v.thumbnail ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={v.thumbnail}
                    alt={v.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <Play className="h-12 w-12 text-primary/50" />
                  </div>
                )}
                {/* Play overlay */}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="rounded-full bg-white/90 p-3">
                    <Play className="h-6 w-6 text-black fill-black" />
                  </div>
                </div>
                {/* Draft badge */}
                {isAdmin && !v.isPublished && (
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary" className="bg-yellow-500/90 text-black text-[10px]">
                      Draft
                    </Badge>
                  </div>
                )}
              </button>

              <div className="p-4 space-y-2">
                <h3 className="font-semibold text-sm leading-tight line-clamp-2">{v.title}</h3>
                {v.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{v.description}</p>
                )}
                <div className="flex items-center justify-between">
                  {v.category && (
                    <Badge variant="outline" className="text-[10px] px-2 py-0">
                      {v.category}
                    </Badge>
                  )}
                  {v.duration && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground ml-auto">
                      <Clock className="h-3 w-3" />
                      {v.duration}
                    </span>
                  )}
                </div>

                {/* Admin actions */}
                {isAdmin && (
                  <div className="flex items-center gap-1 pt-1 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => openEdit(v)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleTogglePublish(v)}
                    >
                      {v.isPublished ? (
                        <><EyeOff className="h-3.5 w-3.5 mr-1" />Unpublish</>
                      ) : (
                        <><Eye className="h-3.5 w-3.5 mr-1" />Publish</>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive ml-auto"
                      onClick={() => setDeleting(v.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Video Player Modal ── */}
      {playing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setPlaying(null)}
        >
          <div
            className="relative w-full max-w-4xl rounded-xl overflow-hidden bg-black shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPlaying(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="aspect-video w-full">
              {toEmbedUrl(playing.videoUrl).type === "iframe" ? (
                <iframe
                  src={toEmbedUrl(playing.videoUrl).src}
                  title={playing.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full border-0"
                />
              ) : (
                <video
                  src={toEmbedUrl(playing.videoUrl).src}
                  controls
                  autoPlay
                  className="h-full w-full"
                />
              )}
            </div>
            <div className="bg-card p-4">
              <h2 className="font-semibold text-base">{playing.title}</h2>
              {playing.description && (
                <p className="mt-1 text-sm text-muted-foreground">{playing.description}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Add/Edit Form Dialog ── */}
      <Dialog open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) setFormError(""); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Video" : "Add Training Video"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tv-title">Title *</Label>
              <Input
                id="tv-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Onboarding — How to create a project"
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tv-url">Video URL *</Label>
              <Input
                id="tv-url"
                value={form.videoUrl}
                onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
                placeholder="YouTube, Vimeo, or direct .mp4 link"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Supports YouTube, Vimeo, or direct .mp4/.webm URLs
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tv-cat">Category</Label>
                <Input
                  id="tv-cat"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Onboarding"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tv-dur">Duration</Label>
                <Input
                  id="tv-dur"
                  value={form.duration}
                  onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                  placeholder="e.g. 12:34"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tv-thumb">Thumbnail URL (optional)</Label>
              <Input
                id="tv-thumb"
                value={form.thumbnail}
                onChange={(e) => setForm((f) => ({ ...f, thumbnail: e.target.value }))}
                placeholder="https://…/thumbnail.jpg"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tv-desc">Description</Label>
              <Textarea
                id="tv-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of what this video covers…"
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="tv-pub"
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
                className="h-4 w-4 accent-primary"
              />
              <Label htmlFor="tv-pub" className="cursor-pointer">
                Publish immediately (visible to all users)
              </Label>
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editingId ? "Save Changes" : "Add Video"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Video?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This video will be permanently removed and cannot be recovered.
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
