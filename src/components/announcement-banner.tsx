"use client";

import * as React from "react";
import Link from "next/link";
import { X, Info, CheckCircle2, AlertTriangle, Siren, Pin } from "lucide-react";
import { cn } from "@/lib/utils";

type AnnouncementType = "INFO" | "SUCCESS" | "WARNING" | "URGENT";

type Announcement = {
  id: string;
  title: string;
  body: string;
  type: AnnouncementType;
  isPinned: boolean;
};

const TYPE_CONFIG: Record<
  AnnouncementType,
  { icon: React.ElementType; containerCls: string; iconCls: string }
> = {
  INFO: {
    icon: Info,
    containerCls: "border-blue-500/30 bg-blue-500/10 text-blue-900 dark:text-blue-100",
    iconCls: "text-blue-500",
  },
  SUCCESS: {
    icon: CheckCircle2,
    containerCls: "border-green-500/30 bg-green-500/10 text-green-900 dark:text-green-100",
    iconCls: "text-green-500",
  },
  WARNING: {
    icon: AlertTriangle,
    containerCls: "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100",
    iconCls: "text-amber-500",
  },
  URGENT: {
    icon: Siren,
    containerCls: "border-red-500/40 bg-red-500/10 text-red-900 dark:text-red-100",
    iconCls: "text-red-500",
  },
};

const DISMISS_KEY = "dismissed-announcements-v1";

function getDismissed(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function addDismissed(id: string) {
  try {
    const dismissed = getDismissed();
    dismissed.add(id);
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...dismissed]));
  } catch { /* noop */ }
}

export function AnnouncementBanner({
  announcements,
}: {
  announcements: Announcement[];
}) {
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setDismissed(getDismissed());
    setMounted(true);
  }, []);

  const visible = announcements.filter((a) => !dismissed.has(a.id));

  if (!mounted || visible.length === 0) return null;

  function dismiss(id: string) {
    addDismissed(id);
    setDismissed((prev) => new Set([...prev, id]));
  }

  // Show the topmost announcement (pinned first, then most recent)
  const top = visible[0];
  const cfg = TYPE_CONFIG[top.type];
  const Icon = cfg.icon;
  const hasMore = visible.length > 1;

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        cfg.containerCls,
      )}
    >
      <Icon className={cn("h-4 w-4 flex-shrink-0 mt-0.5", cfg.iconCls)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {top.isPinned && <Pin className="h-3 w-3 opacity-60" />}
          <span className="font-semibold">{top.title}</span>
        </div>
        <p className="opacity-90 line-clamp-2 mt-0.5">{top.body}</p>
        {hasMore && (
          <Link
            href="/announcements"
            className="mt-1 text-xs underline underline-offset-2 opacity-70 hover:opacity-100"
          >
            +{visible.length - 1} more announcement{visible.length - 1 > 1 ? "s" : ""}
          </Link>
        )}
      </div>
      <button
        onClick={() => dismiss(top.id)}
        className="flex-shrink-0 rounded-md p-1 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
