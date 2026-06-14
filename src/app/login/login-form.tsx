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
  const [showDevForm, setShowDevForm] = React.useState(false);
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
        className="rounded-2xl p-6 sm:p-8"
        style={{
          background: "rgba(255,255,255,0.72)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          border: "1px solid rgba(30,58,95,0.12)",
          boxShadow:
            "0 25px 80px rgba(22,40,62,0.16), 0 0 0 1px rgba(201,162,58,0.10) inset",
        }}
      >
        {/* Mobile logo */}
        <div className="mb-7 flex items-center gap-3 lg:hidden">
          <Image
            src="https://nationalgroupindia.com/logo_full.webp"
            alt="National Group India"
            width={40}
            height={40}
            className="object-contain"
            priority
          />
          <div>
            <p className="text-sm font-bold text-[#16283e] leading-tight">
              National Group India
            </p>
            <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#16283e]/55 mt-0.5">
              Sharepoint
            </p>
          </div>
        </div>

        {/* Heading */}
        <div className="mb-5 space-y-1">
          <h2 className="text-xl font-bold text-[#16283e] tracking-tight">
            Welcome back
          </h2>
          <p className="text-sm text-[#16283e]/55">
            Sign in to your corporate workspace to continue.
          </p>
        </div>

        {/* Error */}
        {formError && (
          <div className="mb-5 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-600">
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
                <Loader2 className="h-4 w-4 animate-spin text-[#16283e]/60" />
              ) : (
                <MicrosoftLogo />
              )}
              Sign in with Microsoft
            </button>
          ) : (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-700">
              Microsoft Entra ID SSO is not configured yet. Use the developer
              login below to explore the app.
            </div>
          )}

          {/* Dev login — collapsed by default, expands on click */}
          {devLoginEnabled && (
            <>
              <button
                type="button"
                onClick={() => setShowDevForm((v) => !v)}
                className="relative flex w-full items-center gap-3 py-1 group"
              >
                <div className="flex-1 border-t border-[#1e3a5f]/10" />
                <span className="text-xs text-[#16283e]/40 font-medium group-hover:text-[#16283e]/70 transition-colors whitespace-nowrap">
                  {showDevForm ? "hide developer login ▲" : "or developer login ▼"}
                </span>
                <div className="flex-1 border-t border-[#1e3a5f]/10" />
              </button>

              {showDevForm && (
                <form onSubmit={onDevLogin} className="space-y-3">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="email"
                      className="text-xs font-semibold text-[#16283e]/60 uppercase tracking-wider"
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
                      className="text-xs font-semibold text-[#16283e]/60 uppercase tracking-wider"
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
                    className="btn-premium flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-[#16283e] shadow-lg disabled:opacity-60"
                  >
                    {loading === "dev" && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    Sign in
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        {/* Bottom note */}
        <p className="mt-5 text-center text-[11px] text-[#16283e]/40">
          Secured with Microsoft 365 · National Group India
        </p>
      </div>
    </div>
  );
}
