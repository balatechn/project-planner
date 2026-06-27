"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, Send, Loader2, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Result = {
  id: string;
  title: string;
  priority: string;
  dueDate: string | null;
  projectName: string;
};

export function AiQuickAdd() {
  const [text, setText] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<Result | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/ai/quick-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data.task);
        setText("");
      } else {
        setError(data.error ?? "Something went wrong");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function dismiss() {
    setResult(null);
    setError(null);
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* Input row */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border bg-card px-3 py-2 transition-shadow",
          "focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/40",
        )}
      >
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Add task… e.g. 'Review report by Friday high priority'"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          disabled={loading}
        />
        <button
          onClick={submit}
          disabled={!text.trim() || loading}
          className="shrink-0 rounded-lg p-1 text-primary transition-colors hover:bg-primary/10 disabled:opacity-30"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Success chip */}
      {result && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs dark:border-emerald-800 dark:bg-emerald-950/40">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="min-w-0 flex-1 truncate text-emerald-800 dark:text-emerald-200">
            <span className="font-medium">{result.title}</span>
            <span className="ml-1 text-emerald-600 dark:text-emerald-400">
              · {result.projectName}
              {result.dueDate
                ? ` · due ${new Date(result.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                : ""}
            </span>
          </span>
          <Link
            href="/my-tasks"
            className="shrink-0 font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300"
          >
            View
          </Link>
          <button onClick={dismiss} className="shrink-0 text-emerald-500 hover:text-emerald-700">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Error chip */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs dark:border-red-800 dark:bg-red-950/40">
          <span className="min-w-0 flex-1 text-red-700 dark:text-red-300">{error}</span>
          <button onClick={dismiss} className="shrink-0 text-red-400 hover:text-red-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
