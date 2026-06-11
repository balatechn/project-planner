"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  Clock,
  CornerDownLeft,
  FolderKanban,
  GanttChartSquare,
  GraduationCap,
  Keyboard,
  LayoutDashboard,
  Loader2,
  Search,
  Users,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PageCommand = {
  kind: "page";
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** two-key "go to" shortcut, e.g. "g d" */
  chord?: string;
};
type ProjectResult = {
  kind: "project";
  id: string;
  name: string;
  key: string;
  color: string | null;
};
type TaskResult = {
  kind: "task";
  id: string;
  title: string;
  status: string;
  project: { id: string; name: string };
};
type Item = PageCommand | ProjectResult | TaskResult;

const PAGES: PageCommand[] = [
  { kind: "page", id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, chord: "g d" },
  { kind: "page", id: "projects", label: "Projects", href: "/projects", icon: FolderKanban, chord: "g p" },
  { kind: "page", id: "my-tasks", label: "My Tasks", href: "/my-tasks", icon: CheckSquare, chord: "g t" },
  { kind: "page", id: "portfolio", label: "Portfolio", href: "/portfolio", icon: GanttChartSquare },
  { kind: "page", id: "calendar", label: "Calendar", href: "/calendar", icon: CalendarDays, chord: "g c" },
  { kind: "page", id: "rooms", label: "Meeting Rooms", href: "/meeting-rooms", icon: Video, chord: "g r" },
  { kind: "page", id: "training", label: "Training", href: "/training", icon: GraduationCap },
  { kind: "page", id: "team", label: "Team Directory", href: "/team", icon: Users },
  { kind: "page", id: "timesheets", label: "My Timesheets", href: "/my-timesheets", icon: Clock },
  { kind: "page", id: "reports", label: "Reports", href: "/reports", icon: BarChart3 },
];

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "Ctrl K", action: "Open command palette" },
  { keys: "g d", action: "Go to Dashboard" },
  { keys: "g p", action: "Go to Projects" },
  { keys: "g t", action: "Go to My Tasks" },
  { keys: "g c", action: "Go to Calendar" },
  { keys: "g r", action: "Go to Meeting Rooms" },
  { keys: "?", action: "Show keyboard shortcuts" },
  { keys: "Esc", action: "Close dialogs" },
];

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  );
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [projects, setProjects] = React.useState<ProjectResult[]>([]);
  const [tasks, setTasks] = React.useState<TaskResult[]>([]);
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const chordRef = React.useRef<{ key: string; at: number } | null>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Global key handling: Ctrl+K, g-chords, ? ──
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setHelpOpen(false);
        setOpen((v) => !v);
        return;
      }
      if (open || helpOpen || isTypingTarget(e.target)) return;

      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }

      // Two-key "g x" navigation chords (1.5 s window)
      const now = Date.now();
      if (chordRef.current?.key === "g" && now - chordRef.current.at < 1500) {
        const target = PAGES.find((p) => p.chord === `g ${e.key.toLowerCase()}`);
        chordRef.current = null;
        if (target) {
          e.preventDefault();
          router.push(target.href);
          return;
        }
      }
      if (e.key.toLowerCase() === "g" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        chordRef.current = { key: "g", at: now };
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, helpOpen, router]);

  // ── Reset + focus when palette opens ──
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setProjects([]);
      setTasks([]);
      setActive(0);
      // Focus after the element mounts
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // ── Debounced instant search ──
  React.useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setProjects([]);
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const d = await res.json();
          setProjects((d.projects ?? []).map((p: Omit<ProjectResult, "kind">) => ({ kind: "project" as const, ...p })));
          setTasks((d.tasks ?? []).map((t: Omit<TaskResult, "kind">) => ({ kind: "task" as const, ...t })));
          setActive(0);
        }
      } catch {
        // network hiccup — keep previous results
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  // ── Flat item list for keyboard navigation ──
  const filteredPages = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PAGES;
    return PAGES.filter((p) => p.label.toLowerCase().includes(q));
  }, [query]);

  const items: Item[] = React.useMemo(
    () => [...filteredPages, ...projects, ...tasks],
    [filteredPages, projects, tasks],
  );

  function go(item: Item) {
    setOpen(false);
    if (item.kind === "page") router.push(item.href);
    else if (item.kind === "project") router.push(`/projects/${item.id}`);
    else router.push(`/projects/${item.project.id}?task=${item.id}`);
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && items[active]) {
      e.preventDefault();
      go(items[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Index offsets for rendering grouped sections with a single active index
  let idx = -1;

  return (
    <>
      {/* ── Command palette overlay ── */}
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 backdrop-blur-sm pt-[12vh] px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl animate-scale-in">
            {/* Search input */}
            <div className="flex items-center gap-3 border-b px-4">
              {loading ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Search projects, tasks, or jump to a page…"
                className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="hidden sm:block shrink-0 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-[50vh] overflow-y-auto thin-scroll p-2">
              {items.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {query.trim().length >= 2 && !loading
                    ? `No results for "${query}"`
                    : "Type to search…"}
                </p>
              )}

              {filteredPages.length > 0 && (
                <div className="mb-1">
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Pages
                  </p>
                  {filteredPages.map((p) => {
                    idx += 1;
                    const i = idx;
                    const Icon = p.icon;
                    return (
                      <button
                        key={p.id}
                        onClick={() => go(p)}
                        onMouseEnter={() => setActive(i)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                          active === i ? "bg-primary/10 text-primary" : "text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 text-left">{p.label}</span>
                        {p.chord && (
                          <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {p.chord}
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {projects.length > 0 && (
                <div className="mb-1">
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Projects
                  </p>
                  {projects.map((p) => {
                    idx += 1;
                    const i = idx;
                    return (
                      <button
                        key={p.id}
                        onClick={() => go(p)}
                        onMouseEnter={() => setActive(i)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                          active === i ? "bg-primary/10 text-primary" : "text-foreground",
                        )}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: p.color ?? "hsl(var(--primary))" }}
                        />
                        <span className="flex-1 truncate text-left">{p.name}</span>
                        <span className="text-[10px] font-medium text-muted-foreground">{p.key}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {tasks.length > 0 && (
                <div>
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Tasks
                  </p>
                  {tasks.map((t) => {
                    idx += 1;
                    const i = idx;
                    return (
                      <button
                        key={t.id}
                        onClick={() => go(t)}
                        onMouseEnter={() => setActive(i)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                          active === i ? "bg-primary/10 text-primary" : "text-foreground",
                        )}
                      >
                        <CheckSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate text-left">{t.title}</span>
                        <span className="max-w-[140px] truncate text-[10px] text-muted-foreground">
                          {t.project.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer hints */}
            <div className="flex items-center gap-4 border-t bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-card px-1 py-0.5">↑↓</kbd> navigate
              </span>
              <span className="flex items-center gap-1">
                <CornerDownLeft className="h-3 w-3" /> open
              </span>
              <span className="ml-auto flex items-center gap-1">
                <Keyboard className="h-3 w-3" /> press <kbd className="rounded border bg-card px-1 py-0.5">?</kbd> for shortcuts
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Keyboard shortcuts help overlay ── */}
      {helpOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setHelpOpen(false);
          }}
          onKeyDown={(e) => e.key === "Escape" && setHelpOpen(false)}
        >
          <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-5 shadow-2xl animate-scale-in">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
              <Keyboard className="h-4 w-4 text-primary" /> Keyboard shortcuts
            </h3>
            <div className="space-y-1.5">
              {SHORTCUTS.map((s) => (
                <div key={s.keys} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{s.action}</span>
                  <kbd className="rounded border bg-muted px-2 py-0.5 text-[11px] font-medium">
                    {s.keys}
                  </kbd>
                </div>
              ))}
            </div>
            <button
              onClick={() => setHelpOpen(false)}
              className="mt-4 w-full rounded-lg border py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              Close (Esc)
            </button>
          </div>
        </div>
      )}
    </>
  );
}
