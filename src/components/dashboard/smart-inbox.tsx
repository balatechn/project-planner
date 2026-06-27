"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowRight, BellOff, BookOpen, Calendar,
  CheckSquare, ChevronDown, ChevronUp, Clock, ExternalLink,
  Loader2, Phone, RefreshCw, ShoppingCart, Sparkles,
  TrendingUp, Users, X, CheckCircle2,
} from "lucide-react";
import { format, formatDistanceToNow, isToday, isTomorrow } from "date-fns";
import { cn } from "@/lib/utils";

/* ─── types ────────────────────────────────────────────────── */
type TaskRow = {
  id: string; title: string; priority: string; status: string;
  dueDate: string | null; projectId: string; projectName: string; projectColor: string;
};
type MeetingRow = {
  id: string; title: string; startTime: string; endTime: string; roomName: string;
};
type InboxData = {
  stats: { pending: number; completedToday: number; urgent: number };
  sections: {
    todaysTasks: TaskRow[]; pendingFollowUps: TaskRow[]; delegatedTasks: TaskRow[];
    teamPending: TaskRow[]; upcomingMeetings: MeetingRow[]; awaitingApproval: TaskRow[];
    callsToMake: TaskRow[]; procurement: TaskRow[]; notes: TaskRow[];
  };
};

/* ─── section config ───────────────────────────────────────── */
const SECTIONS = [
  { key: "todaysTasks",      label: "Today's Tasks",       Icon: CheckSquare,  color: "text-green-600"  },
  { key: "pendingFollowUps", label: "Pending Follow-ups",  Icon: RefreshCw,    color: "text-blue-600"   },
  { key: "delegatedTasks",   label: "Delegated Tasks",     Icon: ArrowRight,   color: "text-orange-500" },
  { key: "teamPending",      label: "Team Pending",        Icon: Users,        color: "text-violet-600" },
  { key: "upcomingMeetings", label: "Upcoming Meetings",   Icon: Calendar,     color: "text-indigo-600" },
  { key: "awaitingApproval", label: "Awaiting Approval",   Icon: Clock,        color: "text-amber-600"  },
  { key: "callsToMake",      label: "Calls to Make",       Icon: Phone,        color: "text-emerald-600"},
  { key: "procurement",      label: "Procurement",         Icon: ShoppingCart, color: "text-purple-600" },
  { key: "notes",            label: "Notes",               Icon: BookOpen,     color: "text-gray-500"   },
] as const;

/* ─── helpers ──────────────────────────────────────────────── */
function dueDateLabel(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isToday(d)) return { label: "Today", cls: "text-red-600" };
  if (isTomorrow(d)) return { label: "Tomorrow", cls: "text-amber-600" };
  return { label: formatDistanceToNow(d, { addSuffix: true }), cls: "text-muted-foreground" };
}
const PRIORITY_COLOR: Record<string, string> = {
  HIGH: "bg-red-500/10 text-red-600",
  MEDIUM: "bg-amber-500/10 text-amber-600",
  LOW: "bg-slate-500/10 text-slate-500",
};

/* ─── sub-components ───────────────────────────────────────── */
function TaskItem({ task }: { task: TaskRow }) {
  const due = dueDateLabel(task.dueDate);
  return (
    <Link
      href={`/projects/${task.projectId}?task=${task.id}`}
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors"
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: task.projectColor }} />
      <span className="min-w-0 flex-1 truncate text-xs">{task.title}</span>
      {due && <span className={cn("shrink-0 text-[10px]", due.cls)}>{due.label}</span>}
      <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase", PRIORITY_COLOR[task.priority])}>
        {task.priority[0]}
      </span>
    </Link>
  );
}

function MeetingItem({ meeting }: { meeting: MeetingRow }) {
  const start = new Date(meeting.startTime);
  return (
    <Link
      href="/meeting-rooms"
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors"
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
      <span className="min-w-0 flex-1 truncate text-xs">{meeting.title}</span>
      <span className="shrink-0 text-[10px] text-muted-foreground">
        {format(start, "dd MMM, h:mm a")}
      </span>
      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/60" />
    </Link>
  );
}

/* ─── main component ───────────────────────────────────────── */
export function SmartInbox() {
  const [data, setData] = React.useState<InboxData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [text, setText] = React.useState("");
  const [analyzing, setAnalyzing] = React.useState(false);
  const [analyzeResult, setAnalyzeResult] = React.useState<{ created: number; total: number } | null>(null);
  const [analyzeError, setAnalyzeError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState<Set<string>>(new Set(["todaysTasks"]));

  async function loadData() {
    try {
      const res = await fetch("/api/dashboard/smart-inbox");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { loadData(); }, []);

  function toggle(key: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function analyze() {
    if (!text.trim() || analyzing) return;
    setAnalyzing(true);
    setAnalyzeResult(null);
    setAnalyzeError(null);
    try {
      const res = await fetch("/api/dashboard/smart-inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const d = await res.json();
      if (res.ok) {
        setAnalyzeResult({ created: d.created, total: d.total });
        setText("");
        setLoading(true);
        loadData();
      } else {
        setAnalyzeError(d.error ?? "Failed to analyze");
      }
    } catch {
      setAnalyzeError("Network error. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-2 overflow-y-auto thin-scroll pr-0.5">

      {/* ── AI input ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 rounded-xl border bg-card p-3">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) analyze(); }}
            placeholder="Type anything — tasks, reminders, meeting notes, ideas..."
            rows={3}
            disabled={analyzing}
            className="min-w-0 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="mt-2 flex items-center justify-between pl-6">
          <span className="text-[10px] text-muted-foreground">Paste text, email, or type anything… Ctrl+Enter</span>
          <button
            onClick={analyze}
            disabled={!text.trim() || analyzing}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
          >
            {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Analyze
          </button>
        </div>

        {/* feedback chips */}
        {analyzeResult && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs dark:border-emerald-800 dark:bg-emerald-950/40">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span className="flex-1 text-emerald-800 dark:text-emerald-200">
              {analyzeResult.created} task{analyzeResult.created !== 1 ? "s" : ""} created
              {analyzeResult.total > analyzeResult.created ? ` (${analyzeResult.total - analyzeResult.created} skipped)` : ""}
            </span>
            <button onClick={() => setAnalyzeResult(null)} className="text-emerald-500 hover:text-emerald-700">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        {analyzeError && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs dark:border-red-800 dark:bg-red-950/40">
            <span className="flex-1 text-red-700 dark:text-red-300">{analyzeError}</span>
            <button onClick={() => setAnalyzeError(null)} className="text-red-400 hover:text-red-600">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* ── Stats row ────────────────────────────────────────── */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-1.5">
        {[
          { label: "Pending",         value: data?.stats.pending ?? 0,        Icon: CheckSquare,  bg: "bg-blue-500/10",   text: "text-blue-600"   },
          { label: "Completed Today", value: data?.stats.completedToday ?? 0, Icon: TrendingUp,   bg: "bg-green-500/10",  text: "text-green-600"  },
          { label: "Urgent",          value: data?.stats.urgent ?? 0,         Icon: AlertTriangle,bg: "bg-red-500/10",    text: "text-red-600"    },
          { label: "Snoozed",         value: 0,                               Icon: BellOff,      bg: "bg-amber-500/10",  text: "text-amber-600"  },
        ].map(({ label, value, Icon, bg, text: textCls }) => (
          <div key={label} className={cn("rounded-xl p-2 flex flex-col items-center gap-0.5", bg)}>
            <div className={cn("flex items-center gap-1", textCls)}>
              <Icon className="h-3.5 w-3.5" />
              <span className="text-lg font-bold leading-none">{loading ? "…" : value}</span>
            </div>
            <p className="text-center text-[9px] leading-tight text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Collapsible sections ──────────────────────────────── */}
      <div className="flex flex-col gap-1">
        {SECTIONS.map(({ key, label, Icon, color }) => {
          const isOpen = open.has(key);
          const items = (data?.sections as Record<string, TaskRow[] | MeetingRow[]> | undefined)?.[key] ?? [];
          const count = items.length;

          return (
            <div key={key} className="overflow-hidden rounded-xl border bg-card">
              <button
                onClick={() => toggle(key)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
              >
                <Icon className={cn("h-4 w-4 shrink-0", color)} />
                <span className="flex-1 text-sm font-medium">{label}</span>
                <span className={cn(
                  "min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold",
                  count > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}>
                  {loading ? "…" : count}
                </span>
                {isOpen
                  ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              </button>

              {isOpen && (
                <div className="border-t px-1 py-1">
                  {count === 0 ? (
                    <p className="py-2 text-center text-xs text-muted-foreground">Nothing here</p>
                  ) : key === "upcomingMeetings" ? (
                    (items as MeetingRow[]).map((m) => <MeetingItem key={m.id} meeting={m} />)
                  ) : (
                    (items as TaskRow[]).map((t) => <TaskItem key={t.id} task={t} />)
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
