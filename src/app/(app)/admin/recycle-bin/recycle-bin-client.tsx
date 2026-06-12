"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ArchiveRestore, FolderKanban, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/components/ui/toast";
import { TASK_STATUS_LABELS } from "@/lib/constants";

type BinProject = {
  id: string;
  name: string;
  key: string;
  color: string;
  deletedAt: string;
  ownerName: string | null;
  taskCount: number;
};
type BinTask = {
  id: string;
  title: string;
  status: string;
  deletedAt: string;
  projectName: string;
  projectColor: string;
};

export function RecycleBinClient({
  projects,
  tasks,
}: {
  projects: BinProject[];
  tasks: BinTask[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [purgeTarget, setPurgeTarget] = React.useState<
    { type: "project" | "task"; id: string; label: string } | null
  >(null);

  async function act(
    type: "project" | "task",
    id: string,
    action: "restore" | "purge",
  ) {
    setBusy(id);
    try {
      const res = await fetch("/api/admin/recycle-bin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, action }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "Action failed");
      }
      toast({
        title: action === "restore" ? "Restored" : "Permanently deleted",
        variant: "success",
      });
      router.refresh();
    } catch (e) {
      toast({
        title: "Action failed",
        description: e instanceof Error ? e.message : undefined,
        variant: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  const empty = projects.length === 0 && tasks.length === 0;

  return (
    <div className="space-y-6">
      {empty && (
        <Card>
          <CardContent>
            <EmptyState
              icon={Trash2}
              title="Recycle bin is empty"
              description="Deleted projects and tasks will appear here and stay recoverable for 30 days."
            />
          </CardContent>
        </Card>
      )}

      {projects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projects ({projects.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {projects.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5"
              >
                <span
                  className="h-8 w-1.5 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.key} · {p.taskCount} tasks · deleted{" "}
                    {formatDistanceToNow(new Date(p.deletedAt), { addSuffix: true })}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy === p.id}
                  onClick={() => act("project", p.id, "restore")}
                >
                  {busy === p.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArchiveRestore className="h-3.5 w-3.5" />
                  )}
                  Restore
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={busy === p.id}
                  onClick={() =>
                    setPurgeTarget({ type: "project", id: p.id, label: p.name })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete forever
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tasks ({tasks.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasks.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5"
              >
                <span
                  className="h-8 w-1.5 rounded-full"
                  style={{ backgroundColor: t.projectColor }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.projectName} ·{" "}
                    {TASK_STATUS_LABELS[t.status as keyof typeof TASK_STATUS_LABELS] ?? t.status}{" "}
                    · deleted{" "}
                    {formatDistanceToNow(new Date(t.deletedAt), { addSuffix: true })}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy === t.id}
                  onClick={() => act("task", t.id, "restore")}
                >
                  {busy === t.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArchiveRestore className="h-3.5 w-3.5" />
                  )}
                  Restore
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={busy === t.id}
                  onClick={() =>
                    setPurgeTarget({ type: "task", id: t.id, label: t.title })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete forever
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={!!purgeTarget}
        onOpenChange={(o) => !o && setPurgeTarget(null)}
        title={`Permanently delete "${purgeTarget?.label ?? ""}"?`}
        description="This removes it forever, including all nested data. This cannot be undone."
        confirmLabel="Delete forever"
        onConfirm={async () => {
          if (purgeTarget) await act(purgeTarget.type, purgeTarget.id, "purge");
        }}
      />
    </div>
  );
}
