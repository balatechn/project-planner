"use client";

import * as React from "react";
import {
  addDays,
  differenceInCalendarDays,
  eachWeekOfInterval,
  format,
  max as maxDate,
  min as minDate,
} from "date-fns";
import type { TaskListItem } from "@/types/app";
import { TASK_STATUS_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const DAY_WIDTH = 26;

export function GanttView({
  tasks,
  onOpenTask,
}: {
  tasks: TaskListItem[];
  onOpenTask: (task: TaskListItem) => void;
}) {
  const scheduled = tasks.filter((t) => t.startDate || t.dueDate);

  const { start, end, totalDays } = React.useMemo(() => {
    const today = new Date();
    if (scheduled.length === 0) {
      return { start: today, end: addDays(today, 30), totalDays: 30 };
    }
    const dates: Date[] = [];
    for (const t of scheduled) {
      if (t.startDate) dates.push(new Date(t.startDate));
      if (t.dueDate) dates.push(new Date(t.dueDate));
    }
    const s = addDays(minDate(dates), -3);
    const e = addDays(maxDate(dates), 3);
    return { start: s, end: e, totalDays: differenceInCalendarDays(e, s) + 1 };
  }, [scheduled]);

  const weeks = eachWeekOfInterval({ start, end });

  if (scheduled.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Add start and due dates to tasks to see them on the timeline.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border thin-scroll">
      <div style={{ width: Math.max(totalDays * DAY_WIDTH + 240, 600) }}>
        {/* Header */}
        <div className="flex border-b bg-muted/40">
          <div className="w-60 shrink-0 border-r px-3 py-2 text-xs font-semibold">
            Task
          </div>
          <div className="relative flex-1">
            <div className="flex">
              {weeks.map((w) => (
                <div
                  key={w.toISOString()}
                  className="border-r px-2 py-2 text-xs text-muted-foreground"
                  style={{ width: DAY_WIDTH * 7 }}
                >
                  {format(w, "MMM d")}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rows */}
        {scheduled.map((task) => {
          const s = task.startDate
            ? new Date(task.startDate)
            : new Date(task.dueDate!);
          const e = task.dueDate
            ? new Date(task.dueDate)
            : addDays(new Date(task.startDate!), 1);
          const offset = Math.max(0, differenceInCalendarDays(s, start));
          const span = Math.max(1, differenceInCalendarDays(e, s) + 1);
          return (
            <div key={task.id} className="flex items-center border-b last:border-0">
              <button
                onClick={() => onOpenTask(task)}
                className="w-60 shrink-0 truncate border-r px-3 py-2.5 text-left text-sm hover:text-primary"
              >
                {task.title}
              </button>
              <div className="relative flex-1 py-2.5">
                <div
                  onClick={() => onOpenTask(task)}
                  className={cn(
                    "absolute top-1/2 h-5 -translate-y-1/2 cursor-pointer rounded-full text-[10px] font-medium leading-5 text-white",
                  )}
                  style={{
                    left: offset * DAY_WIDTH,
                    width: span * DAY_WIDTH,
                    backgroundColor: `hsl(${TASK_STATUS_COLORS[task.status]})`,
                  }}
                  title={`${task.title} · ${span} day(s)`}
                >
                  <span className="px-2">{task.progress}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
