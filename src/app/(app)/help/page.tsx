import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  FolderKanban,
  GanttChartSquare,
  GraduationCap,
  Keyboard,
  LayoutDashboard,
  LogIn,
  Search,
  Users,
  Video,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Help & Guide" };

const FLOW_STEPS = [
  {
    icon: LogIn,
    title: "1 · Sign in",
    body: "Use your Microsoft 365 account (single sign-on). Your account is created automatically on first login as a Team Member.",
  },
  {
    icon: FolderKanban,
    title: "2 · Create a project",
    body: "Go to Projects → New Project. Give it a name, entity/department, timeline and a project manager. Add team members so they can see it.",
  },
  {
    icon: CheckSquare,
    title: "3 · Add tasks",
    body: "Open the project and click Add Task. Set priority, dates, progress and assignees — assignees get an email notification instantly.",
  },
  {
    icon: GanttChartSquare,
    title: "4 · Track the work",
    body: "Switch between Kanban board (drag cards across columns), List, Gantt timeline and Calendar views. Subtasks, checklists, comments, attachments and time logs live inside each task.",
  },
  {
    icon: Video,
    title: "5 · Book meeting rooms",
    body: "Rooms page → pick Small (6 pax) or Big (10 pax) room, choose a slot on the timeline or month view. Invite external guests by email — they receive a calendar invite with a Teams link.",
  },
  {
    icon: BarChart3,
    title: "6 · Review & report",
    body: "Dashboard shows your live stats and completion trend. Reports give project and workload breakdowns with Excel export (Admin / PM).",
  },
];

const MODULES = [
  { icon: LayoutDashboard, name: "Dashboard", desc: "Personal overview: stats, trend, recent projects, your tasks", href: "/dashboard" },
  { icon: FolderKanban, name: "Projects", desc: "All projects with health, progress and timeline", href: "/projects" },
  { icon: GanttChartSquare, name: "Portfolio", desc: "Cross-project Gantt timeline", href: "/portfolio" },
  { icon: CheckSquare, name: "My Tasks", desc: "Everything assigned to you, grouped by status", href: "/my-tasks" },
  { icon: GraduationCap, name: "Training", desc: "Training sessions and learning material", href: "/training" },
  { icon: Video, name: "Meeting Rooms", desc: "Book the Small or Big meeting room, invite guests", href: "/meeting-rooms" },
  { icon: CalendarDays, name: "Calendar", desc: "Company-wide calendar of tasks and milestones", href: "/calendar" },
  { icon: Users, name: "Team Directory", desc: "Browse colleagues and their workload", href: "/team" },
];

const ROLE_ROWS = [
  ["Create / edit projects", "✅", "✅", "✅", "—"],
  ["Archive project", "✅", "✅", "—", "—"],
  ["Delete project", "✅", "—", "—", "—"],
  ["Create / edit / assign tasks", "✅", "✅", "✅", "—"],
  ["Delete task", "Any", "Own", "Own", "—"],
  ["Comment & attach files", "✅", "✅", "✅", "—"],
  ["View reports", "✅", "✅", "✅", "✅"],
  ["Export reports", "✅", "✅", "—", "—"],
  ["Manage users, audit, announcements", "✅", "—", "—", "—"],
];

const SHORTCUTS = [
  ["Ctrl K", "Command palette — search & jump anywhere"],
  ["g d", "Go to Dashboard"],
  ["g p", "Go to Projects"],
  ["g t", "Go to My Tasks"],
  ["g c", "Go to Calendar"],
  ["g r", "Go to Meeting Rooms"],
  ["?", "Show keyboard shortcuts"],
];

const FAQS = [
  {
    q: "I was assigned a task but can't find the project?",
    a: "Having an assigned task automatically gives you access — check Projects or My Tasks. If it still doesn't appear, ask the project manager to add you as a member.",
  },
  {
    q: "Who receives email notifications?",
    a: "Assignees get an email when a task is assigned to them. The admin is emailed when a new project is created. Meeting-room guests receive calendar invites. All emails come from nationalmr@nationalgroupindia.com.",
  },
  {
    q: "Why can't I delete a task?",
    a: "Only the person who created the task (or an Admin) can delete it. You can still mark it Completed or reassign it.",
  },
  {
    q: "How does project health work?",
    a: "🟢 On track = no overdue tasks. 🟡 At risk = under a quarter of open tasks are overdue. 🔴 Off track = a quarter or more are overdue.",
  },
  {
    q: "How do I book a meeting room with external guests?",
    a: "Rooms → New booking → add guest emails (comma separated). Each guest receives an email with a calendar invite (.ics) including the Teams link.",
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Help & Guide"
        description="How Sharepoint works — from first sign-in to reports."
      />

      {/* ── How it flows ── */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold tracking-tight">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FLOW_STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.title} className="relative overflow-hidden">
                <CardContent className="pt-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ── Modules ── */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold tracking-tight">Modules</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.name}
                href={m.href}
                className="flex items-start gap-3 rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Roles ── */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold tracking-tight">Roles & permissions</h2>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Right</th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Admin</th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Project Manager</th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Team Member</th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Viewer</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ROLE_ROWS.map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell, i) => (
                      <td
                        key={i}
                        className={
                          i === 0
                            ? "px-4 py-2.5"
                            : "px-4 py-2.5 text-center text-muted-foreground"
                        }
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <p className="text-xs text-muted-foreground">
          Team Members and Viewers see only projects they own, belong to, or have an assigned task in.
          Admins and Project Managers see everything.
        </p>
      </section>

      {/* ── Shortcuts ── */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <Keyboard className="h-5 w-5 text-primary" /> Keyboard shortcuts
        </h2>
        <Card>
          <CardContent className="grid gap-2 pt-5 sm:grid-cols-2">
            {SHORTCUTS.map(([keys, action]) => (
              <div key={keys} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                <span className="text-sm text-muted-foreground">{action}</span>
                <kbd className="rounded border bg-card px-2 py-0.5 text-[11px] font-medium">{keys}</kbd>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* ── FAQ ── */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <Search className="h-5 w-5 text-primary" /> Frequently asked
        </h2>
        <div className="space-y-3">
          {FAQS.map((f) => (
            <Card key={f.q}>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm">{f.q}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{f.a}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
