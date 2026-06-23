"use client";

import { Car, ExternalLink, BarChart3, Users, Zap } from "lucide-react";

const HIGHLIGHTS = [
  { icon: Zap,       label: "EV Sales Tracking",     desc: "Real-time Montra EV unit sales" },
  { icon: BarChart3, label: "Revenue Analytics",      desc: "Targets, actuals & forecasts"   },
  { icon: Users,     label: "Customer Management",    desc: "Leads, follow-ups & closures"   },
];

export function MontraSalesClient({ url }: { url: string }) {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-lg space-y-8">

        {/* Card */}
        <div className="rounded-2xl border bg-card p-8 shadow-sm space-y-6 text-center">

          {/* Logo area */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400">
              <Car className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Montra EV Sales</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Rainland AutoCorp · Electric Vehicle Sales Portal
              </p>
            </div>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-3 gap-3 text-left">
            {HIGHLIGHTS.map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="rounded-xl border bg-muted/40 p-3 space-y-1.5"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <p className="text-xs font-semibold leading-tight">{label}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">{desc}</p>
              </div>
            ))}
          </div>

          {/* Launch button */}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-700 active:scale-[0.98]"
          >
            <ExternalLink className="h-4 w-4" />
            Open Montra Sales Dashboard
          </a>

          {/* URL + note */}
          <p className="text-[11px] text-muted-foreground">
            {url}
            <span className="mx-1.5 opacity-40">·</span>
            Opens in a new tab · Microsoft SSO login required
          </p>
        </div>

      </div>
    </div>
  );
}
