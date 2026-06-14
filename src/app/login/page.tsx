import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth, authMeta } from "@/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const FEATURES = [
  {
    icon: "📋",
    title: "Project Planning",
    desc: "Kanban, Gantt, Calendar & List views",
  },
  {
    icon: "✅",
    title: "Task Management",
    desc: "Assignments, priorities & deadlines",
  },
  {
    icon: "🎓",
    title: "Training & Learning",
    desc: "Structured resources & progress tracking",
  },
  {
    icon: "🏢",
    title: "Meeting Room Booking",
    desc: "Auto Teams sync & guest invites",
  },
  {
    icon: "🔐",
    title: "Microsoft 365 SSO",
    desc: "Secure login, no extra password",
  },
];

// Group companies — nationalgroupindia.com
const GROUP_COMPANIES = [
  { icon: "🏗️", name: "National Infrabuild", field: "Roads, bridges & public infrastructure" },
  { icon: "🚆", name: "iSky Transport Systems", field: "Smart transport solutions" },
  { icon: "💎", name: "National Gold & Diamond", field: "Fine jewellery" },
  { icon: "🛒", name: "National Super Bazar", field: "Retail" },
  { icon: "🚗", name: "Rainland Autocorp", field: "Automotive" },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  const params = await searchParams;

  return (
    <div className="login-bg">
      {/* Animated ambient orbs */}
      <div className="login-orb login-orb-1" aria-hidden="true" />
      <div className="login-orb login-orb-2" aria-hidden="true" />
      <div className="login-orb login-orb-3" aria-hidden="true" />

      {/* Subtle grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(22,40,62,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(22,40,62,.35) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
        aria-hidden="true"
      />

      {/* Content — h-screen so nothing overflows the viewport */}
      <div className="relative z-10 grid h-screen lg:grid-cols-[1fr_460px]">

        {/* ── Brand panel ─────────────────────────────────────────── */}
        <div className="hidden lg:flex flex-col justify-between p-8 xl:p-12 overflow-hidden">

          {/* Logo */}
          <div className="animate-fade-in flex items-center gap-3">
            <div className="animate-float">
              <Image
                src="https://nationalgroupindia.com/logo_full.webp"
                alt="National Group India"
                width={44}
                height={44}
                className="object-contain drop-shadow-[0_4px_14px_rgba(201,162,58,0.35)]"
                priority
              />
            </div>
            <div>
              <p className="text-base font-bold text-[#16283e] leading-tight tracking-wide">
                National Group India
              </p>
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#16283e]/55 mt-0.5">
                Sharepoint
              </p>
            </div>
          </div>

          {/* Hero headline */}
          <div className="space-y-5">
            <div className="space-y-3 animate-slide-up delay-75">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#1e3a5f]/15 bg-white/70 px-3 py-1 text-xs text-[#16283e]/70 font-medium backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                Est. 1949 · 200+ landmark projects
              </div>
              <h1 className="text-4xl xl:text-5xl font-bold leading-[1.08] text-[#16283e] tracking-tight">
                Pioneering{" "}
                <span className="text-gradient">infrastructure.</span>
                <br />Transforming communities.
              </h1>
              <p className="text-sm text-[#16283e]/60 max-w-md leading-relaxed">
                One workspace for the entire group — Infrabuild, iSky Transport,
                Gold &amp; Diamond, Super Bazar and Rainland Autocorp — powered
                by Microsoft 365.
              </p>
            </div>

            {/* Feature list */}
            <ul className="space-y-2">
              {FEATURES.map((f, i) => (
                <li
                  key={f.title}
                  className="animate-slide-up flex items-center gap-2.5 group"
                  style={{ animationDelay: `${(i + 2) * 80}ms` }}
                >
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/70 border border-[#1e3a5f]/10 text-sm shadow-sm group-hover:bg-white transition-colors">
                    {f.icon}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#16283e]">{f.title}</p>
                    <p className="text-xs text-[#16283e]/55">{f.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Group companies + footer */}
          <div className="space-y-2">
            <div className="animate-fade-in delay-450">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#16283e]/45">
                The National Group family
              </p>
              <div className="flex flex-wrap gap-1.5">
                {GROUP_COMPANIES.map((c) => (
                  <span
                    key={c.name}
                    title={c.field}
                    className="inline-flex items-center gap-1 rounded-full border border-[#1e3a5f]/12 bg-white/70 px-2.5 py-1 text-xs text-[#16283e]/75 backdrop-blur-sm shadow-sm transition-colors hover:border-amber-500/40 hover:bg-white hover:text-[#16283e]"
                  >
                    <span aria-hidden="true">{c.icon}</span>
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
            <p className="animate-fade-in delay-600 text-xs text-[#16283e]/40">
              © {new Date().getFullYear()} National Group India. All rights reserved.
            </p>
          </div>
        </div>

        {/* ── Form panel — scrollable on mobile, centered on desktop ── */}
        <div className="flex h-full items-center justify-center p-5 overflow-y-auto">
          <LoginForm
            entraConfigured={authMeta.entraConfigured}
            devLoginEnabled={authMeta.enableDevLogin}
            callbackUrl={params.callbackUrl ?? "/dashboard"}
            error={params.error}
          />
        </div>
      </div>
    </div>
  );
}
