"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserMinus, UserPlus } from "lucide-react";
import type { Person } from "@/types/app";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { initials } from "@/lib/utils";

type UserOption = Person;

export function ManageMembersDialog({
  open,
  onClose,
  projectId,
  ownerId,
  projectManagerId,
  memberIds,
  allUsers,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  ownerId: string;
  projectManagerId: string | null;
  /** Explicit ProjectMember user ids (excludes owner/PM implicit access) */
  memberIds: string[];
  allUsers: UserOption[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [ids, setIds] = React.useState<string[]>(memberIds);
  const [query, setQuery] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => setIds(memberIds), [memberIds, open]);

  const q = query.trim().toLowerCase();
  const candidates = allUsers.filter(
    (u) =>
      u.id !== ownerId &&
      u.id !== projectManagerId &&
      (!q ||
        (u.name ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q)),
  );

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberIds: ids }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast({ title: "Members updated", variant: "success" });
      onClose();
      router.refresh();
    } catch {
      toast({ title: "Could not update members", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Manage members</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Members can be assigned to tasks in this project. The owner and PM
            always have access.
          </p>
        </DialogHeader>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people…"
          className="h-9 flex-shrink-0"
        />

        <div className="flex-1 min-h-0 space-y-1 overflow-y-auto thin-scroll py-1">
          {candidates.map((u) => {
            const isMember = ids.includes(u.id);
            return (
              <div
                key={u.id}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50"
              >
                <Avatar className="h-7 w-7">
                  {u.image && <AvatarImage src={u.image} alt="" />}
                  <AvatarFallback className="text-[10px]">
                    {initials(u.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.name ?? "—"}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
                <Button
                  variant={isMember ? "outline" : "brand"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    setIds((m) =>
                      isMember ? m.filter((x) => x !== u.id) : [...m, u.id],
                    )
                  }
                >
                  {isMember ? (
                    <>
                      <UserMinus className="h-3.5 w-3.5" /> Remove
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-3.5 w-3.5" /> Add
                    </>
                  )}
                </Button>
              </div>
            );
          })}
          {candidates.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No people match.
            </p>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center justify-between border-t pt-3">
          <span className="text-xs text-muted-foreground">
            {ids.length} member{ids.length === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="brand" onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save members
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
