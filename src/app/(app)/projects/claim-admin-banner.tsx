"use client";

import * as React from "react";
import { ShieldCheck, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function ClaimAdminBanner() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [claimed, setClaimed] = React.useState(false);

  async function claim() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/setup", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        toast({ title: data.error ?? "Setup failed", variant: "error" });
        setLoading(false);
        return;
      }

      setClaimed(true);
      toast({
        title: "Admin access granted!",
        description: "Signing you out to activate your new role…",
        variant: "success",
      });

      // Sign out after 1.5 s so the toast is visible, then land on /login
      setTimeout(() => {
        window.location.href = "/api/auth/signout?callbackUrl=/login";
      }, 1500);
    } catch {
      toast({ title: "Network error — please try again", variant: "error" });
      setLoading(false);
    }
  }

  if (claimed) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/5 px-5 py-4 text-sm text-green-700 dark:text-green-400">
        <LogOut className="h-4 w-4 shrink-0" />
        Admin role granted — signing you out now…
      </div>
    );
  }

  return (
    <div className="flex items-start gap-4 rounded-xl border border-primary/30 bg-primary/5 px-5 py-4">
      <div className="brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white">
        <ShieldCheck className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground">
          Your account needs Admin access
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          You are recognised as a designated admin but your session role has not
          been activated yet. Click the button — you will be signed out
          automatically and re-signed in with full Admin permissions.
        </p>
      </div>
      <Button
        variant="brand"
        size="sm"
        className="shrink-0 mt-0.5"
        onClick={claim}
        disabled={loading}
      >
        {loading
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <ShieldCheck className="h-4 w-4" />}
        {loading ? "Activating…" : "Activate Admin"}
      </Button>
    </div>
  );
}
