"use client";

import * as React from "react";
import { CheckSquare, ClipboardList, Loader2, Plus, Square } from "lucide-react";
import type { WorkspacePermissions, Person } from "@/types/app";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

type ActionItem = {
  text: string;
  assigneeId: string | null;
  dueDate: string | null;
  done: boolean;
};

type MeetingNote = {
  id: string;
  title: string;
  agenda: string | null;
  notes: string | null;
  actionItems: ActionItem[] | null;
  meetingDate: string;
  createdById: string;
};

export function MeetingNotes({
  projectId,
  allUsers,
  permissions,
}: {
  projectId: string;
  allUsers: Person[];
  permissions: WorkspacePermissions;
}) {
  const { toast } = useToast();
  const [meetings, setMeetings] = React.useState<MeetingNote[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    title: "",
    meetingDate: new Date().toISOString().split("T")[0],
    agenda: "",
    notes: "",
    actionItemsText: "",
  });

  const loadMeetings = React.useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/meetings`);
    if (res.ok) {
      const data = await res.json();
      setMeetings(data.meetings);
    }
    setLoading(false);
  }, [projectId]);

  React.useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  async function createMeeting() {
    if (!form.title.trim()) {
      toast({ title: "Meeting title required", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      // Parse action items from bullet lines
      const actionItems: ActionItem[] = form.actionItemsText
        .split("\n")
        .map((line) => line.replace(/^[-•*]\s*/, "").trim())
        .filter(Boolean)
        .map((text) => ({ text, assigneeId: null, dueDate: null, done: false }));

      const res = await fetch(`/api/projects/${projectId}/meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          meetingDate: new Date(form.meetingDate).toISOString(),
          agenda: form.agenda || null,
          notes: form.notes || null,
          actionItems: actionItems.length > 0 ? actionItems : null,
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Meeting notes saved", variant: "success" });
      setDialogOpen(false);
      setForm({ title: "", meetingDate: new Date().toISOString().split("T")[0], agenda: "", notes: "", actionItemsText: "" });
      loadMeetings();
    } catch {
      toast({ title: "Could not save meeting", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActionItem(meetingId: string, items: ActionItem[], idx: number) {
    const updated = items.map((item, i) =>
      i === idx ? { ...item, done: !item.done } : item,
    );
    await fetch(`/api/projects/${projectId}/meetings/${meetingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionItems: updated }),
    });
    loadMeetings();
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Meeting Notes</h3>
          <p className="text-sm text-muted-foreground">
            Record meeting minutes and track action items
          </p>
        </div>
        {permissions.canCreateTask && (
          <Button variant="brand" size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Add Meeting
          </Button>
        )}
      </div>

      {meetings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium">No meetings recorded</p>
            <p className="text-sm text-muted-foreground">
              Add meeting notes to capture decisions and action items
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => {
            const isOpen = expanded === m.id;
            const items: ActionItem[] = m.actionItems ?? [];
            const done = items.filter((i) => i.done).length;
            return (
              <Card key={m.id} className="overflow-hidden">
                <CardHeader
                  className="flex flex-row items-center justify-between gap-3 py-3 px-4 cursor-pointer hover:bg-muted/30"
                  onClick={() => setExpanded(isOpen ? null : m.id)}
                >
                  <div className="flex items-center gap-3">
                    <ClipboardList className="h-4 w-4 text-primary flex-shrink-0" />
                    <div>
                      <p className="font-semibold">{m.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(m.meetingDate), "MMMM d, yyyy")}
                        {items.length > 0 && ` · ${done}/${items.length} actions done`}
                      </p>
                    </div>
                  </div>
                  <span className="text-muted-foreground text-sm">{isOpen ? "▲" : "▼"}</span>
                </CardHeader>
                {isOpen && (
                  <CardContent className="space-y-4 px-4 pb-4 border-t pt-4">
                    {m.agenda && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Agenda</p>
                        <p className="text-sm whitespace-pre-wrap">{m.agenda}</p>
                      </div>
                    )}
                    {m.notes && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Notes</p>
                        <p className="text-sm whitespace-pre-wrap">{m.notes}</p>
                      </div>
                    )}
                    {items.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Action Items</p>
                        <ul className="space-y-1.5">
                          {items.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <button
                                onClick={() => toggleActionItem(m.id, items, idx)}
                                className="mt-0.5 flex-shrink-0 text-primary hover:text-primary/80"
                              >
                                {item.done ? (
                                  <CheckSquare className="h-4 w-4" />
                                ) : (
                                  <Square className="h-4 w-4" />
                                )}
                              </button>
                              <span className={`text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>
                                {item.text}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add Meeting Notes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label>Meeting title *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Sprint Planning Meeting"
                />
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.meetingDate}
                  onChange={(e) => setForm((f) => ({ ...f, meetingDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Agenda</Label>
              <Textarea
                value={form.agenda}
                onChange={(e) => setForm((f) => ({ ...f, agenda: e.target.value }))}
                rows={2}
                placeholder="Topics to discuss..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Meeting notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                placeholder="Decisions made, key discussion points..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Action items (one per line)</Label>
              <Textarea
                value={form.actionItemsText}
                onChange={(e) => setForm((f) => ({ ...f, actionItemsText: e.target.value }))}
                rows={3}
                placeholder={"- Update project timeline\n- Send status report to stakeholders"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="brand" onClick={createMeeting} disabled={saving}>
              {saving && <Loader2 className="animate-spin h-4 w-4" />}
              Save Notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
