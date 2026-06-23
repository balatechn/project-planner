"use client";

import * as React from "react";
import { Car, ExternalLink, RefreshCw } from "lucide-react";

export function MontraSalesClient({ url }: { url: string }) {
  const [iframeKey, setIframeKey] = React.useState(0);
  const [status, setStatus] = React.useState<"loading" | "loaded" | "error">("loading");

  function reload() {
    setStatus("loading");
    setIframeKey((k) => k + 1);
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Header bar */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b bg-card px-4 py-2.5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400">
          <Car className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">Montra Sales</p>
          <p className="truncate text-xs text-muted-foreground">{url}</p>
        </div>
        <div className="ml-auto flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={reload}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
          >
            <RefreshCw className="h-3 w-3" />
            Reload
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-orange-700"
          >
            <ExternalLink className="h-3 w-3" />
            Open in new tab
          </a>
        </div>
      </div>

      {/* Iframe area */}
      <div className="relative flex-1 overflow-hidden">
        {/* Loading overlay */}
        {status === "loading" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/60">
            <p className="text-sm text-muted-foreground">Loading Montra Sales…</p>
          </div>
        )}

        {/* Error / not-available fallback */}
        {status === "error" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
              <Car className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold">Site not available for embedding</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                The Montra Sales portal may restrict iframe access or may not be live yet.
              </p>
            </div>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-700"
            >
              <ExternalLink className="h-4 w-4" />
              Open {url}
            </a>
          </div>
        )}

        <iframe
          key={iframeKey}
          src={url}
          title="Montra Sales"
          className="h-full w-full border-0"
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
        />
      </div>
    </div>
  );
}
