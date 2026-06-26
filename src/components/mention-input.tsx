"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { Person } from "@/types/app";

// ── helpers ───────────────────────────────────────────────────────────────────
function extractMentionIds(body: string, users: Person[]): string[] {
  const found: string[] = [];
  const re = /@([\w\s]+?)(?=\s|$|[^a-zA-Z\s])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const name = m[1].trim().toLowerCase();
    const u = users.find((p) => (p.name ?? "").toLowerCase() === name);
    if (u && !found.includes(u.id)) found.push(u.id);
  }
  return found;
}

// Render comment body with @Name highlighted
export function CommentBody({ body, users }: { body: string; users: Person[] }) {
  const parts = body.split(/(@[\w\s]+?)(?=\s|$)/g);
  return (
    <p className="text-sm whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (!part.startsWith("@")) return part;
        const name = part.slice(1).trim().toLowerCase();
        const matched = users.some((u) => (u.name ?? "").toLowerCase() === name);
        if (!matched) return part;
        return (
          <span key={i} className="font-semibold text-primary">
            {part}
          </span>
        );
      })}
    </p>
  );
}

// ── MentionInput ──────────────────────────────────────────────────────────────
export function MentionInput({
  value,
  onChange,
  onSubmit,
  users,
  placeholder = "Write a comment… type @ to mention someone",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (body: string, mentionIds: string[]) => void;
  users: Person[];
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = React.useState<string | null>(null);
  const [mentionStart, setMentionStart] = React.useState<number>(-1);
  const [selectedIdx, setSelectedIdx] = React.useState(0);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  const suggestions = React.useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return users.filter((u) => (u.name ?? "").toLowerCase().startsWith(q)).slice(0, 6);
  }, [query, users]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    const cursor = e.target.selectionStart ?? text.length;
    onChange(text);

    // Detect active @mention: scan backward from cursor for unresolved @...
    const before = text.slice(0, cursor);
    const atIdx = before.lastIndexOf("@");
    if (atIdx !== -1 && !before.slice(atIdx).includes(" ")) {
      setQuery(before.slice(atIdx + 1));
      setMentionStart(atIdx);
      setSelectedIdx(0);
    } else {
      setQuery(null);
    }
  }

  function insertMention(user: Person) {
    if (mentionStart === -1) return;
    const before = value.slice(0, mentionStart);
    const after  = value.slice(inputRef.current?.selectionStart ?? value.length);
    const inserted = `@${user.name} `;
    const next = before + inserted + after;
    onChange(next);
    setQuery(null);
    // Restore focus + cursor
    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      inputRef.current.focus();
      const pos = mentionStart + inserted.length;
      inputRef.current.setSelectionRange(pos, pos);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => (i + 1) % suggestions.length); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelectedIdx((i) => (i - 1 + suggestions.length) % suggestions.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(suggestions[selectedIdx]); return; }
      if (e.key === "Escape") { setQuery(null); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleSubmit() {
    const body = value.trim();
    if (!body) return;
    const ids = extractMentionIds(body, users);
    onSubmit(body, ids);
  }

  return (
    <div className="relative w-full">
      <textarea
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={2}
        className={cn(
          "w-full resize-none rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 neu-inset",
          className,
        )}
      />

      {/* Suggestion dropdown */}
      {suggestions.length > 0 && (
        <div className="absolute left-0 bottom-full mb-1 z-50 w-56 rounded-xl py-1 neu-card overflow-hidden">
          {suggestions.map((u, i) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors text-left",
                i === selectedIdx ? "bg-primary/10 text-primary" : "hover:bg-muted/60",
              )}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary shrink-0">
                {(u.name ?? "?")[0].toUpperCase()}
              </span>
              <span className="truncate">{u.name}</span>
            </button>
          ))}
          <p className="px-3 py-1 text-[10px] text-muted-foreground border-t mt-0.5">
            ↑↓ navigate · Enter/Tab select · Esc dismiss
          </p>
        </div>
      )}
    </div>
  );
}

export { extractMentionIds };
