"use client";

import * as React from "react";
import { Loader2, Plus, Zap } from "lucide-react";
import type { TaskListItem, WorkspacePermissions, Person } from "@/types/app";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

type Sprint = {
  id: string;
  name: string;
  goal: string | null;
  status: "PLANNING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  startDate: string | null;
  endDate: string | null;
};

const STATUS_COLORS: Record<Sprint["status"], string> = {
  PLANNING: "bg-muted text-muted-foreground",
  ACTIVE: "bg-green-100 text-green-800",
  COMPLETED: "bg-blue-100 text-blue-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export function SprintView({
  projectId,
  tasks,
  allUsers,
  permissions,
  onOpenTask,
  onSaved,
}: {
  projectId: string;
  tasks: TaskListItem[];
  allUsers: Person[];
  permissions: WorkspacePermissions;
  onOpenTask: (t: TaskListItem) => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [sprints, setSprints] = React.useState<Sprint[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    name: "",
    goal: "",
    startDate: "",
    endDate: "",
  });

  const loadSprints = React.useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/sprints`);
    if (res.ok) {
      const data = await res.json();
      setSprints(data.sprints);
    }
    setLoading(false);
  }, [projectId]);

  React.useEffect(() => {
    loadSprints();
  }, [loadSprints]);

  async function createSprint() {
    if (!form.name.trim()) {
      toast({ title: "Sprint name required", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/sprints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          goal: form.goal || null,
          startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
          endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create sprint");
      toast({ title: "Sprint created", variant: "success" });
      setDialogOpen(false);
      setForm({ name: "", goal: "", startDate: "", endDate: "" });
      loadSprints();
    } catch {
      toast({ title: "Could not create sprint", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function updateSprintStatus(id: string, status: Sprint["status"]) {
    await fetch(`/api/projects/${projectId}/sprints/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadSprints();
  }

  const backlogTasks = tasks.filter((t) => !t.sprintId);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Sprint Planning</h3>
          <p className="text-sm text-muted-foreground">
            Organise work into time-boxed sprints
          </p>
        </div>
        {permissions.canCreateTask && (
          <Button variant="brand" size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> New Sprint
          </Button>
        )}
      </div>

      {/* Active sprints */}
      {sprints.map((sprint) => {
        const sprintTasks = tasks.filter((t) => t.sprintId === sprint.id);
        const done = sprintTasks.filter((t) => t.status === "COMPLETED").length;
        return (
          <Card key={sprint.id} className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-3 py-3 px-4 border-b bg-muted/30">
              <div className="flex items-center gap-3">
                <Zap className="h-4 w-4 text-primary" />
                <div>
                  <p className="font-semibold">{sprint.name}</p>
                  {sprint.goal && (
                    <p className="text-xs text-muted-foreground">{sprint.goal}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[sprint.status]}`}
                >
                  {sprint.status}
                </span>
                {sprint.startDate && sprint.endDate && (
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {format(new Date(sprint.startDate), "MMM d")} –{" "}
                    {format(new Date(sprint.endDate), "MMM d, yyyy")}
                  </span>
                )}
                {sprint.status === "PLANNING" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => updateSprintStatus(sprint.id, "ACTIVE")}
                  >
                    Start Sprint
                  </Button>
                )}
                {sprint.status === "ACTIVE" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => updateSprintStatus(sprint.id, "COMPLETED")}
                  >
                    Complete
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {sprintTasks.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No tasks in this sprint — drag tasks from Backlog
                </p>
              ) : (
                <div className="divide-y">
                  {sprintTasks.map((task) => (
                    <button
                      key={task.id}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors"
                      onClick={() => onOpenTask(task)}
                    >
                      <span
                        className={`h-2 w-2 rounded-full flex-shrink-0 ${
                          task.status === "COMPLETED"
                            ? "bg-green-500"
                            : task.status === "IN_PROGRESS"
                            ? "bg-blue-500"
                            : "bg-muted-foreground/40"
                        }`}
                      />
                      <span className="flex-1 text-sm truncate">{task.title}</span>
                      <Badge variant="outline" className="text-xs capitalize hidden sm:flex">
                        {task.priority.toLowerCase()}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
              <div className="px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground flex justify-between">
                <span>{sprintTasks.length} tasks</span>
                <span>{done}/{sprintTasks.length} done</span>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Backlog */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 py-3 px-4 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Backlog</span>
            <Badge variant="secondary">{backlogTasks.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {backlogTasks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              All tasks are assigned to sprints
            </p>
          ) : (
            <div className="divide-y">
              {backlogTasks.map((task) => (
                <button
                  key={task.id}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => onOpenTask(task)}
                >
                  <span className="h-2 w-2 rounded-full flex-shrink-0 bg-muted-foreground/40" />
                  <span className="flex-1 text-sm truncate">{task.title}</span>
                  <Badge variant="outline" className="text-xs capitalize hidden sm:flex">
                    {task.priority.toLowerCase()}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Sprint Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Sprint</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Sprint name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Sprint 1"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sprint goal</Label>
              <Textarea
                value={form.goal}
                onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
                placeholder="What do we aim to achieve?"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End date</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="brand" onClick={createSprint} disabled={saving}>
              {saving && <Loader2 className="animate-spin h-4 w-4" />}
              Create Sprint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
