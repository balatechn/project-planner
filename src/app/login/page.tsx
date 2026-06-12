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
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 grid min-h-screen lg:grid-cols-[1fr_500px]">

        {/* ── Brand panel ─────────────────────────────────────────── */}
        <div className="hidden lg:flex flex-col justify-between p-14 xl:p-16">

          {/* Logo */}
          <div className="animate-fade-in flex items-center gap-4">
            <div className="animate-float">
              <Image
                src="https://nationalgroupindia.com/logo_full.webp"
                alt="National Group India"
                width={56}
                height={56}
                className="object-contain brightness-0 invert drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]"
                priority
              />
            </div>
            <div>
              <p className="text-lg font-bold text-white leading-tight tracking-wide">
                National Group India
              </p>
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-white/50 mt-0.5">
                Sharepoint
              </p>
            </div>
          </div>

          {/* Hero headline */}
          <div className="space-y-8">
            <div className="space-y-4 animate-slide-up delay-75">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 font-medium backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                Est. 1949 · 200+ landmark projects
              </div>
              <h1 className="text-5xl xl:text-6xl font-bold leading-[1.08] text-white tracking-tight">
                Pioneering{" "}
                <span className="text-gradient-gold">infrastructure.</span>
                <br />Transforming communities.
              </h1>
              <p className="text-lg text-white/55 max-w-md leading-relaxed">
                One workspace for the entire group — Infrabuild, iSky Transport,
                Gold &amp; Diamond, Super Bazar and Rainland Autocorp — powered
                by Microsoft 365.
              </p>
            </div>

            {/* Feature list */}
            <ul className="space-y-3">
              {FEATURES.map((f, i) => (
                <li
                  key={f.title}
                  className="animate-slide-up flex items-center gap-3 group"
                  style={{ animationDelay: `${(i + 2) * 80}ms` }}
                >
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/8 text-base group-hover:bg-white/10 transition-colors">
                    {f.icon}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white/90">{f.title}</p>
                    <p className="text-xs text-white/45">{f.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Group companies + footer */}
          <div className="space-y-4">
            <div className="animate-fade-in delay-450">
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                The National Group family
              </p>
              <div className="flex flex-wrap gap-2">
                {GROUP_COMPANIES.map((c) => (
                  <span
                    key={c.name}
                    title={c.field}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/65 backdrop-blur-sm transition-colors hover:border-amber-400/30 hover:bg-white/10 hover:text-white/90"
                  >
                    <span aria-hidden="true">{c.icon}</span>
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
            <p className="animate-fade-in delay-600 text-xs text-white/30">
              © {new Date().getFullYear()} National Group India. All rights reserved.
            </p>
          </div>
        </div>

        {/* ── Form panel ──────────────────────────────────────────── */}
        <div className="flex min-h-screen items-center justify-center p-6 lg:min-h-0 lg:p-10">
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
