import React, { useEffect, useMemo, useState } from "react";

import {
  ArrowLeft,
  ArrowRight,
  Bot,
  BrainCircuit,
  CheckCircle2,
  CircleHelp,
  FlaskConical,
  Globe2,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  UsersRound,
  WandSparkles,
  Trash2,
} from "lucide-react";

type StudioMode = "think" | "lab" | "agents" | "world";

type Scenario = {
  name: string;
  outcome: string;
  likelihood: string;
  drivers: string[];
};

type Agent = {
  name: string;
  role: string;
  finding: string;
};

type SimulationResult = {
  title: string;
  summary: string;
  assumptions: string[];
  scenarios: Scenario[];
  agents: Agent[];
  nextSteps: string[];
  limitations: string[];
};

const MODES: {
  id: StudioMode;
  title: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    id: "think",
    title: "AI Think",
    description: "Compare approaches to a complex problem.",
    icon: BrainCircuit,
  },
  {
    id: "lab",
    title: "Simulation Lab",
    description: "Explore what-if scenarios and outcomes.",
    icon: FlaskConical,
  },
  {
    id: "agents",
    title: "Agent Arena",
    description: "Review a problem from specialist perspectives.",
    icon: UsersRound,
  },
  {
    id: "world",
    title: "World Builder",
    description: "Create an evolving fictional or educational world.",
    icon: Globe2,
  },
];

const PRESETS = [
  {
    title: "Launch a startup",
    prompt:
      "Simulate a small technology startup launching an AI product over its first 12 months. Compare optimistic, baseline, and pessimistic outcomes, including costs, adoption, competition, and key risks.",
  },
  {
    title: "Plan a study strategy",
    prompt:
      "Compare three realistic study strategies for learning a difficult subject over eight weeks. State assumptions, weekly milestones, likely obstacles, and ways to measure progress.",
  },
  {
    title: "Design a future city",
    prompt:
      "Build a plausible fictional city 25 years in the future. Simulate how transport, energy, housing, work, and public services interact, including trade-offs and unexpected events.",
  },
  {
    title: "Test a product idea",
    prompt:
      "Evaluate a new mobile app idea from customer, engineering, accessibility, and business perspectives. Identify assumptions, testable risks, and low-cost experiments.",
  },
];

function cleanList(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .slice(0, 10)
    : [];
}

function normalizeResult(raw: unknown): SimulationResult {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;

  const scenarios = Array.isArray(data.scenarios)
    ? data.scenarios.slice(0, 5).map((item, index) => {
        const row = (item && typeof item === "object" ? item : {}) as Record<
          string,
          unknown
        >;

        return {
          name:
            typeof row.name === "string" ? row.name : `Scenario ${index + 1}`,
          outcome:
            typeof row.outcome === "string"
              ? row.outcome
              : "No outcome provided.",
          likelihood:
            typeof row.likelihood === "string"
              ? row.likelihood
              : "Not estimated",
          drivers: cleanList(row.drivers),
        };
      })
    : [];

  const agents = Array.isArray(data.agents)
    ? data.agents.slice(0, 8).map((item, index) => {
        const row = (item && typeof item === "object" ? item : {}) as Record<
          string,
          unknown
        >;

        return {
          name: typeof row.name === "string" ? row.name : `Agent ${index + 1}`,
          role: typeof row.role === "string" ? row.role : "Reviewer",
          finding:
            typeof row.finding === "string"
              ? row.finding
              : "No finding provided.",
        };
      })
    : [];

  return {
    title: typeof data.title === "string" ? data.title : "Simulation results",
    summary:
      typeof data.summary === "string"
        ? data.summary
        : "The simulation completed without a summary.",
    assumptions: cleanList(data.assumptions),
    scenarios,
    agents,
    nextSteps: cleanList(data.nextSteps),
    limitations: cleanList(data.limitations),
  };
}

type CustomAgentDraft = {
  name: string;
  role: string;
  focus: string;
};

type SimulationHistoryItem = {
  id: string;
  title: string;
  mode: StudioMode;
  prompt: string;
  result: SimulationResult;
  createdAt: number;
};

function isStudioMode(value: unknown): value is StudioMode {
  return (
    value === "think" ||
    value === "lab" ||
    value === "agents" ||
    value === "world"
  );
}

function normalizeHistoryItem(value: unknown): SimulationHistoryItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Record<string, unknown>;

  if (
    typeof item.id !== "string" ||
    typeof item.title !== "string" ||
    typeof item.prompt !== "string" ||
    !isStudioMode(item.mode) ||
    typeof item.createdAt !== "number" ||
    !item.result ||
    typeof item.result !== "object"
  ) {
    return null;
  }

  return {
    id: item.id,
    title: item.title,
    mode: item.mode,
    prompt: item.prompt,
    result: normalizeResult(item.result),
    createdAt: item.createdAt,
  };
}

interface SimulationStudioProps {
  isLight: boolean;
  onBack: () => void;
}

export const SimulationStudio: React.FC<SimulationStudioProps> = ({
  isLight,
  onBack,
}) => {
  const [mode, setMode] = useState<StudioMode>("lab");
  const [prompt, setPrompt] = useState("");
  const [detail, setDetail] = useState<"concise" | "balanced" | "detailed">(
    "balanced",
  );

  const [customAgents, setCustomAgents] = useState<CustomAgentDraft[]>([
    {
      name: "",
      role: "",
      focus: "",
    },
  ]);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  const [history, setHistory] = useState<SimulationHistoryItem[]>([]);

  const [historyNotice, setHistoryNotice] = useState("");

  const [historyLoading, setHistoryLoading] = useState(true);

  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      try {
        const response = await fetch("/api/simulation/history", {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            typeof payload?.error === "string"
              ? payload.error
              : "Could not load saved simulations.",
          );
        }

        const items = Array.isArray(payload?.items)
          ? payload.items
              .map(normalizeHistoryItem)
              .filter(
                (
                  item: SimulationHistoryItem | null,
                ): item is SimulationHistoryItem => item !== null,
              )
          : [];

        if (!cancelled) {
          setHistory(items.slice(0, 30));
          setHistoryNotice("");
        }
      } catch {
        if (!cancelled) {
          setHistoryNotice(
            "Saved history could not be loaded. You can still run a simulation in this session.",
          );
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  const panel = isLight
    ? "border-neutral-200 bg-white"
    : "border-neutral-800 bg-neutral-900/80";

  const muted = isLight ? "text-neutral-600" : "text-neutral-400";

  const field = isLight
    ? "border-neutral-300 bg-white text-neutral-900 placeholder:text-neutral-400"
    : "border-neutral-700 bg-neutral-950 text-neutral-100 placeholder:text-neutral-500";

  const modeLabel = useMemo(
    () => MODES.find((item) => item.id === mode)?.title ?? "Simulation Lab",
    [mode],
  );

  const runSimulation = async (advanceWorld = false) => {
    const request = prompt.trim();
    const previousState = advanceWorld ? result : null;

    if (!request || running) return;

    if (advanceWorld && (mode !== "world" || !previousState)) {
      return;
    }

    setRunning(true);
    setError("");
    setHistoryNotice("");
    setResult(null);
    setActiveHistoryId(null);

    try {
      const response = await fetch("/api/simulation/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          prompt: request,
          mode,
          detail,

          customAgents:
            mode === "agents"
              ? customAgents
                  .filter(
                    (agent) =>
                      agent.name.trim() &&
                      agent.role.trim() &&
                      agent.focus.trim(),
                  )
                  .slice(0, 2)
                  .map((agent) => ({
                    name: agent.name.trim(),
                    role: agent.role.trim(),
                    focus: agent.focus.trim(),
                  }))
              : [],

          action: advanceWorld ? "advance" : "run",

          ...(previousState ? { previousState } : {}),
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "The simulation could not run. Please try again.",
        );
      }

      const normalized = normalizeResult(payload?.result);

      if (!normalized.summary) {
        throw new Error(
          "The simulation returned an empty result. Please try again.",
        );
      }

      const entry: SimulationHistoryItem = {
        id: `sim_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,

        title: normalized.title,
        mode,
        prompt: request,
        result: normalized,
        createdAt: Date.now(),
      };

      // Show the result immediately.
      setResult(normalized);

      setHistory((previous) =>
        [entry, ...previous.filter((item) => item.id !== entry.id)].slice(
          0,
          30,
        ),
      );

      // Save it permanently on the authenticated backend.
      // A save failure must not discard the completed result.
      try {
        const saveResponse = await fetch("/api/simulation/history", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            item: entry,
          }),
        });

        const savePayload = await saveResponse.json().catch(() => null);

        if (!saveResponse.ok) {
          throw new Error(
            typeof savePayload?.error === "string"
              ? savePayload.error
              : "The simulation could not be saved.",
          );
        }
      } catch {
        setHistoryNotice(
          "Simulation completed, but permanent saving failed. This result will remain only in the current screen session.",
        );
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong while running the simulation.",
      );
    } finally {
      setRunning(false);
    }
  };

  const deleteSavedSimulation = async (id: string) => {
    try {
      const response = await fetch(
        `/api/simulation/history/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
          },
        },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "Could not delete the saved simulation.",
        );
      }

      setHistory((previous) => previous.filter((item) => item.id !== id));

      if (activeHistoryId === id) {
        setActiveHistoryId(null);
      }

      setHistoryNotice("");
    } catch (e) {
      setHistoryNotice(
        e instanceof Error
          ? e.message
          : "Could not delete the saved simulation.",
      );
    }
  };

  return (
    <section
      className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${
        isLight
          ? "bg-neutral-50 text-neutral-900"
          : "bg-neutral-950 text-neutral-100"
      }`}
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-7 md:py-7">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition hover:opacity-80 ${panel}`}
          >
            <ArrowLeft size={16} />
            Back to chat
          </button>

          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              isLight
                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                : "border-indigo-400/25 bg-indigo-500/10 text-indigo-300"
            }`}
          >
            <Sparkles className="mr-1 inline" size={13} />
            Simulation Studio
          </span>
        </div>

        <div className="mb-7 grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-950/20">
              <BrainCircuit size={25} />
            </div>

            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Make ideas testable.
            </h1>

            <p
              className={`mt-3 max-w-2xl text-sm leading-6 md:text-base ${muted}`}
            >
              Explore possible outcomes, challenge assumptions, and review
              specialist perspectives. Results are AI-generated scenarios—not
              guarantees or verified forecasts.
            </p>
          </div>

          <div className={`rounded-2xl border p-4 ${panel}`}>
            <div className="flex items-start gap-3">
              <ShieldCheck
                className="mt-0.5 shrink-0 text-emerald-500"
                size={20}
              />

              <div>
                <p className="text-sm font-semibold">Built with safeguards</p>

                <p className={`mt-1 text-xs leading-5 ${muted}`}>
                  The server keeps provider credentials private, requires
                  sign-in, and applies AI usage limits. Simulations state
                  assumptions and uncertainty.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {MODES.map((item) => {
            const Icon = item.icon;
            const selected = mode === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setMode(item.id);
                  setResult(null);
                  setActiveHistoryId(null);
                  setError("");
                }}
                className={`rounded-2xl border p-4 text-left transition ${
                  selected
                    ? "border-indigo-400 bg-indigo-500/10 ring-1 ring-indigo-400/30"
                    : `${panel} hover:border-indigo-400/50`
                }`}
              >
                <div
                  className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${
                    selected
                      ? "bg-indigo-500 text-white"
                      : isLight
                        ? "bg-neutral-100 text-neutral-700"
                        : "bg-neutral-800 text-neutral-300"
                  }`}
                >
                  <Icon size={18} />
                </div>

                <p className="text-sm font-semibold">{item.title}</p>

                <p className={`mt-1 text-xs leading-5 ${muted}`}>
                  {item.description}
                </p>
              </button>
            );
          })}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
          <div className={`rounded-2xl border p-4 md:p-5 ${panel}`}>
            <div className="mb-4 flex items-center gap-2">
              <WandSparkles size={18} className="text-indigo-400" />
              <h2 className="font-semibold">
                Configure your {modeLabel.toLowerCase()}
              </h2>
            </div>

            <label
              htmlFor="simulation-prompt"
              className="mb-2 block text-sm font-medium"
            >
              What do you want to explore?
            </label>

            <textarea
              id="simulation-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={6000}
              rows={6}
              placeholder="Describe your scenario, goal, constraints, timeframe, and what you want to compare…"
              className={`w-full resize-y rounded-xl border px-4 py-3 text-sm leading-6 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 ${field}`}
            />

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className={`text-xs ${muted}`}>
                {prompt.length}/6000 characters
              </span>

              <label className={`flex items-center gap-2 text-xs ${muted}`}>
                Response detail
                <select
                  value={detail}
                  onChange={(event) =>
                    setDetail(event.target.value as typeof detail)
                  }
                  className={`rounded-lg border px-2 py-1.5 ${field}`}
                >
                  <option value="concise">Concise</option>
                  <option value="balanced">Balanced</option>
                  <option value="detailed">Detailed</option>
                </select>
              </label>
            </div>

            {mode === "agents" && (
              <div className={`mt-4 rounded-xl border p-3 ${panel}`}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">Custom specialists</p>

                    <p className={`mt-1 text-xs leading-5 ${muted}`}>
                      Optional. Add up to two specialists alongside the five
                      built-in agents.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setCustomAgents((previous) =>
                        previous.length >= 2
                          ? previous
                          : [
                              ...previous,
                              {
                                name: "",
                                role: "",
                                focus: "",
                              },
                            ],
                      )
                    }
                    disabled={customAgents.length >= 2}
                    className="rounded-lg border border-indigo-400/30 px-2.5 py-1.5 text-xs font-semibold text-indigo-400 disabled:opacity-40"
                  >
                    Add specialist
                  </button>
                </div>

                <div className="space-y-3">
                  {customAgents.map((agent, index) => (
                    <div
                      key={index}
                      className={`grid gap-2 rounded-xl border p-3 ${
                        isLight ? "border-neutral-200" : "border-neutral-800"
                      }`}
                    >
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="text-xs font-medium">
                          Name
                          <input
                            value={agent.name}
                            maxLength={60}
                            onChange={(event) =>
                              setCustomAgents((previous) =>
                                previous.map((item, i) =>
                                  i === index
                                    ? {
                                        ...item,
                                        name: event.target.value,
                                      }
                                    : item,
                                ),
                              )
                            }
                            placeholder="e.g. Accessibility Expert"
                            className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${field}`}
                          />
                        </label>

                        <label className="text-xs font-medium">
                          Role
                          <input
                            value={agent.role}
                            maxLength={80}
                            onChange={(event) =>
                              setCustomAgents((previous) =>
                                previous.map((item, i) =>
                                  i === index
                                    ? {
                                        ...item,
                                        role: event.target.value,
                                      }
                                    : item,
                                ),
                              )
                            }
                            placeholder="e.g. Accessibility review"
                            className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${field}`}
                          />
                        </label>
                      </div>

                      <label className="text-xs font-medium">
                        Focus and instructions
                        <textarea
                          value={agent.focus}
                          maxLength={500}
                          rows={2}
                          onChange={(event) =>
                            setCustomAgents((previous) =>
                              previous.map((item, i) =>
                                i === index
                                  ? {
                                      ...item,
                                      focus: event.target.value,
                                    }
                                  : item,
                              ),
                            )
                          }
                          placeholder="What should this specialist examine?"
                          className={`mt-1 w-full resize-y rounded-lg border px-3 py-2 text-sm ${field}`}
                        />
                      </label>

                      {customAgents.length > 1 && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() =>
                              setCustomAgents((previous) =>
                                previous.filter((_, i) => i !== index),
                              )
                            }
                            className="text-xs text-rose-400 hover:text-rose-300"
                          >
                            Remove specialist
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-400"
              >
                {error}
              </div>
            )}

            {historyNotice && (
              <div
                role="status"
                className={`mt-3 rounded-xl border px-3 py-2.5 text-xs leading-5 ${
                  isLight
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-amber-400/20 bg-amber-500/10 text-amber-200"
                }`}
              >
                {historyNotice}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void runSimulation()}
                disabled={!prompt.trim() || running}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {running ? (
                  <>
                    <LoaderCircle className="animate-spin" size={17} />
                    Running simulation…
                  </>
                ) : (
                  <>
                    <Sparkles size={17} />
                    Run simulation
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setPrompt("");
                  setResult(null);
                  setError("");
                  setActiveHistoryId(null);
                }}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-sm ${panel}`}
              >
                <RotateCcw size={15} />
                Reset
              </button>
            </div>

            {running && (
              <div
                className={`mt-4 rounded-xl p-3 text-sm ${
                  isLight
                    ? "bg-indigo-50 text-indigo-800"
                    : "bg-indigo-500/10 text-indigo-200"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <LoaderCircle className="animate-spin" size={15} />
                  Coordinating the analysis, comparing scenarios, and checking
                  assumptions…
                </span>
              </div>
            )}
          </div>

          <aside className={`rounded-2xl border p-4 ${panel}`}>
            <div className="mb-3 flex items-center gap-2">
              <Target size={17} className="text-indigo-400" />
              <h2 className="text-sm font-semibold">Try a starting point</h2>
            </div>

            <div className="space-y-2">
              {PRESETS.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => {
                    setPrompt(item.prompt);
                    setResult(null);
                    setError("");
                  }}
                  className={`w-full rounded-xl border p-3 text-left transition hover:border-indigo-400/50 ${
                    isLight
                      ? "border-neutral-200 bg-neutral-50"
                      : "border-neutral-800 bg-neutral-950/70"
                  }`}
                >
                  <span className="block text-sm font-medium">
                    {item.title}
                  </span>

                  <span className={`mt-1 block text-xs leading-5 ${muted}`}>
                    {item.prompt.slice(0, 94)}…
                  </span>
                </button>
              ))}
            </div>

            <div
              className={`mt-4 border-t pt-4 ${
                isLight ? "border-neutral-200" : "border-neutral-800"
              }`}
            >
              <div className="mb-2 flex items-center gap-2">
                <CircleHelp size={16} className="text-indigo-400" />
                <p className="text-xs font-semibold">A good prompt includes</p>
              </div>

              <ul className={`space-y-1.5 text-xs leading-5 ${muted}`}>
                <li>• Your objective and starting conditions</li>
                <li>• Constraints, budget, or timeframe</li>
                <li>• Which outcomes you want to compare</li>
                <li>• What evidence would change the conclusion</li>
              </ul>
            </div>
            <div
              className={`mt-4 border-t pt-4 ${
                isLight ? "border-neutral-200" : "border-neutral-800"
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold">Saved simulations</p>

                {historyLoading && (
                  <LoaderCircle
                    size={13}
                    className="animate-spin"
                    aria-label="Loading saved simulations"
                  />
                )}
              </div>

              {history.length === 0 ? (
                <p className={`text-xs leading-5 ${muted}`}>
                  {historyLoading
                    ? "Loading saved history…"
                    : "Your saved simulations will appear here."}
                </p>
              ) : (
                <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                  {history.map((item) => (
                    <div key={item.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPrompt(item.prompt);
                          setMode(item.mode);
                          setResult(item.result);
                          setActiveHistoryId(item.id);
                          setError("");
                          setHistoryNotice("");
                        }}
                        className={`min-w-0 flex-1 truncate rounded-lg px-2.5 py-2 text-left text-xs ${
                          activeHistoryId === item.id
                            ? "bg-indigo-500/15 text-indigo-300"
                            : isLight
                              ? "hover:bg-neutral-100"
                              : "hover:bg-neutral-800"
                        }`}
                        title={`${item.title} · ${new Date(
                          item.createdAt,
                        ).toLocaleString()}`}
                      >
                        <span className="block truncate">{item.title}</span>

                        <span className={`mt-0.5 block text-[10px] ${muted}`}>
                          {new Date(item.createdAt).toLocaleDateString()} ·{" "}
                          {item.mode}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void deleteSavedSimulation(item.id)}
                        className={`rounded-lg p-2 ${muted} transition hover:text-rose-500`}
                        aria-label={`Delete saved simulation: ${item.title}`}
                        title="Delete saved simulation"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>

        {result && (
          <div className="mt-6 space-y-5" aria-live="polite">
            <div className={`rounded-2xl border p-5 md:p-6 ${panel}`}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <CheckCircle2 className="text-emerald-500" size={19} />
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-500">
                  Analysis complete
                </span>
              </div>

              <h2 className="text-2xl font-bold">{result.title}</h2>

              <p
                className={`mt-3 whitespace-pre-wrap text-sm leading-7 ${muted}`}
              >
                {result.summary}
              </p>

              {mode === "world" && (
  <button
    type="button"
    onClick={() => void runSimulation(true)}
    disabled={running}
    className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-3 py-2 text-sm font-semibold text-indigo-400 transition hover:bg-indigo-500/15 disabled:opacity-50"
  >
    {running ? (
      <LoaderCircle
        size={16}
        className="animate-spin"
      />
    ) : (
      <ArrowRight size={16} />
    )}

    Advance world one turn
  </button>
)}
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <div className={`rounded-2xl border p-5 ${panel}`}>
                <h3 className="mb-3 font-semibold">Scenarios to compare</h3>

                {result.scenarios.length ? (
                  <div className="space-y-3">
                    {result.scenarios.map((scenario, index) => (
                      <article
                        key={`${scenario.name}-${index}`}
                        className={`rounded-xl border p-4 ${
                          isLight
                            ? "border-neutral-200 bg-neutral-50"
                            : "border-neutral-800 bg-neutral-950/70"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="font-semibold">{scenario.name}</h4>

                          <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs text-indigo-400">
                            {scenario.likelihood}
                          </span>
                        </div>

                        <p className={`mt-2 text-sm leading-6 ${muted}`}>
                          {scenario.outcome}
                        </p>

                        {scenario.drivers.length > 0 && (
                          <ul
                            className={`mt-2 list-disc space-y-1 pl-5 text-xs leading-5 ${muted}`}
                          >
                            {scenario.drivers.map((driver, i) => (
                              <li key={i}>{driver}</li>
                            ))}
                          </ul>
                        )}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className={`text-sm ${muted}`}>
                    No scenario breakdown was returned.
                  </p>
                )}
              </div>

              <div className="space-y-5">
                <div className={`rounded-2xl border p-5 ${panel}`}>
                  <h3 className="mb-3 font-semibold">Starting assumptions</h3>

                  {result.assumptions.length ? (
                    <ul
                      className={`list-disc space-y-2 pl-5 text-sm leading-6 ${muted}`}
                    >
                      {result.assumptions.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className={`text-sm ${muted}`}>
                      No explicit assumptions were returned.
                    </p>
                  )}
                </div>

                <div className={`rounded-2xl border p-5 ${panel}`}>
                  <h3 className="mb-3 font-semibold">Suggested next steps</h3>

                  {result.nextSteps.length ? (
                    <ol
                      className={`list-decimal space-y-2 pl-5 text-sm leading-6 ${muted}`}
                    >
                      {result.nextSteps.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ol>
                  ) : (
                    <p className={`text-sm ${muted}`}>
                      No next steps were returned.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {result.agents.length > 0 && (
              <div className={`rounded-2xl border p-5 ${panel}`}>
                <div className="mb-4 flex items-center gap-2">
                  <Bot size={18} className="text-indigo-400" />
                  <h3 className="font-semibold">Specialist perspectives</h3>
                  <span className={`text-xs ${muted}`}>
                    AI-generated viewpoints
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {result.agents.map((agent, i) => (
                    <article
                      key={`${agent.name}-${i}`}
                      className={`rounded-xl border p-4 ${
                        isLight
                          ? "border-neutral-200 bg-neutral-50"
                          : "border-neutral-800 bg-neutral-950/70"
                      }`}
                    >
                      <p className="text-sm font-semibold">{agent.name}</p>

                      <p className="mt-1 text-xs font-medium text-indigo-400">
                        {agent.role}
                      </p>

                      <p className={`mt-3 text-sm leading-6 ${muted}`}>
                        {agent.finding}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {result.limitations.length > 0 && (
              <div
                className={`rounded-2xl border border-amber-400/20 p-5 ${
                  isLight ? "bg-amber-50" : "bg-amber-500/5"
                }`}
              >
                <h3 className="mb-2 text-sm font-semibold text-amber-600">
                  Limitations & uncertainty
                </h3>

                <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-amber-700 dark:text-amber-300">
                  {result.limitations.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className={`text-xs leading-5 ${muted}`}>
              This is a generated scenario analysis, not a verified forecast.
              Validate important facts independently and treat likelihood labels
              as qualitative unless the result provides a defensible statistical
              method.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
