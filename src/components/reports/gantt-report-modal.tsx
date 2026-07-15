"use client";

import * as React from "react";
import Link from "next/link";
import { BarChart3, ChevronDown, FileSpreadsheet } from "lucide-react";

export function GanttReportModal({
  projects,
}: {
  projects: { id: string; name: string }[];
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const firstId = projects[0]?.id ?? "";

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen(v => !v)}
        className="flex items-center gap-1.5 h-9 px-3 rounded-md border bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors"
      >
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        Reports
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-40 min-w-[180px] rounded-md border bg-popover shadow-md py-1">
            <Link
              href={`/reports/gantt${firstId ? `?projectId=${firstId}` : ""}`}
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
              Gantt Chart Report
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
