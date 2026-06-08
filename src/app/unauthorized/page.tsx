import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <ShieldAlert className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold">Access denied</h1>
      <p className="max-w-md text-muted-foreground">
        You don&apos;t have permission to view this page. If you believe this is
        a mistake, contact your workspace administrator.
      </p>
      <Button asChild variant="brand">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
