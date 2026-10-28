import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  Bell,
  CalendarClock,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

import type { ScheduledTask } from "../types";

interface ScheduledScreenProps {
  tasks: ScheduledTask[];
  isLight: boolean;
  onSave: (task: ScheduledTask) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}

function toLocalInputValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offset)
    .toISOString()
    .slice(0, 16);
}

export const ScheduledScreen: React.FC<ScheduledScreenProps> = ({
  tasks,
  isLight,
  onSave,
  onDelete,
  onBack,
}) => {
  const initialDue = useMemo(
    () =>
      toLocalInputValue(
        new Date(Date.now() + 60 * 60 * 1000),
      ),
    [],
  );

  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [dueAt, setDueAt] = useState(initialDue);
  const [notificationPermission, setNotificationPermission] = useState<
  NotificationPermission | "unsupported"
>(() =>
  typeof window !== "undefined" && "Notification" in window
    ? Notification.permission
    : "unsupported",
);

const [notificationMessage, setNotificationMessage] = useState("");

  const [repeat, setRepeat] =
    useState<ScheduledTask["repeat"]>("none");

  const panel = isLight
    ? "border-neutral-200 bg-white text-neutral-900"
    : "border-neutral-800 bg-neutral-900 text-neutral-100";

  const muted = isLight
    ? "text-neutral-500"
    : "text-neutral-400";

  const input = isLight
    ? "border-neutral-300 bg-white text-neutral-900"
    : "border-neutral-700 bg-neutral-950 text-neutral-100";

  const requestNotifications = async () => {
  if (!("Notification" in window)) {
    setNotificationPermission("unsupported");
    setNotificationMessage(
      "This browser does not support desktop notifications. Reminders will appear inside MartinezAI while it is open.",
    );
    return;
  }

  try {
    const permission = await Notification.requestPermission();

    setNotificationPermission(permission);
    setNotificationMessage(
      permission === "granted"
        ? "Desktop notifications are enabled. Reminders still require MartinezAI to be open."
        : permission === "denied"
          ? "Notifications are blocked by your browser. You can change this in the browser's site settings."
          : "Notification permission was not granted. In-app reminders remain available while MartinezAI is open.",
    );
  } catch {
    setNotificationMessage(
      "Could not request notification permission. In-app reminders remain available while MartinezAI is open.",
    );
  }
};

  const createTask = (event: React.FormEvent) => {
    event.preventDefault();

    const scheduledAt = new Date(dueAt).getTime();

    if (
      !title.trim() ||
      !prompt.trim() ||
      !Number.isFinite(scheduledAt) ||
      scheduledAt <= Date.now()
    ) {
      return;
    }

    const now = Date.now();

    onSave({
      id:
        `schedule_${now}_` +
        Math.random().toString(36).slice(2, 8),

      title: title.trim().slice(0, 100),
      prompt: prompt.trim().slice(0, 4000),
      dueAt: scheduledAt,
      repeat,
      enabled: true,
      createdAt: now,
    });

    setTitle("");
    setPrompt("");
    setRepeat("none");

    setDueAt(
      toLocalInputValue(
        new Date(Date.now() + 60 * 60 * 1000),
      ),
    );
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
       <header className="flex flex-wrap items-center justify-between gap-3">
  <div className="flex min-w-0 items-center gap-3">
    <button
      onClick={onBack}
      className={`rounded-xl border p-2 ${panel}`}
      aria-label="Back to chat"
    >
      <ArrowLeft size={18} />
    </button>

    <div>
      <h1 className="text-2xl font-bold">Scheduled</h1>

      <p className={`mt-1 text-sm ${muted}`}>
        Create reminders for prompts and tasks. Reminders are checked
        while MartinezAI is open.
      </p>
    </div>
  </div>

  <button
    type="button"
    onClick={() => void requestNotifications()}
    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition hover:opacity-80 ${panel}`}
  >
    {notificationPermission === "granted"
      ? "Notifications enabled"
      : notificationPermission === "denied"
        ? "Notifications blocked"
        : notificationPermission === "unsupported"
          ? "In-app reminders only"
          : "Enable notifications"}
  </button>
</header>

{notificationMessage && (
  <p
    role="status"
    className={`rounded-xl border px-3 py-2 text-xs leading-5 ${panel} ${muted}`}
  >
    {notificationMessage}
  </p>
)}

        <form
          onSubmit={createTask}
          className={`space-y-3 rounded-2xl border p-5 ${panel}`}
        >
          <h2 className="font-semibold">
            Create a scheduled reminder
          </h2>

          <input
            required
            maxLength={100}
            value={title}
            onChange={(event) =>
              setTitle(event.target.value)
            }
            placeholder="Reminder title"
            className={`w-full rounded-xl border px-3 py-3 text-sm ${input}`}
          />

          <textarea
            required
            maxLength={4000}
            rows={3}
            value={prompt}
            onChange={(event) =>
              setPrompt(event.target.value)
            }
            placeholder="What should MartinezAI remind you to do or ask?"
            className={`w-full resize-y rounded-xl border px-3 py-3 text-sm ${input}`}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className={`mb-1 block ${muted}`}>
                Date and time
              </span>

              <input
                type="datetime-local"
                required
                min={toLocalInputValue(
                  new Date(Date.now() + 60_000),
                )}
                value={dueAt}
                onChange={(event) =>
                  setDueAt(event.target.value)
                }
                className={`w-full rounded-xl border px-3 py-2.5 ${input}`}
              />
            </label>

            <label className="text-sm">
              <span className={`mb-1 block ${muted}`}>
                Repeat
              </span>

              <select
                value={repeat}
                onChange={(event) =>
                  setRepeat(
                    event.target.value as ScheduledTask["repeat"],
                  )
                }
                className={`w-full rounded-xl border px-3 py-2.5 ${input}`}
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
          </div>

          <button
            type="submit"
            disabled={
              !title.trim() ||
              !prompt.trim() ||
              new Date(dueAt).getTime() <= Date.now()
            }
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Add reminder
          </button>
        </form>

        <section className="space-y-3">
          <h2 className="font-semibold">
            Your reminders ({tasks.length})
          </h2>

          {tasks.length === 0 ? (
            <div
              className={`rounded-2xl border border-dashed p-8 text-center ${panel}`}
            >
              <CalendarClock
                className="mx-auto mb-3 text-indigo-400"
                size={30}
              />

              <p className="font-medium">
                Nothing scheduled yet
              </p>

              <p className={`mt-1 text-sm ${muted}`}>
                Create a reminder above.
              </p>
            </div>
          ) : (
            tasks.map((task) => (
              <article
                key={task.id}
                className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-start ${panel}`}
              >
                <Bell
                  className="mt-1 shrink-0 text-indigo-400"
                  size={20}
                />

                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">
                    {task.title}
                  </h3>

                  <p
                    className={`mt-1 whitespace-pre-wrap text-sm ${muted}`}
                  >
                    {task.prompt}
                  </p>

                  <p className="mt-2 text-xs text-indigo-400">
                    {new Date(task.dueAt).toLocaleString()}
                    {" · "}
                    {task.repeat === "none"
                      ? "Once"
                      : `Repeats ${task.repeat}`}
                    {!task.enabled ? " · Paused" : ""}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onSave({
                        ...task,
                        enabled: !task.enabled,
                      })
                    }
                    className={`rounded-lg border p-2 ${
                      isLight
                        ? "border-neutral-200"
                        : "border-neutral-700"
                    }`}
                    aria-label={
                      task.enabled
                        ? "Pause reminder"
                        : "Enable reminder"
                    }
                    title={
                      task.enabled
                        ? "Pause reminder"
                        : "Enable reminder"
                    }
                  >
                    {task.enabled ? (
                      <ToggleRight size={19} />
                    ) : (
                      <ToggleLeft size={19} />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onDelete(task.id)}
                    className="rounded-lg border border-red-500/20 p-2 text-red-400"
                    aria-label="Delete reminder"
                    title="Delete reminder"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </div>
  );
};