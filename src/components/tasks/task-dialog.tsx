"use client";

import * as React from "react";
import { format } from "date-fns";
import { CheckCircle2, CheckSquare, Circle, Clock, ListTree, Loader2, Paperclip, Plus, Send, Square, Trash2 } from "lucide-react";
import type { Priority, TaskStatus } from "@prisma/client";
import type { Person, TaskListItem, WorkspacePermissions } from "@/types/app";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { initials, cn } from "@/lib/utils";
import {
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
} from "@/lib/constants";

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author: Person;
};
type Attachment = {
  id: string;
  fileName: string;
  url: string;
  size: number;
};
type ChecklistItem = {
  id: string;
  title: string;
  isCompleted: boolean;
  orderIndex: number;
};
type TimeLogEntry = {
  id: string;
  hours: number;
  logDate: string;
  description: string | null;
  user: Person;
};
type SubTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: string;
  assignees: { user: Person }[];
};

const SUBTASK_STATUS_COLORS: Partial<Record<TaskStatus, string>> = {
  NOT_STARTED: "bg-zinc-500/10 text-zinc-500",
  IN_PROGRESS: "bg-blue-500/10 text-blue-600",
  COMPLETED:   "bg-green-500/10 text-green-600",
  ON_HOLD:     "bg-amber-500/10 text-amber-600",
  DELAYED:     "bg-red-500/10 text-red-500",
};

export function TaskDialog({
  open,
  onClose,
  task,
  defaultStatus,
  projectId,
  users,
  siblingTasks,
  permissions,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  task: TaskListItem | null;
  defaultStatus: TaskStatus;
  projectId: string;
  users: Person[];
  siblingTasks: TaskListItem[];
  permissions: WorkspacePermissions;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!task;
  const [saving, setSaving] = React.useState(false);
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [checklist, setChecklist] = React.useState<ChecklistItem[]>([]);
  const [timeLogs, setTimeLogs] = React.useState<TimeLogEntry[]>([]);
  const [subtasks, setSubtasks] = React.useState<SubTask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = React.useState("");
  const [subtaskSaving, setSubtaskSaving] = React.useState(false);
  const [newComment, setNewComment] = React.useState("");
  const [newCheckItem, setNewCheckItem] = React.useState("");
  const [logHours, setLogHours] = React.useState("");
  const [logDesc, setLogDesc] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  const [form, setForm] = React.useState(() => initialForm(task, defaultStatus));
  const [assignees, setAssignees] = React.useState<string[]>(
    task?.assignees.map((a) => a.user.id) ?? [],
  );

  React.useEffect(() => {
    setForm(initialForm(task, defaultStatus));
    setAssignees(task?.assignees.map((a) => a.user.id) ?? []);
    setSubtasks([]);
    setNewSubtaskTitle("");
    if (task) {
      fetch(`/api/tasks/${task.id}`)
        .then((r) => r.json())
        .then((d) => {
          setComments(d.task?.comments ?? []);
          setAttachments(d.task?.attachments ?? []);
          setChecklist(d.task?.checklistItems ?? []);
          setTimeLogs(d.task?.timeLogs ?? []);
        })
        .catch(() => undefined);
      // Fetch subtasks separately
      fetch(`/api/tasks?projectId=${projectId}&parentId=${task.id}`)
        .then((r) => r.json())
        .then((d) => setSubtasks(d.tasks ?? []))
        .catch(() => undefined);
    } else {
      setComments([]);
      setAttachments([]);
      setChecklist([]);
      setTimeLogs([]);
    }
  }, [task, defaultStatus, projectId]);

  const readOnly = isEdit ? !permissions.canEditTask : !permissions.canCreateTask;

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    if (form.title.trim().length < 2) {
      toast({ title: "Task title is too short", variant: "error" });
      return;
    }
    setSaving(true);
    const payload = {
      projectId,
      title: form.title,
      description: form.description || null,
      status: form.status,
      priority: form.priority,
      progress: Number(form.progress),
      estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : null,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
      assigneeIds: assignees,
      isMilestone: form.isMilestone,
      wbsNumber: form.wbsNumber || null,
    };
    try {
      const res = await fetch(
        isEdit ? `/api/tasks/${task!.id}` : "/api/tasks",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "Save failed");
      }
      toast({
        title: isEdit ? "Task updated" : "Task created",
        variant: "success",
      });
      onSaved();
      onClose();
    } catch (e) {
      toast({
        title: "Could not save task",
        description: e instanceof Error ? e.message : undefined,
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!task) return;
    if (!confirm("Delete this task? This cannot be undone.")) return;
    const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Task deleted", variant: "success" });
      onSaved();
      onClose();
    } else {
      toast({ title: "Delete failed", variant: "error" });
    }
  }

  async function addComment() {
    if (!task || !newComment.trim()) return;
    const res = await fetch(`/api/tasks/${task.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newComment }),
    });
    if (res.ok) {
      const { comment } = await res.json();
      setComments((c) => [...c, comment]);
      setNewComment("");
    }
  }

  async function addChecklistItem() {
    if (!task || !newCheckItem.trim()) return;
    const res = await fetch(`/api/tasks/${task.id}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newCheckItem }),
    });
    if (res.ok) {
      const { item } = await res.json();
      setChecklist((c) => [...c, item]);
      setNewCheckItem("");
    }
  }

  async function createSubtask() {
    if (!task || !newSubtaskTitle.trim()) return;
    setSubtaskSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          parentId: task.id,
          title: newSubtaskTitle.trim(),
          status: "NOT_STARTED",
          priority: "MEDIUM",
          progress: 0,
        }),
      });
      if (res.ok) {
        const { task: created } = await res.json();
        setSubtasks((s) => [...s, created]);
        setNewSubtaskTitle("");
        toast({ title: "Subtask added", variant: "success" });
        onSaved();
      }
    } catch {
      toast({ title: "Could not add subtask", variant: "error" });
    } finally {
      setSubtaskSaving(false);
    }
  }

  async function toggleSubtask(subtaskId: string, done: boolean) {
    const newStatus: TaskStatus = done ? "COMPLETED" : "NOT_STARTED";
    await fetch(`/api/tasks/${subtaskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setSubtasks((s) =>
      s.map((t) => (t.id === subtaskId ? { ...t, status: newStatus } : t)),
    );
    onSaved();
  }

  async function toggleChecklistItem(itemId: string, done: boolean) {
    if (!task) return;
    await fetch(`/api/tasks/${task.id}/checklist/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCompleted: done }),
    });
    setChecklist((c) =>
      c.map((item) => (item.id === itemId ? { ...item, isCompleted: done } : item)),
    );
  }

  async function logTime() {
    if (!task || !logHours) return;
    const res = await fetch(`/api/tasks/${task.id}/time-logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours: Number(logHours), description: logDesc || null }),
    });
    if (res.ok) {
      const { log } = await res.json();
      setTimeLogs((t) => [log, ...t]);
      setLogHours("");
      setLogDesc("");
      toast({ title: "Time logged", variant: "success" });
    }
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !task) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/tasks/${task.id}/attachments`, {
      method: "POST",
      body: fd,
    });
    if (res.ok) {
      const { attachment } = await res.json();
      setAttachments((a) => [...a, attachment]);
      toast({ title: "File uploaded", variant: "success" });
    } else {
      toast({ title: "Upload failed", variant: "error" });
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Task details" : "New task"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
          {/* Main column */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={form.title}
                disabled={readOnly}
                onChange={(e) => set("title", e.target.value)}
                placeholder="What needs to be done?"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                disabled={readOnly}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Add more detail…"
                className="min-h-24"
              />
            </div>

            {/* ── Subtasks ──────────────────────────────────────── */}
            {isEdit && (
              <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <ListTree className="h-3.5 w-3.5 text-muted-foreground" />
                    Subtasks
                    {subtasks.length > 0 && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        {subtasks.filter((s) => s.status === "COMPLETED").length}/
                        {subtasks.length} done
                      </span>
                    )}
                  </span>
                  {subtasks.length > 0 && (
                    <span className="text-xs font-medium text-muted-foreground">
                      {Math.round(
                        (subtasks.filter((s) => s.status === "COMPLETED").length /
                          subtasks.length) *
                          100,
                      )}
                      %
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                {subtasks.length > 0 && (
                  <div className="h-1 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-green-500 transition-all"
                      style={{
                        width: `${Math.round(
                          (subtasks.filter((s) => s.status === "COMPLETED").length /
                            subtasks.length) *
                            100,
                        )}%`,
                      }}
                    />
                  </div>
                )}

                {/* Subtask rows */}
                <div className="space-y-0.5">
                  {subtasks.length === 0 && (
                    <p className="text-xs text-muted-foreground py-1">
                      No subtasks yet — add one below.
                    </p>
                  )}
                  {subtasks.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-muted/60 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => toggleSubtask(sub.id, sub.status !== "COMPLETED")}
                        className={cn(
                          "flex-shrink-0 transition-colors",
                          sub.status === "COMPLETED"
                            ? "text-green-500"
                            : "text-muted-foreground hover:text-primary",
                        )}
                      >
                        {sub.status === "COMPLETED" ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Circle className="h-4 w-4" />
                        )}
                      </button>
                      <span
                        className={cn(
                          "flex-1 text-sm truncate",
                          sub.status === "COMPLETED" &&
                            "line-through text-muted-foreground",
                        )}
                      >
                        {sub.title}
                      </span>
                      <span
                        className={cn(
                          "flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                          SUBTASK_STATUS_COLORS[sub.status] ??
                            "bg-zinc-500/10 text-zinc-500",
                        )}
                      >
                        {TASK_STATUS_LABELS[sub.status]}
                      </span>
                      {sub.assignees[0] && (
                        <Avatar className="h-5 w-5 flex-shrink-0">
                          {sub.assignees[0].user.image && (
                            <AvatarImage src={sub.assignees[0].user.image} alt="" />
                          )}
                          <AvatarFallback className="text-[9px]">
                            {initials(sub.assignees[0].user.name)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add subtask input */}
                {!readOnly && (
                  <div className="flex gap-2">
                    <Input
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && createSubtask()}
                      placeholder="Add subtask…"
                      className="h-8 text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={createSubtask}
                      disabled={subtaskSaving || !newSubtaskTitle.trim()}
                    >
                      {subtaskSaving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Checklist */}
            {isEdit && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <CheckSquare className="h-3.5 w-3.5" />
                  Checklist
                  {checklist.length > 0 && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {checklist.filter((c) => c.isCompleted).length}/{checklist.length}
                    </span>
                  )}
                </Label>
                <div className="space-y-1">
                  {checklist.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 text-sm cursor-pointer rounded px-1 hover:bg-muted/50">
                      <button
                        type="button"
                        onClick={() => toggleChecklistItem(item.id, !item.isCompleted)}
                        className="text-primary"
                      >
                        {item.isCompleted ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                      <span className={item.isCompleted ? "line-through text-muted-foreground" : ""}>
                        {item.title}
                      </span>
                    </label>
                  ))}
                </div>
                {!readOnly && (
                  <div className="flex gap-2">
                    <Input
                      value={newCheckItem}
                      onChange={(e) => setNewCheckItem(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addChecklistItem()}
                      placeholder="Add checklist item…"
                      className="h-8 text-sm"
                    />
                    <Button size="sm" variant="outline" className="h-8" onClick={addChecklistItem}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Time Logging */}
            {isEdit && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Time Log
                  {timeLogs.length > 0 && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {timeLogs.reduce((s, l) => s + l.hours, 0).toFixed(1)}h total
                    </span>
                  )}
                </Label>
                <div className="max-h-28 space-y-1 overflow-y-auto thin-scroll">
                  {timeLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between text-xs rounded bg-muted/50 px-2 py-1">
                      <span className="text-muted-foreground">
                        {format(new Date(log.logDate), "MMM d")} · {log.user.name}
                      </span>
                      <span className="font-medium">{log.hours}h</span>
                      {log.description && (
                        <span className="text-muted-foreground truncate max-w-[120px] ml-2">{log.description}</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0.25}
                    step={0.25}
                    value={logHours}
                    onChange={(e) => setLogHours(e.target.value)}
                    placeholder="hrs"
                    className="h-8 w-20 text-sm"
                  />
                  <Input
                    value={logDesc}
                    onChange={(e) => setLogDesc(e.target.value)}
                    placeholder="What did you work on?"
                    className="h-8 text-sm flex-1"
                  />
                  <Button size="sm" variant="outline" className="h-8" onClick={logTime} disabled={!logHours}>
                    Log
                  </Button>
                </div>
              </div>
            )}

            {/* Comments */}
            {isEdit && (
              <div className="space-y-3">
                <Label>Comments</Label>
                <div className="max-h-48 space-y-3 overflow-y-auto thin-scroll">
                  {comments.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No comments yet.
                    </p>
                  )}
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-2.5">
                      <Avatar className="h-7 w-7">
                        {c.author.image && (
                          <AvatarImage src={c.author.image} alt="" />
                        )}
                        <AvatarFallback className="text-[10px]">
                          {initials(c.author.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="rounded-lg bg-muted px-3 py-2">
                        <p className="text-xs font-medium">
                          {c.author.name}{" "}
                          <span className="font-normal text-muted-foreground">
                            · {format(new Date(c.createdAt), "MMM d, HH:mm")}
                          </span>
                        </p>
                        <p className="text-sm">{c.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {permissions.canComment && (
                  <div className="flex gap-2">
                    <Input
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addComment()}
                      placeholder="Write a comment…"
                    />
                    <Button size="icon" onClick={addComment}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => set("status", v as TaskStatus)}
                disabled={readOnly && !permissions.canUpdateStatus}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {TASK_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => set("priority", v as Priority)}
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Start</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  disabled={readOnly}
                  onChange={(e) => set("startDate", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Due</Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  disabled={readOnly}
                  onChange={(e) => set("dueDate", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Progress %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.progress}
                  disabled={readOnly && !permissions.canUpdateStatus}
                  onChange={(e) => set("progress", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Est. hrs</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.estimatedHours}
                  disabled={readOnly}
                  onChange={(e) => set("estimatedHours", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wbs">WBS Number</Label>
              <Input
                id="wbs"
                value={form.wbsNumber}
                disabled={readOnly}
                onChange={(e) => set("wbsNumber", e.target.value)}
                placeholder="1.2.3"
                className="h-8 text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="task-milestone"
                checked={form.isMilestone}
                disabled={readOnly}
                onChange={(e) => set("isMilestone", e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="task-milestone" className="text-sm font-medium cursor-pointer">
                Milestone
              </label>
            </div>

            <div className="space-y-1.5">
              <Label>Assignees</Label>
              <div className="flex flex-wrap gap-1.5">
                {users.map((u) => {
                  const active = assignees.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      disabled={readOnly}
                      onClick={() =>
                        setAssignees((a) =>
                          active ? a.filter((x) => x !== u.id) : [...a, u.id],
                        )
                      }
                      className={cn(
                        "flex items-center gap-1 rounded-full border py-0.5 pl-0.5 pr-2 text-xs transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "hover:bg-muted",
                      )}
                      title={u.name ?? ""}
                    >
                      <Avatar className="h-5 w-5">
                        {u.image && <AvatarImage src={u.image} alt="" />}
                        <AvatarFallback className="text-[9px]">
                          {initials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      {u.name?.split(" ")[0] ?? "User"}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Attachments */}
            {isEdit && (
              <div className="space-y-1.5">
                <Label>Attachments</Label>
                <div className="space-y-1">
                  {attachments.map((a) => (
                    <a
                      key={a.id}
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 truncate rounded border px-2 py-1 text-xs hover:bg-muted"
                    >
                      <Paperclip className="h-3 w-3 shrink-0" />
                      <span className="truncate">{a.fileName}</span>
                    </a>
                  ))}
                </div>
                {permissions.canComment && (
                  <>
                    <input
                      ref={fileRef}
                      type="file"
                      className="hidden"
                      onChange={uploadFile}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => fileRef.current?.click()}
                    >
                      <Paperclip className="h-3.5 w-3.5" /> Attach file
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between border-t pt-4">
          <div>
            {isEdit && permissions.canEditTask && (
              <Button variant="ghost" size="sm" onClick={remove}>
                <Trash2 className="h-4 w-4 text-destructive" /> Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {!readOnly && (
              <Button variant="brand" onClick={save} disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                {isEdit ? "Save changes" : "Create task"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function initialForm(task: TaskListItem | null, defaultStatus: TaskStatus) {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: task?.status ?? defaultStatus,
    priority: task?.priority ?? ("MEDIUM" as Priority),
    startDate: task?.startDate ? task.startDate.slice(0, 10) : "",
    dueDate: task?.dueDate ? task.dueDate.slice(0, 10) : "",
    progress: String(task?.progress ?? 0),
    estimatedHours: task?.estimatedHours ? String(task.estimatedHours) : "",
    isMilestone: task?.isMilestone ?? false,
    wbsNumber: task?.wbsNumber ?? "",
  };
}
