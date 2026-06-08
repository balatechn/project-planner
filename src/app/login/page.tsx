import type { Metadata } from "next";
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
      {/* Brand panel */}
      <div className="brand-gradient relative hidden flex-col justify-between p-12 text-white lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 backdrop-blur">
            ◆
          </div>
          Project Planner
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-bold leading-tight">
            Plan, track and deliver work — all in one place.
          </h1>
          <p className="max-w-md text-white/80">
            A premium, enterprise-grade workspace combining the best of
            Microsoft Planner, Asana, Monday and Jira. Secure single sign-on
            with your Microsoft 365 account.
          </p>
          <ul className="space-y-2 pt-4 text-sm text-white/90">
            <li>✓ Kanban, Gantt, Calendar & List views</li>
            <li>✓ Role-based access & audit logging</li>
            <li>✓ OneDrive / SharePoint file integration</li>
            <li>✓ Email notifications via Microsoft Graph</li>
          </ul>
        </div>
        <p className="text-xs text-white/60">
          © {new Date().getFullYear()} Project Planner. All rights reserved.
        </p>
      </div>

      {/* Form panel */}
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
