"use client";

import * as React from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  ChevronRight,
  Download,
  ExternalLink,
  File,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  Grid2X2,
  HardDrive,
  Image as ImageIcon,
  Link2,
  List,
  Loader2,
  Plus,
  Presentation,
  RefreshCw,
  Search,
  Upload,
  Video,
  X,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ── Types ──────────────────────────────────────────────────────────────────

type DriveItem = {
  id: string;
  name: string;
  size: number;
  lastModifiedDateTime: string;
  modifiedByName: string;
  isFolder: boolean;
  mimeType?: string;
  childCount?: number;
  downloadUrl?: string;
  webUrl?: string;
  parentPath?: string;
};

type SortKey = "name" | "size" | "lastModifiedDateTime";
type SortDir = "asc" | "desc";
type FilterTab = "all" | "folders" | "documents" | "spreadsheets" | "presentations" | "pdfs" | "images" | "videos";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatDate(iso: string): string {
  try { return formatDistanceToNow(parseISO(iso), { addSuffix: true }); }
  catch { return iso; }
}

function getFilter(item: DriveItem): FilterTab {
  if (item.isFolder) return "folders";
  const m = (item.mimeType ?? "").toLowerCase();
  const n = item.name.toLowerCase();
  if (n.endsWith(".pdf") || m.includes("pdf")) return "pdfs";
  if (n.match(/\.(xlsx?|csv)$/) || m.includes("spreadsheet") || m.includes("excel")) return "spreadsheets";
  if (n.match(/\.(pptx?)$/) || m.includes("presentation") || m.includes("powerpoint")) return "presentations";
  if (n.match(/\.(docx?)$/) || m.includes("word") || m.includes("document")) return "documents";
  if (m.startsWith("image/") || n.match(/\.(png|jpe?g|gif|svg|webp|bmp|jfif)$/i)) return "images";
  if (m.startsWith("video/") || n.match(/\.(mp4|mov|avi|mkv|wmv)$/i)) return "videos";
  return "all";
}

function ItemIcon({ item, className }: { item: DriveItem; className?: string }) {
  const cls = cn("flex-shrink-0", className);
  if (item.isFolder) return <Folder className={cn(cls, "text-amber-500")} />;
  const f = getFilter(item);
  if (f === "spreadsheets") return <FileSpreadsheet className={cn(cls, "text-green-600")} />;
  if (f === "presentations") return <Presentation className={cn(cls, "text-orange-500")} />;
  if (f === "pdfs") return <FileText className={cn(cls, "text-red-500")} />;
  if (f === "documents") return <FileText className={cn(cls, "text-blue-500")} />;
  if (f === "images") return <ImageIcon className={cn(cls, "text-violet-500")} />;
  if (f === "videos") return <Video className={cn(cls, "text-pink-500")} />;
  return <File className={cn(cls, "text-muted-foreground")} />;
}

function totalSize(items: DriveItem[]) {
  return items.filter((i) => !i.isFolder).reduce((s, i) => s + i.size, 0);
}

// ── Preview panel ──────────────────────────────────────────────────────────

function PreviewPanel({ item, onClose }: { item: DriveItem; onClose: () => void }) {
  const f = getFilter(item);
  const isImage = f === "images";
  const isOffice = f === "documents" || f === "spreadsheets" || f === "presentations";
  const isPdf = f === "pdfs";
  const needsUrl = isImage || isOffice || isPdf;

  // Always fetch a fresh, pre-authenticated download URL — the one stored in
  // listing state can be absent or expired by the time the panel opens.
  const [liveUrl, setLiveUrl] = React.useState<string | null>(null);
  const [urlLoading, setUrlLoading] = React.useState(needsUrl);

  React.useEffect(() => {
    if (!needsUrl) { setUrlLoading(false); return; }
    setLiveUrl(null);
    setUrlLoading(true);
    fetch(`/api/drive/download?id=${item.id}&mode=url`)
      .then((r) => r.json())
      .then((d: { url?: string }) => setLiveUrl(d.url ?? null))
      .catch(() => setLiveUrl(null))
      .finally(() => setUrlLoading(false));
  }, [item.id, needsUrl]);

  const embedUrl = liveUrl && isOffice
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(liveUrl)}`
    : null;

  const downloadHref = `/api/drive/download?id=${item.id}`;

  function copyLink() {
    navigator.clipboard.writeText(item.webUrl ?? downloadHref);
  }

  return (
    <div className="w-[420px] flex-shrink-0 flex flex-col border-l bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0">
        <ItemIcon item={item} className="h-5 w-5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{item.name}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {formatSize(item.size)} · {formatDate(item.lastModifiedDateTime)}
            {item.modifiedByName ? ` · ${item.modifiedByName}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {item.webUrl && (
            <a href={item.webUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium hover:bg-muted/60 transition-colors">
              <ExternalLink className="h-3 w-3" /> M365
            </a>
          )}
          <a href={downloadHref}
            className="flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium hover:bg-muted/60 transition-colors">
            <Download className="h-3 w-3" /> Download
          </a>
          <button onClick={copyLink} title="Copy link"
            className="p-1.5 rounded border text-muted-foreground hover:bg-muted/60 transition-colors">
            <Link2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={onClose} className="p-1.5 rounded text-muted-foreground hover:bg-muted/60 transition-colors ml-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Preview body */}
      <div className="flex-1 overflow-hidden bg-muted/10 relative">
        {urlLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isImage && liveUrl ? (
          <div className="flex items-center justify-center h-full p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={liveUrl} alt={item.name}
              className="max-w-full max-h-full object-contain rounded shadow-md" />
          </div>
        ) : isOffice && embedUrl ? (
          <iframe src={embedUrl} className="w-full h-full border-0" title={item.name} />
        ) : isPdf && liveUrl ? (
          <iframe src={liveUrl} className="w-full h-full border-0" title={item.name} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
            <ItemIcon item={item} className="h-20 w-20 opacity-20" />
            <div>
              <p className="text-sm font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground mt-1">No preview available</p>
            </div>
            {item.webUrl && (
              <a href={item.webUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                <ExternalLink className="h-4 w-4" /> Open in M365
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sidebar tree node ──────────────────────────────────────────────────────

function TreeNode({ name, path, currentPath, onNavigate }: {
  name: string; path: string; currentPath: string; onNavigate: (p: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [children, setChildren] = React.useState<DriveItem[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const isActive = currentPath === path || currentPath.startsWith(path + "/");

  async function toggle() {
    if (!open && !loaded) {
      const res = await fetch(`/api/drive/browse?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const data = await res.json() as { items: DriveItem[] };
        setChildren((data.items ?? []).filter((i) => i.isFolder));
      }
      setLoaded(true);
    }
    setOpen((v) => !v);
  }

  return (
    <div>
      <button
        onClick={() => { toggle(); onNavigate(path); }}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors",
          isActive ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/60 text-foreground/80",
        )}
      >
        <ChevronRight className={cn("h-3.5 w-3.5 flex-shrink-0 transition-transform text-muted-foreground", open && "rotate-90")} />
        <Folder className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
        <span className="truncate text-[13px] flex-1">{name}</span>
      </button>
      {open && children.length > 0 && (
        <div className="ml-4 border-l border-border pl-1 mt-0.5 space-y-0.5">
          {children.map((c) => (
            <TreeNode key={c.id} name={c.name} path={`${path === "/" ? "" : path}/${c.name}`}
              currentPath={currentPath} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" }, { key: "folders", label: "Folders" },
  { key: "documents", label: "Documents" }, { key: "spreadsheets", label: "Spreadsheets" },
  { key: "presentations", label: "Presentations" }, { key: "pdfs", label: "PDFs" },
  { key: "images", label: "Images" }, { key: "videos", label: "Videos" },
];

export function DriveClient({ currentUserId: _uid, currentUserRole }: {
  currentUserId: string;
  currentUserRole: Role;
}) {
  const { toast } = useToast();
  const isAdmin = currentUserRole === "ADMIN";

  const [currentPath, setCurrentPath] = React.useState("/");
  const [items, setItems] = React.useState<DriveItem[]>([]);
  const [rootFolders, setRootFolders] = React.useState<DriveItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [canWrite, setCanWrite] = React.useState(false);
  const [filterTab, setFilterTab] = React.useState<FilterTab>("all");
  const [viewMode, setViewMode] = React.useState<"list" | "grid">("list");
  const [sortKey, setSortKey] = React.useState<SortKey>("name");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<DriveItem[] | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<DriveItem | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [newFolderOpen, setNewFolderOpen] = React.useState(false);
  const [newFolderName, setNewFolderName] = React.useState("");
  const [creatingFolder, setCreatingFolder] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  // Ctrl+K focus search
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); searchRef.current?.focus(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Load folder ────────────────────────────────────────────────────────

  const loadFolder = React.useCallback(async (path: string) => {
    setLoading(true); setSearchQuery(""); setSearchResults(null); setFilterTab("all"); setSelectedFile(null);
    try {
      const res = await fetch(`/api/drive/browse?path=${encodeURIComponent(path)}`);
      if (!res.ok) { toast({ title: (await res.json() as { error: string }).error ?? "Failed to load", variant: "error" }); return; }
      const data = await res.json() as { items: DriveItem[]; canWrite: boolean };
      setItems(data.items ?? []); setCanWrite(data.canWrite ?? false);
    } catch { toast({ title: "Failed to connect to drive", variant: "error" }); }
    finally { setLoading(false); }
  }, [toast]);

  React.useEffect(() => {
    (async () => {
      const res = await fetch("/api/drive/browse?path=/");
      if (res.ok) { const d = await res.json() as { items: DriveItem[] }; setRootFolders((d.items ?? []).filter((i) => i.isFolder)); }
    })();
    loadFolder("/");
  }, [loadFolder]);

  function navigate(path: string) { setCurrentPath(path); loadFolder(path); }

  // ── Breadcrumb ─────────────────────────────────────────────────────────

  const breadcrumbs = React.useMemo(() => {
    const parts = currentPath.split("/").filter(Boolean);
    const crumbs: { label: string; path: string }[] = [{ label: "Common Drive", path: "/" }];
    parts.forEach((p, i) => crumbs.push({ label: p, path: "/" + parts.slice(0, i + 1).join("/") }));
    return crumbs;
  }, [currentPath]);

  // ── Search ──────────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/drive/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) setSearchResults((await res.json() as { items: DriveItem[] }).items ?? []);
      setSearching(false);
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── Upload ──────────────────────────────────────────────────────────────

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch(`/api/drive/upload?path=${encodeURIComponent(currentPath)}`, { method: "POST", body: fd });
      if (!res.ok) toast({ title: `Upload failed: ${(await res.json() as { error: string }).error}`, variant: "error" });
      else toast({ title: `${file.name} uploaded`, variant: "success" });
    }
    setUploading(false);
    if (e.target) e.target.value = "";
    loadFolder(currentPath);
  }

  // ── New folder ──────────────────────────────────────────────────────────

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    const res = await fetch("/api/drive/folder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: currentPath, name: newFolderName.trim() }) });
    setCreatingFolder(false);
    if (!res.ok) { toast({ title: "Failed to create folder", variant: "error" }); return; }
    toast({ title: "Folder created", variant: "success" });
    setNewFolderOpen(false); setNewFolderName(""); loadFolder(currentPath);
  }

  // ── Sort & filter ───────────────────────────────────────────────────────

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const displayItems = React.useMemo(() => {
    let source = searchResults ?? items;
    if (filterTab !== "all") source = source.filter((i) => getFilter(i) === filterTab);
    return [...source].sort((a, b) => {
      // Folders always first
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "size") cmp = a.size - b.size;
      else cmp = a.lastModifiedDateTime.localeCompare(b.lastModifiedDateTime);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, searchResults, filterTab, sortKey, sortDir]);

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="opacity-30">↕</span>;
    return <span>{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  // ── Copy link ──────────────────────────────────────────────────────────

  function copyLink(item: DriveItem) {
    navigator.clipboard.writeText(item.webUrl ?? item.downloadUrl ?? "")
      .then(() => toast({ title: "Link copied", variant: "success" }));
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-0 h-[calc(100vh-2.75rem-2rem)] overflow-hidden rounded-xl border bg-card">

      {/* Sidebar */}
      <div className="w-52 flex-shrink-0 border-r bg-muted/20 flex flex-col overflow-hidden">
        <div className="px-3 pt-3 pb-2 border-b">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-green-600 flex-shrink-0" />
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">OneDrive — Systems</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5 thin-scroll">
          <button onClick={() => navigate("/")}
            className={cn("flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors",
              currentPath === "/" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/60 text-foreground/80")}>
            <FolderOpen className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
            <span className="text-[13px]">All files</span>
          </button>
          {rootFolders.map((f) => (
            <TreeNode key={f.id} name={f.name} path={`/${f.name}`}
              currentPath={currentPath} onNavigate={navigate} />
          ))}
        </div>
        <div className="px-3 py-2 border-t">
          <span className="flex items-center gap-1.5 text-[11px] text-green-600 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />Synced with M365
          </span>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden min-w-0">
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* Top bar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-card flex-shrink-0">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1 text-sm min-w-0 flex-1">
              {breadcrumbs.map((crumb, i) => (
                <React.Fragment key={crumb.path}>
                  {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                  <button onClick={() => navigate(crumb.path)}
                    className={cn("truncate hover:text-primary transition-colors max-w-[120px]",
                      i === breadcrumbs.length - 1 ? "font-semibold text-foreground" : "text-muted-foreground")}>
                    {crumb.label}
                  </button>
                </React.Fragment>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button onClick={() => loadFolder(currentPath)} className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground" title="Refresh">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>

              {/* View toggle */}
              <div className="flex rounded-md border overflow-hidden">
                <button onClick={() => setViewMode("list")} title="List view"
                  className={cn("px-2 py-1.5", viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted/60 text-muted-foreground")}>
                  <List className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setViewMode("grid")} title="Grid view"
                  className={cn("px-2 py-1.5", viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted/60 text-muted-foreground")}>
                  <Grid2X2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input ref={searchRef} type="text" placeholder="Search files… (Ctrl+K)"
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-48 rounded-lg pl-8 pr-2 text-xs border bg-muted/40 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:bg-background" />
                {searching && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-muted-foreground" />}
                {searchQuery && !searching && (
                  <button onClick={() => { setSearchQuery(""); setSearchResults(null); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {canWrite && (
                <Button size="sm" variant="outline" onClick={() => setNewFolderOpen(true)} className="h-8 text-xs gap-1 px-2.5">
                  <Plus className="h-3.5 w-3.5" /> New folder
                </Button>
              )}
              {canWrite && (
                <Button size="sm" variant="brand" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="h-8 text-xs gap-1 px-2.5">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Upload
                </Button>
              )}
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} />

              {isAdmin && (
                <a href="https://onedrive.live.com" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1.5 rounded border text-xs text-muted-foreground hover:bg-muted/60 transition-colors" title="Manage OneDrive sharing">
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">OneDrive</span>
                </a>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-0.5 px-3 py-1.5 border-b bg-card flex-shrink-0 overflow-x-auto">
            {FILTER_TABS.map((tab) => (
              <button key={tab.key} onClick={() => setFilterTab(tab.key)}
                className={cn("px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                  filterTab === tab.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60")}>
                {tab.label}
              </button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap flex-shrink-0 pl-2">
              {displayItems.length} item{displayItems.length !== 1 ? "s" : ""}
              {displayItems.filter((i) => !i.isFolder).length > 0 && (
                <> · {formatSize(totalSize(displayItems))}</>
              )}
              {searchResults !== null && <> for &ldquo;{searchQuery}&rdquo;</>}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto thin-scroll">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : displayItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <Folder className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {searchResults !== null ? "No files match your search" : "This folder is empty"}
                </p>
              </div>
            ) : viewMode === "list" ? (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                  <tr className="border-b">
                    <th className="text-left px-4 py-2">
                      <button onClick={() => toggleSort("name")} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
                        Name <SortIcon k="name" />
                      </button>
                    </th>
                    <th className="text-right px-4 py-2 w-28">
                      <button onClick={() => toggleSort("size")} className="flex items-center gap-1 ml-auto text-xs font-semibold text-muted-foreground hover:text-foreground">
                        Size <SortIcon k="size" />
                      </button>
                    </th>
                    <th className="w-28" />
                  </tr>
                </thead>
                <tbody>
                  {displayItems.map((item) => (
                    <tr key={item.id}
                      onClick={() => {
                        if (item.isFolder) navigate(`${currentPath === "/" ? "" : currentPath}/${item.name}`);
                        else setSelectedFile((prev) => prev?.id === item.id ? null : item);
                      }}
                      className={cn(
                        "group border-b cursor-pointer transition-colors",
                        selectedFile?.id === item.id ? "bg-primary/8" : "hover:bg-muted/30",
                      )}>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ItemIcon item={item} className="h-4 w-4" />
                          <span className={cn("truncate", selectedFile?.id === item.id ? "text-primary font-medium" : "font-medium")}>
                            {item.name}
                          </span>
                          {item.isFolder && typeof item.childCount === "number" && (
                            <span className="text-xs text-muted-foreground bg-muted px-1.5 rounded-full flex-shrink-0">{item.childCount}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-muted-foreground tabular-nums">
                        {item.isFolder ? "—" : formatSize(item.size)}
                      </td>
                      <td className="px-3 py-2">
                        {!item.isFolder && (
                          <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {item.webUrl && (
                              <a href={item.webUrl} target="_blank" rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground" title="Open in M365">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                            <a href={`/api/drive/download?id=${item.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground" title="Download">
                              <Download className="h-3.5 w-3.5" />
                            </a>
                            <button onClick={(e) => { e.stopPropagation(); copyLink(item); }}
                              className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground" title="Copy link">
                              <Link2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-4">
                {displayItems.map((item) => (
                  <button key={item.id}
                    onClick={() => {
                      if (item.isFolder) navigate(`${currentPath === "/" ? "" : currentPath}/${item.name}`);
                      else setSelectedFile((prev) => prev?.id === item.id ? null : item);
                    }}
                    className={cn("group flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors",
                      selectedFile?.id === item.id ? "bg-primary/8 border-primary/30" : "bg-card hover:bg-muted/40")}>
                    <ItemIcon item={item} className="h-10 w-10" />
                    <span className="text-xs font-medium leading-tight line-clamp-2">{item.name}</span>
                    {!item.isFolder && <span className="text-[10px] text-muted-foreground">{formatSize(item.size)}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Preview panel */}
        {selectedFile && (
          <PreviewPanel item={selectedFile} onClose={() => setSelectedFile(null)} />
        )}
      </div>

      {/* New folder dialog */}
      <Dialog open={newFolderOpen} onOpenChange={(v) => !v && setNewFolderOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New folder</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Folder name</Label>
              <Input autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()} placeholder="e.g. Project Files" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNewFolderOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateFolder} disabled={creatingFolder || !newFolderName.trim()}>
                {creatingFolder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
