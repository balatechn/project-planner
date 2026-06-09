"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function ClaimAdminBanner() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function claim() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/setup", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        toast({ title: data.error ?? "Setup failed", variant: "error" });
        return;
      }

      setDone(true);
      toast({
        title: "Admin access granted!",
        description: "Sign out and sign back in to activate your new role.",
        variant: "success",
      });

      // Hard reload after a short delay so the session re-hydrates
      setTimeout(() => {
        router.push("/api/auth/signout?callbackUrl=/login");
      }, 2000);
    } catch {
      toast({ title: "Network error — please try again", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  if (done) return null;

  return (
    <div className="flex items-start gap-4 rounded-xl border border-primary/30 bg-primary/5 px-5 py-4">
      <div className="brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white">
        <ShieldCheck className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground">First-run setup — no admin account found</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Your account currently has limited permissions. Click below to claim
          Admin access. This option is only available once, before any admin
          exists.
        </p>
      </div>
      <Button
        variant="brand"
        size="sm"
        className="shrink-0 mt-0.5"
        onClick={claim}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        {loading ? "Claiming…" : "Claim Admin Access"}
      </Button>
    </div>
  );
}
