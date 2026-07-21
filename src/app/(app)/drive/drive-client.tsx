"use client";

import * as React from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  ChevronRight,
  ExternalLink,
  File,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  Grid2X2,
  HardDrive,
  Image as ImageIcon,
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
  parentPath?: string;
};


// ── Helpers ────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatDate(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

type FilterTab = "all" | "folders" | "documents" | "spreadsheets" | "presentations" | "pdfs" | "images" | "videos";

function getFilter(item: DriveItem): FilterTab {
  if (item.isFolder) return "folders";
  const m = (item.mimeType ?? "").toLowerCase();
  const n = item.name.toLowerCase();
  if (n.endsWith(".pdf") || m.includes("pdf")) return "pdfs";
  if (n.match(/\.(xlsx?|csv)$/) || m.includes("spreadsheet") || m.includes("excel")) return "spreadsheets";
  if (n.match(/\.(pptx?)$/) || m.includes("presentation") || m.includes("powerpoint")) return "presentations";
  if (n.match(/\.(docx?)$/) || m.includes("word") || m.includes("document")) return "documents";
  if (m.startsWith("image/") || n.match(/\.(png|jpe?g|gif|svg|webp|bmp)$/)) return "images";
  if (m.startsWith("video/") || n.match(/\.(mp4|mov|avi|mkv|wmv)$/)) return "videos";
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

// ── Sidebar tree node ──────────────────────────────────────────────────────

function TreeNode({
  name,
  path,
  currentPath,
  onNavigate,
}: {
  name: string;
  path: string;
  currentPath: string;
  onNavigate: (p: string) => void;
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
        <span className="truncate text-[13px]">{name}</span>
      </button>
      {open && children.length > 0 && (
        <div className="ml-4 border-l border-border pl-1 mt-0.5 space-y-0.5">
          {children.map((c) => (
            <TreeNode
              key={c.id}
              name={c.name}
              path={`${path}/${c.name}`}
              currentPath={currentPath}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}


// ── Main component ─────────────────────────────────────────────────────────

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "folders", label: "Folders" },
  { key: "documents", label: "Documents" },
  { key: "spreadsheets", label: "Spreadsheets" },
  { key: "presentations", label: "Presentations" },
  { key: "pdfs", label: "PDFs" },
  { key: "images", label: "Images" },
  { key: "videos", label: "Videos" },
];

export function DriveClient({
  currentUserId: _currentUserId,
  currentUserRole,
}: {
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
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<DriveItem[] | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [newFolderOpen, setNewFolderOpen] = React.useState(false);
  const [newFolderName, setNewFolderName] = React.useState("");
  const [creatingFolder, setCreatingFolder] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // ── Load folder ──────────────────────────────────────────────────────────

  const loadFolder = React.useCallback(async (path: string) => {
    setLoading(true);
    setSearchQuery("");
    setSearchResults(null);
    setFilterTab("all");
    try {
      const res = await fetch(`/api/drive/browse?path=${encodeURIComponent(path)}`);
      if (!res.ok) {
        const err = await res.json() as { error: string };
        toast({ title: err.error ?? "Failed to load folder", variant: "error" });
        return;
      }
      const data = await res.json() as { items: DriveItem[]; canWrite: boolean };
      setItems(data.items ?? []);
      setCanWrite(data.canWrite ?? false);
    } catch {
      toast({ title: "Failed to connect to drive", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Load root folders for sidebar on mount
  React.useEffect(() => {
    (async () => {
      const res = await fetch("/api/drive/browse?path=/");
      if (res.ok) {
        const data = await res.json() as { items: DriveItem[] };
        setRootFolders((data.items ?? []).filter((i) => i.isFolder));
      }
    })();
    loadFolder("/");
  }, [loadFolder]);

  function navigate(path: string) {
    setCurrentPath(path);
    loadFolder(path);
  }

  // ── Breadcrumb ───────────────────────────────────────────────────────────

  const breadcrumbs = React.useMemo(() => {
    const parts = currentPath.split("/").filter(Boolean);
    const crumbs: { label: string; path: string }[] = [{ label: "Common Drive", path: "/" }];
    parts.forEach((p, i) => {
      crumbs.push({ label: p, path: "/" + parts.slice(0, i + 1).join("/") });
    });
    return crumbs;
  }, [currentPath]);

  // ── Search ───────────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/drive/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json() as { items: DriveItem[] };
        setSearchResults(data.items ?? []);
      }
      setSearching(false);
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── Upload ───────────────────────────────────────────────────────────────

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/drive/upload?path=${encodeURIComponent(currentPath)}`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        toast({ title: `Upload failed: ${err.error}`, variant: "error" });
      } else {
        toast({ title: `${file.name} uploaded`, variant: "success" });
      }
    }
    setUploading(false);
    if (e.target) e.target.value = "";
    loadFolder(currentPath);
  }

  // ── New folder ───────────────────────────────────────────────────────────

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    const res = await fetch("/api/drive/folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: currentPath, name: newFolderName.trim() }),
    });
    setCreatingFolder(false);
    if (!res.ok) { toast({ title: "Failed to create folder", variant: "error" }); return; }
    toast({ title: "Folder created", variant: "success" });
    setNewFolderOpen(false);
    setNewFolderName("");
    loadFolder(currentPath);
  }

  // ── Filtered items ───────────────────────────────────────────────────────

  const displayItems = React.useMemo(() => {
    const source = searchResults ?? items;
    if (filterTab === "all") return source;
    return source.filter((item) => getFilter(item) === filterTab);
  }, [items, searchResults, filterTab]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-0 h-[calc(100vh-2.75rem-2rem)] overflow-hidden rounded-xl border bg-card">

      {/* ── Sidebar ── */}
      <div className="w-56 flex-shrink-0 border-r bg-muted/20 flex flex-col overflow-hidden">
        <div className="px-3 pt-3 pb-2 border-b">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-green-600 flex-shrink-0" />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">OneDrive — Systems</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5 thin-scroll">
          <button
            onClick={() => navigate("/")}
            className={cn(
              "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors",
              currentPath === "/" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/60 text-foreground/80",
            )}
          >
            <FolderOpen className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
            <span className="text-[13px]">All files</span>
          </button>
          {rootFolders.map((f) => (
            <TreeNode
              key={f.id}
              name={f.name}
              path={`/${f.name}`}
              currentPath={currentPath}
              onNavigate={navigate}
            />
          ))}
        </div>
        <div className="px-3 py-2 border-t">
          <span className="flex items-center gap-1.5 text-[11px] text-green-600 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
            Synced with M365
          </span>
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top toolbar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-card flex-shrink-0">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 flex-1 min-w-0 text-sm">
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={crumb.path}>
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                <button
                  onClick={() => navigate(crumb.path)}
                  className={cn(
                    "truncate hover:text-primary transition-colors",
                    i === breadcrumbs.length - 1 ? "font-semibold text-foreground" : "text-muted-foreground",
                  )}
                >
                  {crumb.label}
                </button>
              </React.Fragment>
            ))}
          </nav>

          {/* Search */}
          <div className="relative w-52">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search files…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-full rounded-lg pl-8 pr-3 text-sm neu-inset placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
            {searching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>

          {/* View toggle */}
          <div className="flex rounded-md border overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={cn("px-2 py-1.5 transition-colors", viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted/60")}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                <rect x="0" y="1" width="16" height="2" rx="1"/><rect x="0" y="7" width="16" height="2" rx="1"/><rect x="0" y="13" width="16" height="2" rx="1"/>
              </svg>
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={cn("px-2 py-1.5 transition-colors", viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted/60")}
            >
              <Grid2X2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <button onClick={() => loadFolder(currentPath)} className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          {canWrite && (
            <>
              <Button size="sm" variant="outline" onClick={() => setNewFolderOpen(true)} className="h-8 text-xs gap-1">
                <Plus className="h-3.5 w-3.5" /> New folder
              </Button>
              <Button size="sm" variant="brand" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="h-8 text-xs gap-1">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Upload
              </Button>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} />
            </>
          )}

          {isAdmin && (
            <a
              href="https://onedrive.live.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground transition-colors text-xs"
              title="Manage sharing in OneDrive"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Manage in OneDrive</span>
            </a>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-0.5 px-4 py-1.5 border-b bg-card flex-shrink-0 overflow-x-auto">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                filterTab === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/60",
              )}
            >
              {tab.label}
            </button>
          ))}
          {searchResults !== null && (
            <span className="ml-auto text-xs text-muted-foreground flex-shrink-0">
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &ldquo;{searchQuery}&rdquo;
              <button onClick={() => { setSearchQuery(""); setSearchResults(null); }} className="ml-1.5 hover:text-foreground"><X className="h-3 w-3 inline" /></button>
            </span>
          )}
        </div>

        {/* Content area */}
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
              <thead className="sticky top-0 bg-muted z-10">
                <tr className="border-b">
                  <th className="text-left px-4 py-2 font-semibold text-xs text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-2 font-semibold text-xs text-muted-foreground w-36">Modified</th>
                  <th className="text-left px-4 py-2 font-semibold text-xs text-muted-foreground w-36">Modified by</th>
                  <th className="text-right px-4 py-2 font-semibold text-xs text-muted-foreground w-24">Size</th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map((item) => (
                  <tr
                    key={item.id}
                    className="group border-b hover:bg-muted/30 transition-colors cursor-pointer"
                    onDoubleClick={() => {
                      if (item.isFolder) navigate(`${currentPath === "/" ? "" : currentPath}/${item.name}`);
                      else if (item.downloadUrl) window.open(item.downloadUrl, "_blank");
                    }}
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ItemIcon item={item} className="h-4 w-4" />
                        <span className="truncate font-medium">{item.name}</span>
                        {item.isFolder && typeof item.childCount === "number" && (
                          <span className="text-xs text-muted-foreground flex-shrink-0">{item.childCount}</span>
                        )}
                        {!item.isFolder && item.downloadUrl && (
                          <a
                            href={item.downloadUrl}
                            download={item.name}
                            onClick={(e) => e.stopPropagation()}
                            className="ml-auto opacity-0 group-hover:opacity-100 text-xs text-primary hover:underline flex-shrink-0 transition-opacity"
                          >
                            Download
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">
                      {formatDate(item.lastModifiedDateTime)}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">{item.modifiedByName || "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground text-xs text-right font-variant-numeric tabular-nums">
                      {item.isFolder ? "—" : formatSize(item.size)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            /* Grid view */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 p-4">
              {displayItems.map((item) => (
                <button
                  key={item.id}
                  onDoubleClick={() => {
                    if (item.isFolder) navigate(`${currentPath === "/" ? "" : currentPath}/${item.name}`);
                    else if (item.downloadUrl) window.open(item.downloadUrl, "_blank");
                  }}
                  onClick={() => {
                    if (item.isFolder) navigate(`${currentPath === "/" ? "" : currentPath}/${item.name}`);
                  }}
                  className="group flex flex-col items-center gap-2 rounded-xl border bg-card p-3 text-center hover:bg-muted/40 transition-colors"
                >
                  <ItemIcon item={item} className="h-10 w-10" />
                  <span className="text-xs font-medium leading-tight text-foreground/80 line-clamp-2">{item.name}</span>
                  {!item.isFolder && (
                    <span className="text-[10px] text-muted-foreground">{formatSize(item.size)}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer bar */}
        <div className="border-t px-4 py-1.5 flex items-center justify-between bg-muted/20 flex-shrink-0">
          <span className="text-xs text-muted-foreground">
            {displayItems.filter((i) => i.isFolder).length} folder{displayItems.filter((i) => i.isFolder).length !== 1 ? "s" : ""}
            {displayItems.filter((i) => !i.isFolder).length > 0 && (
              <> · {displayItems.filter((i) => !i.isFolder).length} file{displayItems.filter((i) => !i.isFolder).length !== 1 ? "s" : ""}</>
            )}
            {displayItems.filter((i) => !i.isFolder).length > 0 && (
              <> · {formatSize(displayItems.filter((i) => !i.isFolder).reduce((s, i) => s + i.size, 0))}</>
            )}
          </span>
          <span className="text-[11px] text-muted-foreground italic">
            common.drive@nationalgroupindia.com
          </span>
        </div>
      </div>

      {/* New folder dialog */}
      <Dialog open={newFolderOpen} onOpenChange={(v) => !v && setNewFolderOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New folder</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Folder name</Label>
              <Input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                placeholder="e.g. Project Files"
              />
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
