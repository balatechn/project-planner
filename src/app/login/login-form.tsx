"use client";

import * as React from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden>
      <path fill="#f25022" d="M1 1h10v10H1z" />
      <path fill="#7fba00" d="M12 1h10v10H12z" />
      <path fill="#00a4ef" d="M1 12h10v10H1z" />
      <path fill="#ffb900" d="M12 12h10v10H12z" />
    </svg>
  );
}

export function LoginForm({
  entraConfigured,
  devLoginEnabled,
  callbackUrl,
  error,
}: {
  entraConfigured: boolean;
  devLoginEnabled: boolean;
  callbackUrl: string;
  error?: string;
}) {
  const [loading, setLoading] = React.useState<"sso" | "dev" | null>(null);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(
    error ? "Sign-in failed. Please try again." : null,
  );

  async function onMicrosoft() {
    setLoading("sso");
    await signIn("microsoft-entra-id", { callbackUrl });
  }

  async function onDevLogin(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setLoading("dev");
    const res = await signIn("dev-login", { email, password, redirect: false });
    setLoading(null);
    if (res?.error) setFormError("Invalid email or password.");
    else window.location.href = callbackUrl;
  }

  return (
    <div className="animate-scale-in w-full max-w-[420px]">

      {/* Glass card */}
      <div
        className="rounded-2xl p-8 sm:p-10"
        style={{
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow:
            "0 25px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(245,158,11,0.08) inset",
        }}
      >
        {/* Mobile logo */}
        <div className="mb-7 flex items-center gap-3 lg:hidden">
          <Image
            src="https://nationalgroupindia.com/logo_full.webp"
            alt="National Group India"
            width={40}
            height={40}
            className="object-contain brightness-0 invert"
            priority
          />
          <div>
            <p className="text-sm font-bold text-white leading-tight">
              National Group India
            </p>
            <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-white/50 mt-0.5">
              Sharepoint
            </p>
          </div>
        </div>

        {/* Heading */}
        <div className="mb-8 space-y-1.5">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Welcome back
          </h2>
          <p className="text-sm text-white/50">
            Sign in to your corporate workspace to continue.
          </p>
        </div>

        {/* Error */}
        {formError && (
          <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {formError}
          </div>
        )}

        <div className="space-y-4">
          {/* Microsoft SSO */}
          {entraConfigured ? (
            <button
              type="button"
              onClick={onMicrosoft}
              disabled={loading !== null}
              className="btn-microsoft flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
            >
              {loading === "sso" ? (
                <Loader2 className="h-4 w-4 animate-spin text-white/70" />
              ) : (
                <MicrosoftLogo />
              )}
              Sign in with Microsoft
            </button>
          ) : (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-xs text-amber-400/80">
              Microsoft Entra ID SSO is not configured yet. Use the developer
              login below to explore the app.
            </div>
          )}

          {/* Dev login divider + form */}
          {devLoginEnabled && (
            <>
              <div className="relative flex items-center gap-3 py-1">
                <div className="flex-1 border-t border-white/8" />
                <span className="text-xs text-white/30 font-medium">
                  or developer login
                </span>
                <div className="flex-1 border-t border-white/8" />
              </div>

              <form onSubmit={onDevLogin} className="space-y-3.5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="text-xs font-semibold text-white/60 uppercase tracking-wider"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@nationalgroupindia.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="login-input w-full rounded-xl px-4 py-2.5 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="password"
                    className="text-xs font-semibold text-white/60 uppercase tracking-wider"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="login-input w-full rounded-xl px-4 py-2.5 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading !== null}
                  className="btn-premium mt-1 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-[#16283e] shadow-lg disabled:opacity-60"
                >
                  {loading === "dev" && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Sign in
                </button>
              </form>
            </>
          )}
        </div>

        {/* Bottom note */}
        <p className="mt-8 text-center text-[11px] text-white/25">
          Secured with Microsoft 365 · National Group India
        </p>
      </div>
    </div>
  );
}
