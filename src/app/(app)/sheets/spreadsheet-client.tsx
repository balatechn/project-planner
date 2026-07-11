"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  Plus, Trash2, Undo2, Redo2, Download, PaintBucket, Type,
  Save, CheckCircle2, AlertCircle, Loader2,
  Scissors, Copy, Clipboard, WrapText, ChevronUp, ChevronDown,
  Percent, History, RotateCcw, X, Clock, BookOpen,
  SortAsc, SortDesc, Search, Replace, ArrowUp, ArrowDown,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const COLS = 52;
const ROWS = 100;
const DEF_W = 100;
const DEF_H = 24;
const RNW  = 48;
const CHH  = 22;

const FONTS = ["Default", "Arial", "Calibri", "Times New Roman", "Courier New", "Georgia", "Verdana", "Trebuchet MS"];
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 48, 72];

// Colors assigned to each unique cell reference while editing a formula
const REF_COLORS = ["#2563eb","#dc2626","#16a34a","#9333ea","#ea580c","#0891b2","#d97706","#db2777"];

// ── Types ─────────────────────────────────────────────────────────────────────
type NumFmt = "general" | "number" | "currency" | "percent";

type Fmt = {
  bold?:       boolean;
  italic?:     boolean;
  underline?:  boolean;
  align?:      "left" | "center" | "right";
  color?:      string;
  bg?:         string;
  fontSize?:   number;
  fontFamily?: string;
  numFmt?:     NumFmt;
  decPlaces?:  number;
  wrap?:       boolean;
};

type Cell = Fmt & { v: string };

type TabState = {
  id:    string;
  name:  string;
  order: number;
  cells: Record<string, Cell>;
  cw:    Record<string, number>;
};

export type InitialTab = {
  id:    string;
  name:  string;
  order: number;
  cells: Record<string, unknown>;
  cw:    Record<string, number>;
};

type HistoryEntry = {
  id:        string;
  label:     string | null;
  createdAt: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function colLabel(n: number): string {
  let s = "";
  n++;
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

function cid(c: number, r: number): string {
  return `${colLabel(c)}${r + 1}`;
}

function parseRef(ref: string): { c: number; r: number } | null {
  const m = /^([A-Z]{1,3})(\d{1,7})$/.exec(ref);
  if (!m) return null;
  let c = 0;
  for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
  return { c: c - 1, r: parseInt(m[2]) - 1 };
}

// Split a formula string into plain/ref segments for colored rendering
function tokenizeFormula(formula: string): Array<{ text: string; ref?: string }> {
  if (!formula.startsWith("=")) return [{ text: formula }];
  const tokens: Array<{ text: string; ref?: string }> = [{ text: "=" }];
  let rest = formula.slice(1);
  while (rest.length > 0) {
    const m = /^([A-Za-z]{1,3}\d{1,7})/i.exec(rest);
    if (m) {
      tokens.push({ text: m[1], ref: m[1].toUpperCase() });
      rest = rest.slice(m[1].length);
    } else {
      tokens.push({ text: rest[0] });
      rest = rest.slice(1);
    }
  }
  return tokens;
}

function applyNumFmt(val: string, cell?: Cell): string {
  if (!cell) return val;
  const { numFmt, decPlaces } = cell;
  const n = parseFloat(val);
  if (!numFmt || numFmt === "general") {
    if (!isNaN(n) && decPlaces !== undefined) return n.toFixed(decPlaces);
    return val;
  }
  if (isNaN(n)) return val;
  const dp = decPlaces ?? 2;
  if (numFmt === "currency") return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  if (numFmt === "percent")  return (n * 100).toFixed(dp) + "%";
  if (numFmt === "number")   return n.toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  return val;
}

// ── Formula evaluator ─────────────────────────────────────────────────────────
function evalCell(raw: string, cells: Record<string, Cell>, guard = new Set<string>()): string {
  if (!raw || !raw.startsWith("=")) return raw ?? "";

  let expr = raw.slice(1).trim().toUpperCase();

  expr = expr.replace(
    /(SUM|AVERAGE|AVG|COUNT|MAX|MIN|PRODUCT)\(([A-Z]{1,3}\d{1,7}):([A-Z]{1,3}\d{1,7})\)/g,
    (_, fn, a, b) => {
      const vals = rangeNums(a, b, cells, guard);
      switch (fn) {
        case "SUM":     return String(vals.reduce((s, v) => s + v, 0));
        case "COUNT":   return String(vals.length);
        case "MAX":     return vals.length ? String(Math.max(...vals)) : "0";
        case "MIN":     return vals.length ? String(Math.min(...vals)) : "0";
        case "PRODUCT": return String(vals.reduce((s, v) => s * v, 1));
        default:        return vals.length ? String(vals.reduce((s, v) => s + v, 0) / vals.length) : "0";
      }
    }
  );

  expr = expr
    .replace(/SQRT\(/g,  "Math.sqrt(")
    .replace(/ABS\(/g,   "Math.abs(")
    .replace(/ROUND\(/g, "Math.round(")
    .replace(/FLOOR\(/g, "Math.floor(")
    .replace(/CEIL\(/g,  "Math.ceil(")
    .replace(/POW\(/g,   "Math.pow(")
    .replace(/LOG\(/g,   "Math.log10(");

  expr = expr.replace(/([A-Z]{1,3}\d{1,7})/g, (ref) => {
    if (guard.has(ref)) return "0";
    const cell = cells[ref];
    if (!cell?.v) return "0";
    const val = evalCell(cell.v, cells, new Set([...guard, ref]));
    const n = Number(val);
    return isNaN(n) ? `"${val}"` : (val || "0");
  });

  expr = expr.replace(/^IF\((.+),(.+),(.+)\)$/, (_, cond, t, f) => {
    try {
      // eslint-disable-next-line no-new-func
      return new Function(`"use strict"; return Boolean(${cond})`)() ? t.trim() : f.trim();
    } catch { return f.trim(); }
  });

  try {
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${expr})`)();
    if (result == null) return "";
    if (typeof result === "number") {
      if (!isFinite(result)) return "#DIV/0!";
      return String(Math.round(result * 1e10) / 1e10);
    }
    return String(result);
  } catch { return "#ERROR"; }
}

function rangeNums(a: string, b: string, cells: Record<string, Cell>, guard: Set<string>): number[] {
  const fa = parseRef(a), fb = parseRef(b);
  if (!fa || !fb) return [];
  const vals: number[] = [];
  for (let r = Math.min(fa.r, fb.r); r <= Math.max(fa.r, fb.r); r++) {
    for (let c = Math.min(fa.c, fb.c); c <= Math.max(fa.c, fb.c); c++) {
      const key = cid(c, r);
      if (guard.has(key)) continue;
      const cell = cells[key];
      if (!cell?.v) continue;
      const val = evalCell(cell.v, cells, new Set([...guard, key]));
      const n = parseFloat(val);
      if (!isNaN(n)) vals.push(n);
    }
  }
  return vals;
}

// ── Color picker ──────────────────────────────────────────────────────────────
const PALETTE = [
  "#000000","#434343","#666666","#999999","#b7b7b7","#cccccc","#d9d9d9","#ffffff",
  "#ff0000","#ff9900","#ffff00","#00ff00","#00ffff","#4a86e8","#0000ff","#9900ff",
  "#ff00ff","#ff6666","#ffb366","#ffff66","#66ff66","#66ffff","#6fa8dc","#6666ff",
  "#cc0000","#e69138","#f1c232","#6aa84f","#45818e","#3c78d8","#3d85c6","#674ea7",
];

function ColorPicker({ value, onChange, onClose }: {
  value: string; onChange: (v: string) => void; onClose: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    function h(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute top-full left-0 z-50 mt-1 p-2 rounded-lg border bg-popover shadow-xl">
      <div className="grid grid-cols-8 gap-1 mb-2">
        {PALETTE.map((c) => (
          <button key={c}
            className="h-4 w-4 rounded-sm border border-border/30 hover:scale-125 transition-transform"
            style={{ backgroundColor: c }}
            onClick={() => { onChange(c); onClose(); }} />
        ))}
      </div>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full h-7 rounded cursor-pointer" />
    </div>
  );
}

// ── Ribbon group container ─────────────────────────────────────────────────────
function RibbonGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col border-r border-border/40 last:border-r-0 px-1.5 py-1 min-w-fit">
      <div className="flex-1 flex items-start gap-0.5 min-h-[44px]">
        {children}
      </div>
      <div className="text-[9px] text-center text-muted-foreground/60 mt-0.5 leading-none tracking-wide">
        {label}
      </div>
    </div>
  );
}

// ── Toolbar icon button ────────────────────────────────────────────────────────
function TBtn({ onClick, children, title, disabled, active, className }: {
  onClick?: () => void; children: React.ReactNode; title?: string;
  disabled?: boolean; active?: boolean; className?: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={cn(
        "relative flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] transition-colors",
        "hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed",
        active && "bg-muted text-primary",
        className,
      )}>
      {children}
    </button>
  );
}

// ── Large paste-style button ───────────────────────────────────────────────────
function TBtnLg({ onClick, title, icon, label }: {
  onClick: () => void; title: string; icon: React.ReactNode; label: string;
}) {
  return (
    <button onClick={onClick} title={title}
      className="flex flex-col items-center gap-0.5 rounded px-2 py-1 hover:bg-muted transition-colors min-w-[36px]">
      <span className="flex items-center justify-center">{icon}</span>
      <span className="text-[9px] text-muted-foreground leading-none">{label}</span>
    </button>
  );
}

function Sep() {
  return <div className="h-3.5 w-px bg-border/50 mx-0.5 self-center flex-shrink-0" />;
}

// ── Sheet tab button ──────────────────────────────────────────────────────────
function SheetTabBtn({ name, active, onClick, onRename, onDelete, canDelete }: {
  name: string; active: boolean; canDelete: boolean;
  onClick: () => void; onRename: (n: string) => void; onDelete: () => void;
}) {
  const [renaming, setRenaming] = React.useState(false);
  const [val, setVal] = React.useState(name);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { if (renaming) inputRef.current?.select(); }, [renaming]);

  function commit() {
    const trimmed = val.trim() || name;
    onRename(trimmed); setVal(trimmed); setRenaming(false);
  }

  return (
    <div
      className={cn(
        "relative flex h-7 flex-shrink-0 cursor-pointer items-center gap-1 rounded-t border-t-2 px-2.5 text-[11px] whitespace-nowrap transition-colors group",
        active
          ? "border-primary bg-background text-primary font-semibold shadow-sm"
          : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      onClick={onClick}
      onDoubleClick={(e) => { e.stopPropagation(); setRenaming(true); }}
    >
      {renaming ? (
        <input ref={inputRef} value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setVal(name); setRenaming(false); }
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-20 bg-transparent outline-none border-b border-primary font-normal"
        />
      ) : name}
      {active && canDelete && !renaming && (
        <button
          className="ml-0.5 rounded-full p-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-destructive/10 hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete sheet"
        >
          <Trash2 className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function SpreadsheetClient({ initialTabs }: { initialTabs: InitialTab[] }) {
  // ── State ──
  const [tabs, setTabs] = React.useState<TabState[]>(() =>
    initialTabs.map((t) => ({
      id: t.id, name: t.name, order: t.order,
      cells: (t.cells as Record<string, Cell>) ?? {},
      cw: t.cw ?? {},
    }))
  );
  const [activeId, setActiveId]   = React.useState(initialTabs[0]?.id ?? "");
  const [sel, setSel]             = React.useState({ ac: 0, ar: 0, fc: 0, fr: 0 });
  const [editing, setEditing]     = React.useState<{ c: number; r: number } | null>(null);
  const [editVal, setEditVal]     = React.useState("");
  const [colorPicker, setColorPicker] = React.useState<"text" | "bg" | null>(null);
  const [saveStatus, setSaveStatus]   = React.useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const [showHistory, setShowHistory] = React.useState(false);
  const [showFind,    setShowFind]    = React.useState(false);
  const [findVal,     setFindVal]     = React.useState("");
  const [replaceVal,  setReplaceVal]  = React.useState("");
  const [findMatches, setFindMatches] = React.useState<string[]>([]);
  const [findIdx,     setFindIdx]     = React.useState(0);
  const [historyList, setHistoryList] = React.useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [restoring, setRestoring]     = React.useState<string | null>(null);

  // ── Refs ──
  const histRef      = React.useRef<{ past: Record<string, Cell>[]; future: Record<string, Cell>[] }>({ past: [], future: [] });
  const clipRef      = React.useRef<Record<string, Cell> | null>(null);
  const isDragging   = React.useRef(false);
  const saveTimer         = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHistorySave   = React.useRef<Record<string, number>>({});  // tabId → epoch ms
  const gridRef           = React.useRef<HTMLDivElement>(null);
  const editInputRef      = React.useRef<HTMLInputElement>(null);

  // Reset history on tab switch
  const prevActiveId = React.useRef(activeId);
  if (prevActiveId.current !== activeId) {
    prevActiveId.current = activeId;
    histRef.current = { past: [], future: [] };
  }

  // ── Derived ──
  const tab   = tabs.find((t) => t.id === activeId)!;
  const cells = tab?.cells ?? {};
  const minC  = Math.min(sel.ac, sel.fc), maxC = Math.max(sel.ac, sel.fc);
  const minR  = Math.min(sel.ar, sel.fr), maxR = Math.max(sel.ar, sel.fr);

  function cw(c: number) { return tab?.cw[String(c)] ?? DEF_W; }
  function display(c: number, r: number) {
    const cell = cells[cid(c, r)];
    if (!cell?.v) return "";
    const raw = evalCell(cell.v, cells);
    return applyNumFmt(raw, cell);
  }
  function activeCell() { return cells[cid(sel.ac, sel.ar)]; }
  function hasStyle(cell?: Cell) {
    return !!(cell?.bold || cell?.italic || cell?.underline || cell?.align ||
              cell?.color || cell?.bg || cell?.fontSize || cell?.fontFamily ||
              cell?.numFmt || cell?.wrap);
  }

  // ── Auto-save ──
  function scheduleAutoSave(tabId: string, newCells: Record<string, Cell>, newCw?: Record<string, number>) {
    setSaveStatus("unsaved");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const t = tabs.find((t) => t.id === tabId);
        await fetch(`/api/sheets/tabs/${tabId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cells: newCells, colWidths: newCw ?? t?.cw ?? {} }),
        });
        setSaveStatus("saved");

        // Auto-snapshot every 5 minutes
        const last = lastHistorySave.current[tabId] ?? 0;
        if (Date.now() - last >= 5 * 60 * 1000) {
          lastHistorySave.current[tabId] = Date.now();
          const res = await fetch(`/api/sheets/tabs/${tabId}/history`, { method: "POST" });
          if (res.ok) {
            const entry = await res.json();
            setHistoryList((prev) => [entry, ...prev].slice(0, 50));
          }
        }
      } catch { setSaveStatus("error"); }
    }, 1500);
  }

  // ── Mutations ──
  function commitCells(next: Record<string, Cell>) {
    histRef.current.past.push({ ...cells });
    histRef.current.future = [];
    setTabs((prev) => prev.map((t) => (t.id === activeId ? { ...t, cells: next } : t)));
    scheduleAutoSave(activeId, next);
  }

  // ── Edit ──
  function startEdit(c: number, r: number, init?: string) {
    setEditing({ c, r });
    setEditVal(init !== undefined ? init : (cells[cid(c, r)]?.v ?? ""));
  }

  function commitEdit() {
    if (!editing) return;
    const key = cid(editing.c, editing.r);
    const next = { ...cells };
    if (!editVal && !hasStyle(cells[key])) delete next[key];
    else next[key] = { ...(cells[key] ?? {}), v: editVal };
    commitCells(next);
    setEditing(null);
  }

  function cancelEdit() { setEditing(null); }

  React.useEffect(() => {
    if (editing) editInputRef.current?.focus();
    else gridRef.current?.focus();
  }, [editing]);

  // ── Navigate ──
  function move(dc: number, dr: number, extend = false) {
    setSel((s) => {
      if (extend) return {
        ...s,
        fc: Math.max(0, Math.min(COLS - 1, s.fc + dc)),
        fr: Math.max(0, Math.min(ROWS - 1, s.fr + dr)),
      };
      const nc = Math.max(0, Math.min(COLS - 1, s.ac + dc));
      const nr = Math.max(0, Math.min(ROWS - 1, s.ar + dr));
      return { ac: nc, ar: nr, fc: nc, fr: nr };
    });
  }

  // ── Format ──
  function applyFmt(fmt: Partial<Fmt>) {
    const next = { ...cells };
    for (let r = minR; r <= maxR; r++)
      for (let c = minC; c <= maxC; c++) {
        const key = cid(c, r);
        next[key] = { ...(next[key] ?? { v: "" }), ...fmt };
      }
    commitCells(next);
  }

  function changeFontSize(delta: number) {
    const current = activeCell()?.fontSize ?? 12;
    const idx = SIZES.findIndex((s) => s >= current);
    const newIdx = Math.max(0, Math.min(SIZES.length - 1, (idx < 0 ? SIZES.length - 1 : idx) + delta));
    applyFmt({ fontSize: SIZES[newIdx] });
  }

  function changeDecPlaces(delta: number) {
    const current = activeCell()?.decPlaces ?? 0;
    applyFmt({ decPlaces: Math.max(0, Math.min(10, current + delta)) });
  }

  // ── Delete / Clear ──
  function deleteSelection() {
    const next = { ...cells };
    for (let r = minR; r <= maxR; r++)
      for (let c = minC; c <= maxC; c++) {
        const key = cid(c, r);
        if (hasStyle(next[key])) next[key] = { ...next[key]!, v: "" };
        else delete next[key];
      }
    commitCells(next);
  }

  function clearFormatting() {
    const next = { ...cells };
    for (let r = minR; r <= maxR; r++)
      for (let c = minC; c <= maxC; c++) {
        const key = cid(c, r);
        if (next[key]) next[key] = { v: next[key].v };
      }
    commitCells(next);
  }

  // ── Undo / Redo ──
  function undo() {
    const h = histRef.current;
    if (!h.past.length) return;
    h.future.unshift({ ...cells });
    const prev = h.past.pop()!;
    setTabs((s) => s.map((t) => (t.id === activeId ? { ...t, cells: prev } : t)));
    scheduleAutoSave(activeId, prev);
  }

  function redo() {
    const h = histRef.current;
    if (!h.future.length) return;
    h.past.push({ ...cells });
    const next = h.future.shift()!;
    setTabs((s) => s.map((t) => (t.id === activeId ? { ...t, cells: next } : t)));
    scheduleAutoSave(activeId, next);
  }

  // ── Copy / Cut / Paste ──
  function copy() {
    const data: Record<string, Cell> = {};
    for (let r = minR; r <= maxR; r++)
      for (let c = minC; c <= maxC; c++) {
        const cell = cells[cid(c, r)];
        if (cell) data[cid(c - minC, r - minR)] = { ...cell };
      }
    clipRef.current = data;
    const text = Array.from({ length: maxR - minR + 1 }, (_, ri) =>
      Array.from({ length: maxC - minC + 1 }, (_, ci) =>
        display(minC + ci, minR + ri)
      ).join("\t")
    ).join("\n");
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  function cut() { copy(); deleteSelection(); }

  function paste() {
    const clip = clipRef.current;
    if (!clip) return;
    const next = { ...cells };
    for (const [key, cell] of Object.entries(clip)) {
      const ref = parseRef(key);
      if (ref) next[cid(sel.ac + ref.c, sel.ar + ref.r)] = { ...cell };
    }
    commitCells(next);
  }

  // ── Row ops ──
  function insertRow() {
    const r = sel.ar;
    const next: Record<string, Cell> = {};
    for (const [key, cell] of Object.entries(cells)) {
      const ref = parseRef(key);
      if (ref) next[cid(ref.c, ref.r >= r ? ref.r + 1 : ref.r)] = cell;
    }
    commitCells(next);
  }

  function deleteRow() {
    const r = sel.ar;
    const next: Record<string, Cell> = {};
    for (const [key, cell] of Object.entries(cells)) {
      const ref = parseRef(key);
      if (ref && ref.r !== r)
        next[cid(ref.c, ref.r > r ? ref.r - 1 : ref.r)] = cell;
    }
    commitCells(next);
  }

  // ── Col ops ──
  function insertCol() {
    const col = sel.ac;
    const next: Record<string, Cell> = {};
    for (const [key, cell] of Object.entries(cells)) {
      const ref = parseRef(key);
      if (ref) next[cid(ref.c >= col ? ref.c + 1 : ref.c, ref.r)] = cell;
    }
    commitCells(next);
    const newCw = { ...tab.cw };
    for (let i = COLS - 1; i >= col; i--) {
      if (newCw[String(i)] !== undefined) {
        newCw[String(i + 1)] = newCw[String(i)];
        delete newCw[String(i)];
      }
    }
    setTabs((prev) => prev.map((t) => (t.id === activeId ? { ...t, cw: newCw } : t)));
  }

  function deleteCol() {
    const col = sel.ac;
    const next: Record<string, Cell> = {};
    for (const [key, cell] of Object.entries(cells)) {
      const ref = parseRef(key);
      if (ref && ref.c !== col)
        next[cid(ref.c > col ? ref.c - 1 : ref.c, ref.r)] = cell;
    }
    commitCells(next);
  }

  // ── Column resize ──
  function onColResizeStart(e: React.MouseEvent, c: number) {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX, startW = cw(c);
    function onMove(ev: MouseEvent) {
      const w = Math.max(20, startW + ev.clientX - startX);
      setTabs((prev) =>
        prev.map((t) => t.id === activeId ? { ...t, cw: { ...t.cw, [String(c)]: w } } : t)
      );
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setTabs((prev) => {
        const t = prev.find((t) => t.id === activeId);
        if (t) fetch(`/api/sheets/tabs/${activeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cells: t.cells, colWidths: t.cw }),
        });
        return prev;
      });
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // ── CSV export ──
  function exportCSV() {
    let mR = 0, mC = 0;
    for (const key of Object.keys(cells)) {
      const ref = parseRef(key);
      if (ref) { mR = Math.max(mR, ref.r); mC = Math.max(mC, ref.c); }
    }
    const csv = Array.from({ length: mR + 1 }, (_, r) =>
      Array.from({ length: mC + 1 }, (_, c) =>
        `"${display(c, r).replace(/"/g, '""')}"`
      ).join(",")
    ).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${tab.name}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ── Excel (.xlsx) export ──
  async function exportXLSX() {
    const XLSX = await import("xlsx");
    let mR = 0, mC = 0;
    for (const key of Object.keys(cells)) {
      const ref = parseRef(key);
      if (ref) { mR = Math.max(mR, ref.r); mC = Math.max(mC, ref.c); }
    }
    const aoa: string[][] = Array.from({ length: mR + 1 }, (_, r) =>
      Array.from({ length: mC + 1 }, (_, c) => display(c, r))
    );
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tab.name);
    XLSX.writeFile(wb, `${tab.name}.xlsx`);
  }

  // ── Tab management ──
  async function addTab() {
    const name = `Sheet${tabs.length + 1}`;
    try {
      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, orderIndex: tabs.length }),
      });
      const newTab = await res.json();
      setTabs((prev) => [...prev, { id: newTab.id, name, order: tabs.length, cells: {}, cw: {} }]);
      setActiveId(newTab.id);
      setSel({ ac: 0, ar: 0, fc: 0, fr: 0 });
    } catch { /* silent */ }
  }

  async function renameTab(id: string, name: string) {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
    await fetch(`/api/sheets/tabs/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  }

  async function deleteTab(id: string) {
    if (tabs.length <= 1) return;
    const next = tabs.find((t) => t.id !== id);
    setTabs((prev) => prev.filter((t) => t.id !== id));
    if (activeId === id && next) { setActiveId(next.id); setSel({ ac: 0, ar: 0, fc: 0, fr: 0 }); }
    await fetch(`/api/sheets/tabs/${id}`, { method: "DELETE" });
  }

  // ── Sort ──
  function sortColumn(dir: "asc" | "desc") {
    // Collect rows that have any data
    const rowSet = new Set<number>();
    for (const key of Object.keys(cells)) {
      const ref = parseRef(key);
      if (ref) rowSet.add(ref.r);
    }
    const rows = Array.from(rowSet).sort((a, b) => a - b);
    if (rows.length === 0) return;

    const col = sel.ac;
    const sortedRows = [...rows].sort((a, b) => {
      const va = display(col, a), vb = display(col, b);
      const na = parseFloat(va), nb = parseFloat(vb);
      const cmp = !isNaN(na) && !isNaN(nb) ? na - nb : va.localeCompare(vb);
      return dir === "asc" ? cmp : -cmp;
    });

    const next: Record<string, Cell> = {};
    for (const [key, cell] of Object.entries(cells)) {
      const ref = parseRef(key);
      if (!ref || !rowSet.has(ref.r)) { next[key] = cell; continue; }
      const destRow = rows[sortedRows.indexOf(ref.r)];
      next[cid(ref.c, destRow)] = { ...cell };
    }
    commitCells(next);
  }

  // ── Find & Replace ──
  function runFind(query: string) {
    if (!query) { setFindMatches([]); return; }
    const q = query.toLowerCase();
    const matches: string[] = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const key = cid(c, r);
        const raw = cells[key]?.v ?? "";
        const shown = display(c, r);
        if (raw.toLowerCase().includes(q) || shown.toLowerCase().includes(q))
          matches.push(key);
      }
    setFindMatches(matches);
    setFindIdx(0);
    if (matches.length) {
      const ref = parseRef(matches[0])!;
      setSel({ ac: ref.c, ar: ref.r, fc: ref.c, fr: ref.r });
    }
  }

  function findNext(delta: 1 | -1) {
    if (!findMatches.length) return;
    const next = (findIdx + delta + findMatches.length) % findMatches.length;
    setFindIdx(next);
    const ref = parseRef(findMatches[next])!;
    setSel({ ac: ref.c, ar: ref.r, fc: ref.c, fr: ref.r });
  }

  function replaceOne() {
    if (!findMatches.length) return;
    const key = findMatches[findIdx];
    const cell = cells[key];
    if (!cell) return;
    const next = { ...cells, [key]: { ...cell, v: cell.v.replace(new RegExp(findVal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), replaceVal) } };
    commitCells(next);
    runFind(findVal);
  }

  function replaceAll() {
    if (!findMatches.length) return;
    const re = new RegExp(findVal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const next = { ...cells };
    for (const key of findMatches) {
      const cell = next[key];
      if (cell) next[key] = { ...cell, v: cell.v.replace(re, replaceVal) };
    }
    commitCells(next);
    setFindMatches([]);
  }

  // ── History ──
  async function openHistory() {
    setShowHistory(true);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/sheets/tabs/${activeId}/history`);
      const data = await res.json();
      setHistoryList(Array.isArray(data) ? data : []);
    } catch { setHistoryList([]); }
    finally { setHistoryLoading(false); }
  }

  async function saveVersionNow(label?: string) {
    const res = await fetch(`/api/sheets/tabs/${activeId}/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label ?? null }),
    });
    if (res.ok) {
      const entry = await res.json();
      setHistoryList((prev) => [entry, ...prev].slice(0, 50));
      lastHistorySave.current[activeId] = Date.now();
    }
  }

  async function restoreVersion(historyId: string) {
    setRestoring(historyId);
    try {
      const res = await fetch(`/api/sheets/tabs/${activeId}/history/${historyId}`);
      const snapshot = await res.json();
      // Save current state as a new history entry before restoring
      await saveVersionNow("Before restore");
      const restoredCells = (snapshot.cells as Record<string, Cell>) ?? {};
      commitCells(restoredCells);
    } finally { setRestoring(null); }
  }

  async function deleteHistoryEntry(historyId: string) {
    await fetch(`/api/sheets/tabs/${activeId}/history/${historyId}`, { method: "DELETE" });
    setHistoryList((prev) => prev.filter((e) => e.id !== historyId));
  }

  // ── Global mouse-up ──
  React.useEffect(() => {
    const up = () => { isDragging.current = false; };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  // ── Keyboard ──
  function onKeyDown(e: React.KeyboardEvent) {
    const ctrl = e.ctrlKey || e.metaKey;

    if (editing) {
      if (e.key === "Escape") { cancelEdit(); e.preventDefault(); return; }
      if (e.key === "Enter") { commitEdit(); move(0, 1); e.preventDefault(); return; }
      if (e.key === "Tab")   { commitEdit(); move(e.shiftKey ? -1 : 1, 0); e.preventDefault(); return; }
      return;
    }

    if (ctrl) {
      switch (e.key.toLowerCase()) {
        case "z": undo();  e.preventDefault(); return;
        case "y": redo();  e.preventDefault(); return;
        case "c": copy();  e.preventDefault(); return;
        case "x": cut();   e.preventDefault(); return;
        case "v": paste(); e.preventDefault(); return;
        case "b": applyFmt({ bold: !activeCell()?.bold });         e.preventDefault(); return;
        case "i": applyFmt({ italic: !activeCell()?.italic });     e.preventDefault(); return;
        case "u": applyFmt({ underline: !activeCell()?.underline }); e.preventDefault(); return;
        case "a": setSel({ ac: 0, ar: 0, fc: COLS - 1, fr: ROWS - 1 }); e.preventDefault(); return;
        case "f": setShowFind(true); setShowHistory(false); e.preventDefault(); return;
        case "h": setShowFind(true); setShowHistory(false); e.preventDefault(); return;
      }
    }

    switch (e.key) {
      case "ArrowUp":    commitEdit(); move(0, -1, e.shiftKey); e.preventDefault(); break;
      case "ArrowDown":  commitEdit(); move(0,  1, e.shiftKey); e.preventDefault(); break;
      case "ArrowLeft":  commitEdit(); move(-1, 0, e.shiftKey); e.preventDefault(); break;
      case "ArrowRight": commitEdit(); move( 1, 0, e.shiftKey); e.preventDefault(); break;
      case "Tab":        commitEdit(); move(e.shiftKey ? -1 : 1, 0); e.preventDefault(); break;
      case "Enter":      commitEdit(); move(0, 1); e.preventDefault(); break;
      case "Delete": case "Backspace": deleteSelection(); break;
      case "F2":         startEdit(sel.ac, sel.ar); e.preventDefault(); break;
      case "Escape":     setColorPicker(null); break;
      default:
        if (!ctrl && !e.altKey && e.key.length === 1) {
          e.preventDefault(); // stops browser re-firing the keypress on the input after it gains focus
          startEdit(sel.ac, sel.ar, e.key);
        }
    }
  }

  const ac      = activeCell();
  const namebox = `${colLabel(sel.ac)}${sel.ar + 1}`;
  const formulaBarVal = editing ? editVal : (ac?.v ?? "");
  const canUndo = histRef.current.past.length > 0;
  const canRedo = histRef.current.future.length > 0;

  // Map each unique cell ref in the active formula to a highlight color
  const refColorMap = React.useMemo<Record<string, string>>(() => {
    const formula = editing ? editVal : "";
    if (!formula.startsWith("=")) return {};
    const seen = new Set<string>();
    const order: string[] = [];
    const re = /\b([A-Za-z]{1,3}\d{1,7})\b/g;
    let m;
    while ((m = re.exec(formula)) !== null) {
      const ref = m[1].toUpperCase();
      if (!seen.has(ref)) { seen.add(ref); order.push(ref); }
    }
    const map: Record<string, string> = {};
    order.forEach((ref, i) => { map[ref] = REF_COLORS[i % REF_COLORS.length]; });
    return map;
  }, [editing, editVal]);

  // ── Cell style helper ──
  function cellStyle(cell?: Cell): React.CSSProperties {
    return {
      fontWeight:     cell?.bold      ? "bold"   : "normal",
      fontStyle:      cell?.italic    ? "italic" : "normal",
      textDecoration: cell?.underline ? "underline" : undefined,
      color:          cell?.color,
      fontSize:       cell?.fontSize  ? `${cell.fontSize}px` : undefined,
      fontFamily:     cell?.fontFamily && cell.fontFamily !== "Default" ? cell.fontFamily : undefined,
    };
  }

  return (
    <div
      className="-m-3 lg:-m-4 flex flex-col bg-background overflow-hidden text-[12px]"
      style={{ height: "calc(100vh - 2.75rem)" }}
    >
      {/* ── Toolbar (two rows) ── */}
      <div className="flex flex-shrink-0 flex-col border-b bg-muted/20">

        {/* Row 1: Clipboard | Font | Style | Colors | Alignment | Number */}
        <div className="flex items-center gap-0.5 px-2 pt-1 pb-0.5">
          {/* Clipboard */}
          <TBtn onClick={paste} title="Paste (Ctrl+V)"><Clipboard className="h-3.5 w-3.5" /></TBtn>
          <TBtn onClick={copy}  title="Copy (Ctrl+C)"><Copy     className="h-3.5 w-3.5" /></TBtn>
          <TBtn onClick={cut}   title="Cut (Ctrl+X)"><Scissors  className="h-3.5 w-3.5" /></TBtn>
          <Sep />

          {/* Font family + size */}
          <select
            value={ac?.fontFamily ?? "Default"}
            onChange={(e) => applyFmt({ fontFamily: e.target.value })}
            className="h-6 rounded border border-border/60 bg-background px-1 text-[11px] cursor-pointer w-28"
          >
            {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select
            value={ac?.fontSize ?? ""}
            onChange={(e) => applyFmt({ fontSize: parseInt(e.target.value) || undefined })}
            className="h-6 w-12 rounded border border-border/60 bg-background px-1 text-[11px] cursor-pointer"
          >
            <option value="">—</option>
            {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <TBtn onClick={() => changeFontSize(1)}  title="Grow font"><ChevronUp   className="h-3 w-3" /></TBtn>
          <TBtn onClick={() => changeFontSize(-1)} title="Shrink font"><ChevronDown className="h-3 w-3" /></TBtn>
          <Sep />

          {/* Style */}
          <TBtn active={ac?.bold}      onClick={() => applyFmt({ bold:      !ac?.bold })}      title="Bold (Ctrl+B)">      <Bold      className="h-3.5 w-3.5" /></TBtn>
          <TBtn active={ac?.italic}    onClick={() => applyFmt({ italic:    !ac?.italic })}    title="Italic (Ctrl+I)">    <Italic    className="h-3.5 w-3.5" /></TBtn>
          <TBtn active={ac?.underline} onClick={() => applyFmt({ underline: !ac?.underline })} title="Underline (Ctrl+U)"> <Underline className="h-3.5 w-3.5" /></TBtn>
          <Sep />

          {/* Fill color */}
          <div className="relative">
            <TBtn onClick={() => setColorPicker((p) => p === "bg" ? null : "bg")} title="Fill Color">
              <PaintBucket className="h-3.5 w-3.5" />
              <span className="absolute bottom-0.5 left-1 right-1 h-0.5 rounded border border-border/20"
                style={{ backgroundColor: ac?.bg ?? "#ffff00" }} />
            </TBtn>
            {colorPicker === "bg" && <ColorPicker value={ac?.bg ?? "#ffff00"} onChange={(v) => applyFmt({ bg: v })} onClose={() => setColorPicker(null)} />}
          </div>
          {/* Text color */}
          <div className="relative">
            <TBtn onClick={() => setColorPicker((p) => p === "text" ? null : "text")} title="Font Color">
              <Type className="h-3.5 w-3.5" />
              <span className="absolute bottom-0.5 left-1 right-1 h-0.5 rounded"
                style={{ backgroundColor: ac?.color ?? "#ff0000" }} />
            </TBtn>
            {colorPicker === "text" && <ColorPicker value={ac?.color ?? "#000000"} onChange={(v) => applyFmt({ color: v })} onClose={() => setColorPicker(null)} />}
          </div>
          <TBtn onClick={clearFormatting} title="Clear Formatting" className="text-[10px] text-muted-foreground">Clear</TBtn>
          <Sep />

          {/* Alignment */}
          <TBtn active={ac?.align === "left"}   onClick={() => applyFmt({ align: "left" })}   title="Align Left">  <AlignLeft   className="h-3.5 w-3.5" /></TBtn>
          <TBtn active={ac?.align === "center"} onClick={() => applyFmt({ align: "center" })} title="Align Center"><AlignCenter className="h-3.5 w-3.5" /></TBtn>
          <TBtn active={ac?.align === "right"}  onClick={() => applyFmt({ align: "right" })}  title="Align Right"> <AlignRight  className="h-3.5 w-3.5" /></TBtn>
          <TBtn active={ac?.wrap} onClick={() => applyFmt({ wrap: !ac?.wrap })} title="Wrap Text"><WrapText className="h-3.5 w-3.5" /></TBtn>
          <Sep />

          {/* Number format */}
          <select
            value={ac?.numFmt ?? "general"}
            onChange={(e) => applyFmt({ numFmt: e.target.value as NumFmt })}
            className="h-6 rounded border border-border/60 bg-background px-1 text-[11px] cursor-pointer w-24"
          >
            <option value="general">General</option>
            <option value="number">Number</option>
            <option value="currency">₹ Currency</option>
            <option value="percent">Percent</option>
          </select>
          <TBtn onClick={() => changeDecPlaces(1)}  title="Increase decimal places" className="font-mono text-[10px]">.0+</TBtn>
          <TBtn onClick={() => changeDecPlaces(-1)} title="Decrease decimal places" className="font-mono text-[10px]">.0-</TBtn>
        </div>

        {/* Row 2: Row/Col | Undo/Redo/Export | Sort | Find | History | Save status */}
        <div className="flex items-center gap-0.5 px-2 pb-1 pt-0.5 border-t border-border/20">
          {/* Row / Col */}
          <TBtn onClick={insertRow} title="Insert Row Above"><Plus  className="h-3 w-3" /><span>Row</span></TBtn>
          <TBtn onClick={deleteRow} title="Delete Row">      <Trash2 className="h-3 w-3" /><span>Row</span></TBtn>
          <TBtn onClick={insertCol} title="Insert Column">   <Plus  className="h-3 w-3" /><span>Col</span></TBtn>
          <TBtn onClick={deleteCol} title="Delete Column">   <Trash2 className="h-3 w-3" /><span>Col</span></TBtn>
          <Sep />

          {/* Undo / Redo / Export */}
          <TBtn onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"><Undo2    className="h-3.5 w-3.5" /></TBtn>
          <TBtn onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)"><Redo2    className="h-3.5 w-3.5" /></TBtn>
          <TBtn onClick={exportCSV}  title="Export CSV">  <Download className="h-3.5 w-3.5" /><span>CSV</span></TBtn>
          <TBtn onClick={exportXLSX} title="Export Excel"><Download className="h-3.5 w-3.5 text-green-600" /><span className="text-green-600 font-medium">Excel</span></TBtn>
          <Sep />

          {/* Sort */}
          <TBtn onClick={() => sortColumn("asc")}  title="Sort A → Z (by active column)"><SortAsc  className="h-3.5 w-3.5" /></TBtn>
          <TBtn onClick={() => sortColumn("desc")} title="Sort Z → A (by active column)"><SortDesc className="h-3.5 w-3.5" /></TBtn>
          <Sep />

          {/* Find & Replace */}
          <TBtn onClick={() => { setShowFind((v) => !v); setShowHistory(false); }} active={showFind} title="Find & Replace (Ctrl+H)">
            <Search className="h-3.5 w-3.5" /><span>Find</span>
          </TBtn>
          <Sep />

          {/* History */}
          <TBtn onClick={() => { openHistory(); setShowFind(false); }} active={showHistory} title="Version History"><History  className="h-3.5 w-3.5" /><span>History</span></TBtn>
          <TBtn onClick={() => saveVersionNow()} title="Save version snapshot"><BookOpen className="h-3.5 w-3.5" /></TBtn>

          {/* Save status — right edge */}
          <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground pr-1 flex-shrink-0">
            {saveStatus === "saving"  && <><Loader2      className="h-3 w-3 animate-spin" />Saving…</>}
            {saveStatus === "saved"   && <><CheckCircle2 className="h-3 w-3 text-green-500" />Saved</>}
            {saveStatus === "unsaved" && <><Save         className="h-3 w-3" />Unsaved</>}
            {saveStatus === "error"   && <><AlertCircle  className="h-3 w-3 text-destructive" />Error</>}
          </div>
        </div>

      </div>

      {/* ── Formula bar ── */}
      <div className="flex flex-shrink-0 flex-col border-b bg-background">
        <div className="flex items-center gap-1.5 px-2 py-0.5">
          <div className="w-14 flex-shrink-0 rounded border bg-muted/40 px-1.5 py-0.5 text-center text-[11px] font-mono font-semibold tracking-wider">
            {namebox}
          </div>
          <span className="text-[10px] font-semibold italic text-muted-foreground">fx</span>
          <div className="relative flex-1 flex items-center">
            {/* Colored formula overlay — shown when editing a formula */}
            {editing && editVal.startsWith("=") && (
              <div
                aria-hidden
                className="absolute inset-0 flex items-center font-mono text-[12px] pointer-events-none overflow-hidden whitespace-pre"
                style={{ padding: "0 1px" }}
              >
                {tokenizeFormula(editVal).map((token, i) => (
                  <span
                    key={i}
                    style={{ color: token.ref ? refColorMap[token.ref] : "currentColor" }}
                  >
                    {token.text}
                  </span>
                ))}
              </div>
            )}
            <input
              value={formulaBarVal}
              className="w-full bg-transparent font-mono text-[12px] outline-none"
              style={{
                padding: "0 1px",
                color: editing && editVal.startsWith("=") ? "transparent" : undefined,
                caretColor: "currentColor",
              }}
              onChange={(e) => {
                if (editing) setEditVal(e.target.value);
                else { setEditing({ c: sel.ac, r: sel.ar }); setEditVal(e.target.value); }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter")  { commitEdit(); move(0, 1); gridRef.current?.focus(); e.preventDefault(); }
                if (e.key === "Escape") { cancelEdit(); gridRef.current?.focus(); e.preventDefault(); }
                e.stopPropagation();
              }}
            />
          </div>
        </div>
        {/* Colored cell-ref chips — visible only while editing a formula */}
        {editing && editVal.startsWith("=") && Object.keys(refColorMap).length > 0 && (
          <div className="flex items-center gap-1 px-2 pb-0.5 overflow-x-auto">
            <span className="text-[9px] text-muted-foreground italic flex-shrink-0">refs:</span>
            {Object.entries(refColorMap).map(([ref, color]) => (
              <span
                key={ref}
                className="inline-flex items-center rounded px-1.5 py-px text-[10px] font-semibold font-mono flex-shrink-0"
                style={{
                  color,
                  backgroundColor: `${color}18`,
                  border: `1.5px solid ${color}88`,
                }}
              >
                {ref}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Grid + History panel ── */}
      <div className="flex flex-1 overflow-hidden">

      {/* ── Grid ── */}
      <div
        ref={gridRef}
        className="flex-1 overflow-auto outline-none thin-scroll"
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <table className="border-separate" style={{ borderSpacing: 0, tableLayout: "fixed", minWidth: "100%" }}>
          <colgroup>
            <col style={{ width: RNW, minWidth: RNW }} />
            {Array.from({ length: COLS }, (_, c) => (
              <col key={c} style={{ width: cw(c), minWidth: cw(c) }} />
            ))}
          </colgroup>

          {/* Column headers */}
          <thead>
            <tr style={{ height: CHH }}>
              <th
                className="sticky top-0 left-0 z-30 border-b border-r border-border/60 bg-muted/80 cursor-pointer select-none"
                onClick={() => setSel({ ac: 0, ar: 0, fc: COLS - 1, fr: ROWS - 1 })}
                title="Select all"
              />
              {Array.from({ length: COLS }, (_, c) => {
                const selected = c >= minC && c <= maxC;
                return (
                  <th key={c}
                    className={cn(
                      "sticky top-0 z-20 border-b border-r border-border/60 relative",
                      "text-[10px] font-semibold text-center select-none cursor-pointer",
                      selected ? "bg-primary/15 text-primary" : "bg-muted/70 text-muted-foreground hover:bg-muted",
                    )}
                    onClick={() => setSel({ ac: c, ar: 0, fc: c, fr: ROWS - 1 })}
                  >
                    {colLabel(c)}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/60 z-10"
                      onMouseDown={(e) => onColResizeStart(e, c)}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Data rows */}
          <tbody>
            {Array.from({ length: ROWS }, (_, r) => (
              <tr key={r} style={{ height: DEF_H }}>
                {/* Row number */}
                <td
                  className={cn(
                    "sticky left-0 z-10 border-b border-r border-border/60",
                    "text-[10px] font-medium text-center select-none cursor-pointer",
                    r >= minR && r <= maxR
                      ? "bg-primary/15 text-primary"
                      : "bg-muted/70 text-muted-foreground hover:bg-muted",
                  )}
                  onClick={() => setSel({ ac: 0, ar: r, fc: COLS - 1, fr: r })}
                >
                  {r + 1}
                </td>

                {/* Cells */}
                {Array.from({ length: COLS }, (_, c) => {
                  const key = cid(c, r);
                  const cell = cells[key];
                  const inSel    = c >= minC && c <= maxC && r >= minR && r <= maxR;
                  const isAc     = c === sel.ac && r === sel.ar;
                  const isEdit   = editing?.c === c && editing?.r === r;
                  const isMatch  = findMatches.includes(key);
                  const isCurMatch = findMatches[findIdx] === key;
                  const refColor = refColorMap[key];

                  return (
                    <td key={c}
                      className={cn(
                        "border-b border-r border-border/30 p-0 relative overflow-visible",
                        inSel && !isAc && !refColor && "bg-primary/10",
                        isMatch && !isCurMatch && !inSel && !refColor && "bg-amber-100 dark:bg-amber-900/30",
                        isCurMatch && !refColor && "bg-amber-300 dark:bg-amber-600/60",
                      )}
                      style={{
                        backgroundColor: refColor
                          ? (cell?.bg ?? `${refColor}18`)
                          : (cell?.bg ?? undefined),
                        boxShadow: isAc && !isEdit
                          ? "inset 0 0 0 2px hsl(var(--primary))"
                          : refColor
                            ? `inset 0 0 0 2px ${refColor}`
                            : undefined,
                        height: cell?.wrap ? "auto" : DEF_H,
                        verticalAlign: "middle",
                      }}
                      onMouseDown={(e) => {
                        if (isEdit) return;
                        commitEdit();
                        if (e.shiftKey) setSel((s) => ({ ...s, fc: c, fr: r }));
                        else setSel({ ac: c, ar: r, fc: c, fr: r });
                        isDragging.current = true;
                        gridRef.current?.focus();
                        e.preventDefault();
                      }}
                      onMouseEnter={() => {
                        if (isDragging.current) setSel((s) => ({ ...s, fc: c, fr: r }));
                      }}
                      onDoubleClick={() => startEdit(c, r)}
                    >
                      {isEdit ? (
                        <div className="absolute inset-0 z-20 bg-background">
                          {/* Colored formula overlay for in-cell editing */}
                          {editVal.startsWith("=") && (
                            <div
                              aria-hidden
                              className="absolute inset-0 flex items-center font-mono pointer-events-none overflow-hidden whitespace-pre px-1"
                              style={{
                                fontSize: cell?.fontSize ? `${cell.fontSize}px` : "12px",
                                zIndex: 22,
                              }}
                            >
                              {tokenizeFormula(editVal).map((token, i) => (
                                <span
                                  key={i}
                                  style={{ color: token.ref ? (refColorMap[token.ref] ?? "currentColor") : "currentColor" }}
                                >
                                  {token.text}
                                </span>
                              ))}
                            </div>
                          )}
                          <input
                            ref={editInputRef}
                            value={editVal}
                            onChange={(e) => setEditVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") { cancelEdit(); gridRef.current?.focus(); e.preventDefault(); }
                              if (e.key === "Enter")  { commitEdit(); move(0, 1); gridRef.current?.focus(); e.preventDefault(); }
                              if (e.key === "Tab")    { commitEdit(); move(e.shiftKey ? -1 : 1, 0); gridRef.current?.focus(); e.preventDefault(); }
                              e.stopPropagation();
                            }}
                            className="absolute inset-0 w-full h-full px-1 font-mono outline-none bg-transparent"
                            style={{
                              ...cellStyle(cell),
                              textAlign: cell?.align ?? "left",
                              color: editVal.startsWith("=") ? "transparent" : undefined,
                              caretColor: "currentColor",
                              zIndex: 21,
                            }}
                          />
                        </div>
                      ) : (
                        <div
                          className="w-full h-full px-1 flex items-center overflow-hidden"
                          style={{
                            ...cellStyle(cell),
                            justifyContent: cell?.align === "right" ? "flex-end" : cell?.align === "center" ? "center" : "flex-start",
                            whiteSpace: cell?.wrap ? "normal" : "nowrap",
                            minHeight: DEF_H,
                          }}
                        >
                          <span className={cell?.wrap ? "break-words w-full" : "truncate w-full"}
                            style={{ textAlign: cell?.align ?? "left" }}>
                            {display(c, r)}
                          </span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Find & Replace panel ── */}
      {showFind && (
        <div className="flex flex-col w-72 flex-shrink-0 border-l bg-background overflow-hidden">
          <div className="flex items-center justify-between border-b px-3 py-2 bg-muted/20">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold">
              <Search className="h-3.5 w-3.5 text-primary" /> Find &amp; Replace
            </div>
            <button onClick={() => setShowFind(false)} className="rounded p-0.5 hover:bg-muted">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
          <div className="flex flex-col gap-2 p-3">
            {/* Find */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Find</label>
              <div className="flex gap-1">
                <input
                  value={findVal}
                  onChange={(e) => { setFindVal(e.target.value); runFind(e.target.value); }}
                  onKeyDown={(e) => { if (e.key === "Enter") findNext(1); e.stopPropagation(); }}
                  placeholder="Search in sheet…"
                  className="flex-1 h-7 rounded border border-border bg-background px-2 text-[11px] outline-none focus:border-primary"
                />
              </div>
            </div>
            {/* Replace */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Replace</label>
              <input
                value={replaceVal}
                onChange={(e) => setReplaceVal(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Replace with…"
                className="h-7 rounded border border-border bg-background px-2 text-[11px] outline-none focus:border-primary"
              />
            </div>
            {/* Match count */}
            {findVal && (
              <p className="text-[10px] text-muted-foreground">
                {findMatches.length === 0
                  ? "No matches"
                  : `${findIdx + 1} of ${findMatches.length} match${findMatches.length !== 1 ? "es" : ""}`}
              </p>
            )}
            {/* Nav buttons */}
            <div className="flex gap-1">
              <button
                onClick={() => findNext(-1)}
                disabled={findMatches.length === 0}
                className="flex items-center gap-1 rounded px-2 py-1 text-[11px] border border-border hover:bg-muted disabled:opacity-30 transition-colors"
                title="Previous match"
              ><ArrowUp className="h-3 w-3" /> Prev</button>
              <button
                onClick={() => findNext(1)}
                disabled={findMatches.length === 0}
                className="flex items-center gap-1 rounded px-2 py-1 text-[11px] border border-border hover:bg-muted disabled:opacity-30 transition-colors"
                title="Next match"
              ><ArrowDown className="h-3 w-3" /> Next</button>
            </div>
            <div className="flex gap-1 pt-1 border-t border-border/40">
              <button
                onClick={replaceOne}
                disabled={findMatches.length === 0}
                className="flex items-center gap-1 rounded px-2 py-1 text-[11px] bg-muted hover:bg-muted/80 disabled:opacity-30 transition-colors"
              ><Replace className="h-3 w-3" /> Replace</button>
              <button
                onClick={replaceAll}
                disabled={findMatches.length === 0}
                className="flex items-center gap-1 rounded px-2 py-1 text-[11px] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 transition-colors"
              >Replace All</button>
            </div>
          </div>
        </div>
      )}

      {/* ── History panel ── */}
      {showHistory && (
        <div className="flex flex-col w-72 flex-shrink-0 border-l bg-background overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between border-b px-3 py-2 bg-muted/20">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold">
              <History className="h-3.5 w-3.5 text-primary" />
              Version History
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => saveVersionNow()}
                title="Save version now"
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-primary hover:bg-primary/10 transition-colors"
              >
                <Save className="h-3 w-3" /> Save Now
              </button>
              <button onClick={() => setShowHistory(false)} className="rounded p-0.5 hover:bg-muted transition-colors">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Active sheet indicator */}
          <div className="px-3 py-1.5 border-b bg-muted/10 text-[10px] text-muted-foreground flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            Sheet: <span className="font-medium text-foreground">{tab?.name}</span>
            <span className="ml-auto">{historyList.length} version{historyList.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Entry list */}
          <div className="flex-1 overflow-y-auto thin-scroll">
            {historyLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-[11px] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : historyList.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 px-4 text-center">
                <Clock className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-[11px] text-muted-foreground">No versions saved yet.</p>
                <p className="text-[10px] text-muted-foreground/60">Versions save automatically every 5 min, or click &ldquo;Save Now&rdquo;.</p>
              </div>
            ) : (
              historyList.map((entry, i) => {
                const dt = new Date(entry.createdAt);
                const isRestoring = restoring === entry.id;
                const relTime = (() => {
                  const diff = Date.now() - dt.getTime();
                  if (diff < 60_000)  return "Just now";
                  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
                  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
                  return `${Math.floor(diff / 86_400_000)}d ago`;
                })();

                return (
                  <div key={entry.id}
                    className="group flex flex-col gap-0.5 border-b border-border/40 px-3 py-2 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[11px] font-medium truncate">
                          {entry.label ?? (i === 0 ? "Latest version" : `Version ${historyList.length - i}`)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {relTime} · {dt.toLocaleDateString()} {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => restoreVersion(entry.id)}
                          disabled={!!restoring}
                          title="Restore this version"
                          className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40 transition-colors"
                        >
                          {isRestoring ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <RotateCcw className="h-2.5 w-2.5" />}
                          Restore
                        </button>
                        <button
                          onClick={() => deleteHistoryEntry(entry.id)}
                          title="Delete this version"
                          className="rounded p-0.5 hover:bg-destructive/10 hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      </div>{/* end grid+history wrapper */}

      {/* ── Sheet tabs ── */}
      <div className="flex flex-shrink-0 items-center border-t bg-muted/20 h-8 gap-0 px-2 overflow-x-auto thin-scroll">
        {tabs
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((t) => (
            <SheetTabBtn
              key={t.id}
              name={t.name}
              active={t.id === activeId}
              canDelete={tabs.length > 1}
              onClick={() => { commitEdit(); setActiveId(t.id); setSel({ ac: 0, ar: 0, fc: 0, fr: 0 }); }}
              onRename={(name) => renameTab(t.id, name)}
              onDelete={() => deleteTab(t.id)}
            />
          ))}
        <button onClick={addTab} className="ml-1 p-1 rounded hover:bg-muted text-muted-foreground" title="Add sheet">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
