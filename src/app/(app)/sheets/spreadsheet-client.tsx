"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Bold, Italic, AlignLeft, AlignCenter, AlignRight,
  Plus, Trash2, Undo2, Redo2, Download, PaintBucket, Type,
  Save, CheckCircle2, AlertCircle, Loader2,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const COLS = 26;
const ROWS = 100;
const DEF_W = 100;
const DEF_H = 24;
const RNW = 48;
const CHH = 22;

// ── Types ─────────────────────────────────────────────────────────────────────
type Fmt = {
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
  color?: string;
  bg?: string;
};

type Cell = Fmt & { v: string };

type TabState = {
  id: string;
  name: string;
  order: number;
  cells: Record<string, Cell>;
  cw: Record<string, number>;
};

export type InitialTab = {
  id: string;
  name: string;
  order: number;
  cells: Record<string, unknown>;
  cw: Record<string, number>;
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

// ── Formula evaluator ─────────────────────────────────────────────────────────
function evalCell(raw: string, cells: Record<string, Cell>, guard = new Set<string>()): string {
  if (!raw || !raw.startsWith("=")) return raw ?? "";

  let expr = raw.slice(1).trim().toUpperCase();

  // Range functions: SUM(A1:B3), AVERAGE, COUNT, MAX, MIN, PRODUCT
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
        default:        return vals.length
          ? String(vals.reduce((s, v) => s + v, 0) / vals.length) : "0";
      }
    }
  );

  // Map Excel math functions to JS
  expr = expr
    .replace(/SQRT\(/g, "Math.sqrt(")
    .replace(/ABS\(/g, "Math.abs(")
    .replace(/ROUND\(/g, "Math.round(")
    .replace(/FLOOR\(/g, "Math.floor(")
    .replace(/CEIL\(/g, "Math.ceil(")
    .replace(/POW\(/g, "Math.pow(")
    .replace(/LOG\(/g, "Math.log10(");

  // Resolve individual cell refs
  expr = expr.replace(/([A-Z]{1,3}\d{1,7})/g, (ref) => {
    if (guard.has(ref)) return "0";
    const cell = cells[ref];
    if (!cell?.v) return "0";
    const val = evalCell(cell.v, cells, new Set([...guard, ref]));
    const n = Number(val);
    return isNaN(n) ? `"${val}"` : (val || "0");
  });

  // Basic IF(cond, t, f)
  expr = expr.replace(/^IF\((.+),(.+),(.+)\)$/, (_, cond, t, f) => {
    try {
      // eslint-disable-next-line no-new-func
      return new Function(`"use strict"; return Boolean(${cond})`)() ? t.trim() : f.trim();
    } catch {
      return f.trim();
    }
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
  } catch {
    return "#ERROR";
  }
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
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
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
          <button key={c} className="h-4 w-4 rounded-sm border border-border/30 hover:scale-125 transition-transform"
            style={{ backgroundColor: c }} onClick={() => { onChange(c); onClose(); }} />
        ))}
      </div>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full h-7 rounded cursor-pointer" />
    </div>
  );
}

// ── Toolbar button ────────────────────────────────────────────────────────────
function TBtn({ onClick, children, title, disabled, active }: {
  onClick?: () => void;
  children: React.ReactNode;
  title?: string;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={cn(
        "flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] transition-colors",
        "hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed",
        active && "bg-muted text-primary font-semibold",
      )}>
      {children}
    </button>
  );
}

function Sep() {
  return <div className="h-4 w-px bg-border/60 mx-0.5 flex-shrink-0" />;
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
    onRename(trimmed);
    setVal(trimmed);
    setRenaming(false);
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
  const [activeId, setActiveId] = React.useState(initialTabs[0]?.id ?? "");
  const [sel, setSel] = React.useState({ ac: 0, ar: 0, fc: 0, fr: 0 });
  const [editing, setEditing] = React.useState<{ c: number; r: number } | null>(null);
  const [editVal, setEditVal] = React.useState("");
  const [colorPicker, setColorPicker] = React.useState<"text" | "bg" | null>(null);
  const [saveStatus, setSaveStatus] = React.useState<"saved" | "saving" | "unsaved" | "error">("saved");

  // ── Refs ──
  const histRef = React.useRef<{ past: Record<string, Cell>[]; future: Record<string, Cell>[] }>({ past: [], future: [] });
  const clipRef = React.useRef<Record<string, Cell> | null>(null);
  const isDragging = React.useRef(false);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const editInputRef = React.useRef<HTMLInputElement>(null);
  const cellRefs = React.useRef<Record<string, HTMLTableCellElement>>({});

  // Reset history on tab switch
  const prevActiveId = React.useRef(activeId);
  if (prevActiveId.current !== activeId) {
    prevActiveId.current = activeId;
    histRef.current = { past: [], future: [] };
  }

  // ── Derived ──
  const tab = tabs.find((t) => t.id === activeId)!;
  const cells = tab?.cells ?? {};
  const minC = Math.min(sel.ac, sel.fc), maxC = Math.max(sel.ac, sel.fc);
  const minR = Math.min(sel.ar, sel.fr), maxR = Math.max(sel.ar, sel.fr);

  function cw(c: number) { return tab?.cw[String(c)] ?? DEF_W; }
  function display(c: number, r: number) {
    const cell = cells[cid(c, r)];
    return cell?.v ? evalCell(cell.v, cells) : "";
  }
  function activeCell() { return cells[cid(sel.ac, sel.ar)]; }
  function hasStyle(cell?: Cell) {
    return !!(cell?.bold || cell?.italic || cell?.align || cell?.color || cell?.bg);
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
      } catch {
        setSaveStatus("error");
      }
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

  // Focus management
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

  // ── Delete ──
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

  // ── Copy / Paste ──
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

  function paste() {
    const clip = clipRef.current;
    if (!clip) return;
    const next = { ...cells };
    for (const [key, cell] of Object.entries(clip)) {
      const ref = parseRef(key);
      if (!ref) continue;
      next[cid(sel.ac + ref.c, sel.ar + ref.r)] = { ...cell };
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
    e.preventDefault();
    e.stopPropagation();
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
    let maxR = 0, maxC = 0;
    for (const key of Object.keys(cells)) {
      const ref = parseRef(key);
      if (ref) { maxR = Math.max(maxR, ref.r); maxC = Math.max(maxC, ref.c); }
    }
    const csv = Array.from({ length: maxR + 1 }, (_, r) =>
      Array.from({ length: maxC + 1 }, (_, c) =>
        `"${display(c, r).replace(/"/g, '""')}"`
      ).join(",")
    ).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${tab.name}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ── Sheet tab management ──
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
    } catch { /* silent — tab creation failed */ }
  }

  async function renameTab(id: string, name: string) {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
    await fetch(`/api/sheets/tabs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
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

  // ── Global mouse-up (end drag-select) ──
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
        case "v": paste(); e.preventDefault(); return;
        case "b": applyFmt({ bold: !activeCell()?.bold });     e.preventDefault(); return;
        case "i": applyFmt({ italic: !activeCell()?.italic }); e.preventDefault(); return;
        case "a": setSel({ ac: 0, ar: 0, fc: COLS - 1, fr: ROWS - 1 }); e.preventDefault(); return;
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
        if (!ctrl && !e.altKey && e.key.length === 1) startEdit(sel.ac, sel.ar, e.key);
    }
  }

  const ac = activeCell();
  const namebox = `${colLabel(sel.ac)}${sel.ar + 1}`;
  const formulaBarVal = editing ? editVal : (ac?.v ?? "");
  const canUndo = histRef.current.past.length > 0;
  const canRedo = histRef.current.future.length > 0;

  return (
    <div
      className="-m-3 lg:-m-4 flex flex-col bg-background overflow-hidden text-[12px]"
      style={{ height: "calc(100vh - 2.75rem)" }}
    >
      {/* ── Toolbar ── */}
      <div className="flex flex-shrink-0 items-center gap-0.5 border-b px-2 py-1 bg-muted/20 flex-wrap">
        <TBtn onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"><Undo2 className="h-3.5 w-3.5" /></TBtn>
        <TBtn onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)"><Redo2 className="h-3.5 w-3.5" /></TBtn>
        <Sep />
        <TBtn active={ac?.bold}   onClick={() => applyFmt({ bold: !ac?.bold })}     title="Bold (Ctrl+B)"><Bold className="h-3.5 w-3.5" /></TBtn>
        <TBtn active={ac?.italic} onClick={() => applyFmt({ italic: !ac?.italic })} title="Italic (Ctrl+I)"><Italic className="h-3.5 w-3.5" /></TBtn>
        <Sep />
        <TBtn active={ac?.align === "left"}   onClick={() => applyFmt({ align: "left" })}   title="Align Left"><AlignLeft className="h-3.5 w-3.5" /></TBtn>
        <TBtn active={ac?.align === "center"} onClick={() => applyFmt({ align: "center" })} title="Align Center"><AlignCenter className="h-3.5 w-3.5" /></TBtn>
        <TBtn active={ac?.align === "right"}  onClick={() => applyFmt({ align: "right" })}  title="Align Right"><AlignRight className="h-3.5 w-3.5" /></TBtn>
        <Sep />
        {/* Text color */}
        <div className="relative">
          <TBtn onClick={() => setColorPicker((p) => p === "text" ? null : "text")} title="Text Color">
            <Type className="h-3.5 w-3.5" />
            <span className="absolute bottom-0.5 left-1.5 right-1.5 h-0.5 rounded" style={{ backgroundColor: ac?.color ?? "#000" }} />
          </TBtn>
          {colorPicker === "text" && (
            <ColorPicker value={ac?.color ?? "#000000"} onChange={(v) => applyFmt({ color: v })} onClose={() => setColorPicker(null)} />
          )}
        </div>
        {/* Fill color */}
        <div className="relative">
          <TBtn onClick={() => setColorPicker((p) => p === "bg" ? null : "bg")} title="Fill Color">
            <PaintBucket className="h-3.5 w-3.5" />
            <span className="absolute bottom-0.5 left-1.5 right-1.5 h-0.5 rounded border border-border/30" style={{ backgroundColor: ac?.bg ?? "transparent" }} />
          </TBtn>
          {colorPicker === "bg" && (
            <ColorPicker value={ac?.bg ?? "#ffffff"} onChange={(v) => applyFmt({ bg: v })} onClose={() => setColorPicker(null)} />
          )}
        </div>
        <Sep />
        <TBtn onClick={insertRow} title="Insert Row Above"><Plus className="h-3 w-3" /><span>Row</span></TBtn>
        <TBtn onClick={deleteRow} title="Delete Row"><Trash2 className="h-3 w-3" /><span>Row</span></TBtn>
        <TBtn onClick={insertCol} title="Insert Column"><Plus className="h-3 w-3" /><span>Col</span></TBtn>
        <TBtn onClick={deleteCol} title="Delete Column"><Trash2 className="h-3 w-3" /><span>Col</span></TBtn>
        <Sep />
        <TBtn onClick={exportCSV} title="Download as CSV"><Download className="h-3 w-3" /><span>CSV</span></TBtn>

        {/* Save status */}
        <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground pr-1">
          {saveStatus === "saving"  && <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>}
          {saveStatus === "saved"   && <><CheckCircle2 className="h-3 w-3 text-green-500" /> Saved</>}
          {saveStatus === "unsaved" && <><Save className="h-3 w-3" /> Unsaved</>}
          {saveStatus === "error"   && <><AlertCircle className="h-3 w-3 text-destructive" /> Save failed</>}
        </div>
      </div>

      {/* ── Formula bar ── */}
      <div className="flex flex-shrink-0 items-center gap-1.5 border-b px-2 py-0.5 bg-background">
        <div className="w-14 flex-shrink-0 rounded border bg-muted/40 px-1.5 py-0.5 text-center text-[11px] font-mono font-semibold tracking-wider">
          {namebox}
        </div>
        <span className="text-[10px] font-semibold italic text-muted-foreground">fx</span>
        <input
          value={formulaBarVal}
          className="flex-1 bg-transparent font-mono text-[12px] outline-none"
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
                  <th
                    key={c}
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
                  const inSel = c >= minC && c <= maxC && r >= minR && r <= maxR;
                  const isAc  = c === sel.ac && r === sel.ar;
                  const isEdit = editing?.c === c && editing?.r === r;

                  return (
                    <td
                      key={c}
                      ref={(el) => { if (el) cellRefs.current[key] = el; }}
                      className={cn(
                        "border-b border-r border-border/30 p-0 relative overflow-visible",
                        inSel && !isAc && "bg-primary/10",
                      )}
                      style={{
                        backgroundColor: cell?.bg ?? undefined,
                        boxShadow: isAc && !isEdit ? "inset 0 0 0 2px hsl(var(--primary))" : undefined,
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
                        <input
                          ref={editInputRef}
                          value={editVal}
                          onChange={(e) => setEditVal(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") { cancelEdit(); gridRef.current?.focus(); e.preventDefault(); }
                            if (e.key === "Enter")  { commitEdit(); move(0, 1);               gridRef.current?.focus(); e.preventDefault(); }
                            if (e.key === "Tab")    { commitEdit(); move(e.shiftKey ? -1 : 1, 0); gridRef.current?.focus(); e.preventDefault(); }
                            e.stopPropagation();
                          }}
                          className="absolute inset-0 w-full h-full px-1 font-mono z-20 outline-none bg-background"
                          style={{
                            fontWeight: cell?.bold   ? "bold"   : "normal",
                            fontStyle:  cell?.italic ? "italic" : "normal",
                            textAlign:  cell?.align  ?? "left",
                            color:      cell?.color,
                          }}
                        />
                      ) : (
                        <div
                          className="w-full h-full px-1 flex items-center overflow-hidden"
                          style={{
                            fontWeight: cell?.bold   ? "bold"   : "normal",
                            fontStyle:  cell?.italic ? "italic" : "normal",
                            justifyContent: cell?.align === "right" ? "flex-end" : cell?.align === "center" ? "center" : "flex-start",
                            color: cell?.color,
                          }}
                        >
                          <span className="truncate w-full" style={{ textAlign: cell?.align ?? "left" }}>
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
