"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Plus, Trash2, Edit2, Check, X, Share2, Eye } from "lucide-react";
import { ShareDialog } from "./share-dialog";

type Workbook = {
  id: string;
  name: string;
  updatedAt: string;
  _count: { tabs: number };
};

type SharedEntry = {
  shareId: string;
  permission: "VIEW" | "EDIT";
  sharedBy: { id: string; name: string | null; email: string };
  workbook: Workbook;
};

export function SheetsIndexClient({
  initialOwned,
  initialShared,
}: {
  initialOwned: Workbook[];
  initialShared: SharedEntry[];
}) {
  const router = useRouter();
  const [workbooks, setWorkbooks]   = React.useState<Workbook[]>(initialOwned);
  const [shared]                    = React.useState<SharedEntry[]>(initialShared);
  const [creating, setCreating]     = React.useState(false);
  const [newName, setNewName]       = React.useState("");
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameVal, setRenameVal]   = React.useState("");
  const [shareTarget, setShareTarget] = React.useState<Workbook | null>(null);
  const inputRef  = React.useRef<HTMLInputElement>(null);
  const renameRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { if (creating) inputRef.current?.focus(); }, [creating]);
  React.useEffect(() => { if (renamingId) renameRef.current?.select(); }, [renamingId]);

  async function createWorkbook() {
    const name = newName.trim() || "Untitled Spreadsheet";
    setCreating(false); setNewName("");
    const res = await fetch("/api/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const wb = await res.json();
      router.push(`/sheets/${wb.id}`);
    }
  }

  async function deleteWorkbook(id: string) {
    if (!confirm("Delete this workbook? All data will be lost.")) return;
    await fetch(`/api/sheets/${id}`, { method: "DELETE" });
    setWorkbooks((prev) => prev.filter((w) => w.id !== id));
  }

  async function renameWorkbook(id: string) {
    const name = renameVal.trim();
    if (!name) { setRenamingId(null); return; }
    setWorkbooks((prev) => prev.map((w) => w.id === id ? { ...w, name } : w));
    setRenamingId(null);
    await fetch(`/api/sheets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  }

  function WorkbookCard({ wb, owned }: { wb: Workbook; owned: boolean }) {
    return (
      <div className="group relative flex flex-col rounded-lg border bg-card hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer">
        <Link href={`/sheets/${wb.id}`} className="block">
          <div className="h-28 rounded-t-lg bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-950/30 dark:to-green-900/20 flex items-center justify-center">
            <FileSpreadsheet className="h-10 w-10 text-emerald-500 opacity-60" />
          </div>
        </Link>
        <div className="px-3 py-2">
          {owned && renamingId === wb.id ? (
            <div className="flex items-center gap-1">
              <input
                ref={renameRef}
                value={renameVal}
                onChange={(e) => setRenameVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter")  renameWorkbook(wb.id);
                  if (e.key === "Escape") setRenamingId(null);
                  e.stopPropagation();
                }}
                onBlur={() => renameWorkbook(wb.id)}
                className="flex-1 min-w-0 bg-transparent border-b border-primary outline-none text-[12px]"
              />
            </div>
          ) : (
            <p
              className="text-[12px] font-medium truncate"
              onDoubleClick={() => owned && (setRenamingId(wb.id), setRenameVal(wb.name))}
              title={wb.name}
            >
              {wb.name}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {wb._count.tabs} tab{wb._count.tabs !== 1 ? "s" : ""} · {new Date(wb.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
          </p>
        </div>

        {/* Owned: rename / share / delete buttons */}
        {owned && (
          <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.preventDefault(); setRenamingId(wb.id); setRenameVal(wb.name); }}
              className="rounded p-1 bg-background/80 backdrop-blur border shadow-sm hover:bg-muted"
              title="Rename"
            ><Edit2 className="h-3 w-3" /></button>
            <button
              onClick={(e) => { e.preventDefault(); setShareTarget(wb); }}
              className="rounded p-1 bg-background/80 backdrop-blur border shadow-sm hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-900"
              title="Share"
            ><Share2 className="h-3 w-3" /></button>
            <button
              onClick={(e) => { e.preventDefault(); deleteWorkbook(wb.id); }}
              className="rounded p-1 bg-background/80 backdrop-blur border shadow-sm hover:bg-destructive/10 hover:text-destructive"
              title="Delete"
            ><Trash2 className="h-3 w-3" /></button>
          </div>
        )}
      </div>
    );
  }

  const totalOwned = workbooks.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
          <h1 className="text-lg font-semibold">Sheets</h1>
        </div>
        <button
          onClick={() => { setCreating(true); setNewName(""); }}
          className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-emerald-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> New Workbook
        </button>
      </div>

      <div className="px-6 py-5 space-y-8">
        {/* ── My Documents ─────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-[13px] font-semibold">My Documents</h2>
            <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {totalOwned}
            </span>
          </div>

          {/* New workbook inline form */}
          {creating && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600 flex-shrink-0" />
              <input
                ref={inputRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter")  createWorkbook();
                  if (e.key === "Escape") { setCreating(false); setNewName(""); }
                }}
                placeholder="Workbook name…"
                className="flex-1 bg-transparent outline-none text-[13px]"
              />
              <button onClick={createWorkbook} className="rounded p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700"><Check className="h-4 w-4" /></button>
              <button onClick={() => { setCreating(false); setNewName(""); }} className="rounded p-1 hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
          )}

          {workbooks.length === 0 && !creating ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground border border-dashed rounded-lg">
              <FileSpreadsheet className="h-10 w-10 opacity-20" />
              <p className="text-[12px]">No workbooks yet. Click &ldquo;New Workbook&rdquo; to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {workbooks.map((wb) => <WorkbookCard key={wb.id} wb={wb} owned={true} />)}
            </div>
          )}
        </section>

        {/* ── Shared with Me ────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-[13px] font-semibold">Shared with Me</h2>
            <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {shared.length}
            </span>
          </div>

          {shared.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground border border-dashed rounded-lg">
              <Share2 className="h-10 w-10 opacity-20" />
              <p className="text-[12px]">No one has shared a workbook with you yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {shared.map((entry) => (
                <div key={entry.shareId} className="relative flex flex-col rounded-lg border bg-card hover:border-emerald-400 hover:shadow-md transition-all">
                  <Link href={`/sheets/${entry.workbook.id}`} className="block">
                    <div className="h-28 rounded-t-lg bg-gradient-to-br from-sky-50 to-blue-100 dark:from-sky-950/30 dark:to-blue-900/20 flex items-center justify-center">
                      <FileSpreadsheet className="h-10 w-10 text-sky-500 opacity-60" />
                    </div>
                  </Link>
                  <div className="px-3 py-2">
                    <p className="text-[12px] font-medium truncate" title={entry.workbook.name}>{entry.workbook.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      by {entry.sharedBy.name ?? entry.sharedBy.email}
                    </p>
                    <div className="mt-1">
                      {entry.permission === "EDIT" ? (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">
                          <Edit2 className="h-2.5 w-2.5" /> Can edit
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-400">
                          <Eye className="h-2.5 w-2.5" /> View only
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Share dialog */}
      {shareTarget && (
        <ShareDialog
          spreadsheetId={shareTarget.id}
          spreadsheetName={shareTarget.name}
          onClose={() => setShareTarget(null)}
        />
      )}
    </div>
  );
}
