"use client";

import * as React from "react";
import { X, UserPlus, Trash2, Eye, Edit2, Loader2, Share2 } from "lucide-react";

type ShareEntry = {
  id: string;
  permission: "VIEW" | "EDIT";
  sharedWith: { id: string; name: string | null; email: string; image: string | null };
};

export function ShareDialog({
  spreadsheetId,
  spreadsheetName,
  onClose,
}: {
  spreadsheetId: string;
  spreadsheetName: string;
  onClose: () => void;
}) {
  const [shares, setShares]     = React.useState<ShareEntry[]>([]);
  const [loading, setLoading]   = React.useState(true);
  const [email, setEmail]       = React.useState("");
  const [perm, setPerm]         = React.useState<"VIEW" | "EDIT">("VIEW");
  const [adding, setAdding]     = React.useState(false);
  const [error, setError]       = React.useState("");
  const emailRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    emailRef.current?.focus();
    fetch(`/api/sheets/${spreadsheetId}/shares`)
      .then((r) => r.json())
      .then((data) => { setShares(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [spreadsheetId]);

  async function addShare() {
    setError("");
    if (!email.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/sheets/${spreadsheetId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), permission: perm }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.error ?? "User not found"); setAdding(false); return; }
      setShares((prev) => {
        const idx = prev.findIndex((s) => s.id === data.id);
        return idx >= 0 ? prev.map((s) => s.id === data.id ? data : s) : [...prev, data];
      });
      setEmail("");
    } catch { setError("Something went wrong"); }
    finally { setAdding(false); }
  }

  async function removeShare(shareId: string) {
    await fetch(`/api/sheets/${spreadsheetId}/shares/${shareId}`, { method: "DELETE" });
    setShares((prev) => prev.filter((s) => s.id !== shareId));
  }

  async function updatePerm(shareId: string, permission: "VIEW" | "EDIT") {
    const res = await fetch(`/api/sheets/${spreadsheetId}/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: shares.find((s) => s.id === shareId)?.sharedWith.email,
        permission,
      }),
    });
    if (res.ok) setShares((prev) => prev.map((s) => s.id === shareId ? { ...s, permission } : s));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-xl border bg-background shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-emerald-600" />
            <div>
              <p className="text-[13px] font-semibold">Share workbook</p>
              <p className="text-[11px] text-muted-foreground truncate max-w-[260px]">{spreadsheetName}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Add share */}
        <div className="px-5 pt-4 pb-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Invite people</p>
          <div className="flex gap-2">
            <input
              ref={emailRef}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") addShare(); e.stopPropagation(); }}
              placeholder="Enter email address…"
              className="flex-1 h-8 rounded-md border border-border bg-background px-3 text-[12px] outline-none focus:border-primary"
            />
            <select
              value={perm}
              onChange={(e) => setPerm(e.target.value as "VIEW" | "EDIT")}
              className="h-8 rounded-md border border-border bg-background px-2 text-[12px] outline-none cursor-pointer"
            >
              <option value="VIEW">View only</option>
              <option value="EDIT">Can edit</option>
            </select>
            <button
              onClick={addShare}
              disabled={adding || !email.trim()}
              className="h-8 flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-[12px] font-medium text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors"
            >
              {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
              Share
            </button>
          </div>
          {error && <p className="mt-1.5 text-[11px] text-destructive">{error}</p>}
        </div>

        {/* Current shares */}
        <div className="px-5 pb-4 flex-1 overflow-auto">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">People with access</p>
          {loading ? (
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          ) : shares.length === 0 ? (
            <p className="text-[12px] text-muted-foreground py-2">Not shared with anyone yet.</p>
          ) : (
            <ul className="space-y-2">
              {shares.map((share) => (
                <li key={share.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                  {/* Avatar */}
                  <div className="h-7 w-7 flex-shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary">
                    {(share.sharedWith.name ?? share.sharedWith.email)[0].toUpperCase()}
                  </div>
                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium truncate">{share.sharedWith.name ?? share.sharedWith.email}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{share.sharedWith.email}</p>
                  </div>
                  {/* Permission toggle */}
                  <select
                    value={share.permission}
                    onChange={(e) => updatePerm(share.id, e.target.value as "VIEW" | "EDIT")}
                    className="h-6 rounded border border-border bg-background px-1.5 text-[11px] cursor-pointer outline-none"
                  >
                    <option value="VIEW">View only</option>
                    <option value="EDIT">Can edit</option>
                  </select>
                  {/* Remove */}
                  <button
                    onClick={() => removeShare(share.id)}
                    className="rounded p-1 hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                    title="Remove access"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Permission legend */}
        <div className="border-t px-5 py-3 flex gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> View only — can open and copy, cannot edit</span>
          <span className="flex items-center gap-1"><Edit2 className="h-3 w-3" /> Can edit — full editing access</span>
        </div>
      </div>
    </div>
  );
}
