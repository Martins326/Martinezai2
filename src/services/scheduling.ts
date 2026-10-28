import type { ScheduledTask } from "../types";

export function isScheduledTaskDue(
  task: ScheduledTask,
  now = Date.now(),
): boolean {
  return (
    task.enabled &&
    task.dueAt <= now &&
    task.lastNotifiedAt !== task.dueAt
  );
}

export function advanceScheduledTask(
  task: ScheduledTask,
  now = Date.now(),
): ScheduledTask {
  // A one-time reminder should not fire again.
  if (task.repeat === "none") {
    return {
      ...task,
      enabled: false,
      lastNotifiedAt: task.dueAt,
    };
  }

  const interval =
    task.repeat === "daily"
      ? 24 * 60 * 60 * 1000
      : 7 * 24 * 60 * 60 * 1000;

  let nextDue = task.dueAt + interval;

  // If the app was inactive, move to the next future occurrence
  // instead of generating multiple overdue notifications.
  while (nextDue <= now) {
    nextDue += interval;
  }

  return {
    ...task,
    dueAt: nextDue,
    lastNotifiedAt: task.dueAt,
  };
}