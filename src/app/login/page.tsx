import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth, authMeta } from "@/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  const params = await searchParams;

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      {/* ── Brand panel ─────────────────────────────────────────────── */}
      <div className="brand-gradient relative hidden flex-col justify-between p-12 text-white lg:flex">

        {/* Logo + company name */}
        <div className="flex items-center gap-4">
          <Image
            src="https://nationalgroupindia.com/logo_full.webp"
            alt="National Group India"
            width={64}
            height={64}
            className="object-contain brightness-0 invert flex-shrink-0"
            priority
          />
          <div>
            <p className="text-base font-bold leading-tight tracking-wide">
              National Group India
            </p>
            <p className="text-xs text-white/70 font-medium tracking-wider uppercase">
              Project Planner
            </p>
          </div>
        </div>

        {/* Hero copy */}
        <div className="space-y-4">
          <h1 className="text-4xl font-bold leading-tight">
            Plan, track and deliver work — all in one place.
          </h1>
          <p className="max-w-md text-white/80">
            Your all-in-one workspace for projects, tasks, training and meeting
            rooms — powered by Microsoft 365.
          </p>
          <ul className="space-y-2 pt-4 text-sm text-white/90">
            <li>✓ Project Planning — Kanban, Gantt, Calendar &amp; List views</li>
            <li>✓ Task Management — assignments, priorities &amp; deadlines</li>
            <li>✓ Training — structured learning &amp; resource management</li>
            <li>✓ Meeting Room Booking — auto Teams sync &amp; guest invites</li>
            <li>✓ Microsoft 365 SSO — secure, no separate password needed</li>
            <li>✓ Role-based access — Admin, PM &amp; Team Member levels</li>
          </ul>
        </div>

        {/* Footer */}
        <p className="text-xs text-white/60">
          © {new Date().getFullYear()} National Group India. All rights reserved.
        </p>
      </div>

      {/* ── Form panel ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-center p-6">
        <LoginForm
          entraConfigured={authMeta.entraConfigured}
          devLoginEnabled={authMeta.enableDevLogin}
          callbackUrl={params.callbackUrl ?? "/dashboard"}
          error={params.error}
        />
      </div>
    </div>
  );
}
