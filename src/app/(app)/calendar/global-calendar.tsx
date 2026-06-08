"use client";

import { useRouter } from "next/navigation";
import type { TaskListItem } from "@/types/app";
import { CalendarView } from "@/components/tasks/calendar-view";

export function GlobalCalendar({ tasks }: { tasks: TaskListItem[] }) {
  const router = useRouter();
  return (
    <CalendarView
      tasks={tasks}
      onOpenTask={(t) => router.push(`/projects/${t.projectId}?task=${t.id}`)}
    />
  );
}
