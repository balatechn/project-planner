"use client";

import * as React from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

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
    const res = await signIn("dev-login", {
      email,
      password,
      redirect: false,
    });
    setLoading(null);
    if (res?.error) {
      setFormError("Invalid email or password.");
    } else {
      window.location.href = callbackUrl;
    }
  }

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="space-y-1">
        {/* Mobile-only logo — shown when the brand panel is hidden */}
        <div className="mb-3 flex items-center gap-3 lg:hidden">
          <div className="brand-gradient flex h-10 w-10 items-center justify-center rounded-xl p-1.5">
            <Image
              src="https://nationalgroupindia.com/logo_full.webp"
              alt="National Group India"
              width={32}
              height={32}
              className="object-contain brightness-0 invert"
              priority
            />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">National Group India</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
              Project Planner
            </p>
          </div>
        </div>

        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>
          Sign in to your corporate workspace to continue.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {formError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </div>
        )}

        {entraConfigured ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={onMicrosoft}
            disabled={loading !== null}
          >
            {loading === "sso" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <MicrosoftLogo />
            )}
            Sign in with Microsoft
          </Button>
        ) : (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            Microsoft Entra ID SSO is not configured yet. Use the developer
            login below to explore the app.
          </div>
        )}

        {devLoginEnabled && (
          <>
            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                or developer login
              </span>
            </div>

            <form onSubmit={onDevLogin} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@nationalgroupindia.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                variant="brand"
                className="w-full"
                disabled={loading !== null}
              >
                {loading === "dev" && <Loader2 className="animate-spin" />}
                Sign in
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
