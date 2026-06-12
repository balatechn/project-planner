"use client";

import { useRouter } from "next/navigation";
import type { TaskListItem } from "@/types/app";
import { CalendarView } from "@/components/tasks/calendar-view";

export function GlobalCalendar({
  tasks,
  holidays = [],
}: {
  tasks: TaskListItem[];
  holidays?: { date: string; name: string }[];
}) {
  const router = useRouter();
  return (
    <CalendarView
      tasks={tasks}
      holidays={holidays}
      onOpenTask={(t) => router.push(`/projects/${t.projectId}?task=${t.id}`)}
    />
  );
}
