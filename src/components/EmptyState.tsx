import React from 'react';
import type { AssistantMode } from '../types';
import { MODES } from './ModeSelector';
import {
  ArrowRight,
  Code2,
  Lightbulb,
  PenLine,
  Search,
  Sparkles,
} from 'lucide-react';

interface EmptyStateProps {
  currentMode: AssistantMode;
  onSelectPrompt: (prompt: string) => void;
  onSelectMode: (mode: AssistantMode) => void;
}

const MODE_PROMPTS: Record<
  AssistantMode,
  { title: string; prompt: string }[]
> = {
  general: [
    {
      title: 'Analyze & Plan',
      prompt:
        'Help me draft a comprehensive 4-week study and preparation schedule for an upcoming systems exam.',
    },
    {
      title: 'Explain Concepts',
      prompt:
        'Explain the core differences between event-driven architecture and polling systems in simple terms.',
    },
    {
      title: 'Creative Writing',
      prompt:
        'Write a compelling introductory email pitching an innovative sustainability initiative to leadership.',
    },
    {
      title: 'Problem Solving',
      prompt:
        'What are five high-leverage frameworks for making high-stakes decisions under uncertainty?',
    },
  ],

  study: [
    {
      title: 'Step-by-step Tutor',
      prompt:
        'Teach me how Bayes theorem works step by step using a clear, intuitive diagnostic test example.',
    },
    {
      title: 'Concept Check',
      prompt:
        'I want to understand recursion vs iteration. Give me an analogy and quiz my understanding.',
    },
    {
      title: 'Exam Review',
      prompt:
        'Help me understand the mechanics of cellular respiration and mitochondria step-by-step.',
    },
    {
      title: 'Practice Problem',
      prompt:
        'Give me a calculus optimization challenge problem and walk me through the solution strategy.',
    },
  ],

  coding: [
    {
      title: 'Code Review & Refactor',
      prompt:
        'How do I implement a robust concurrency-safe debounce hook with cancellation in React TypeScript?',
    },
    {
      title: 'Architecture & Design',
      prompt:
        'Design a scalable rate-limiter using token bucket algorithm with Node.js and Redis semantics.',
    },
    {
      title: 'Bug Diagnosis',
      prompt:
        'Why would an SSE connection repeatedly disconnect after 60 seconds in an Express Node server?',
    },
    {
      title: 'Algorithm Analysis',
      prompt:
        'Compare time and space trade-offs between QuickSort, MergeSort, and TimSort with edge cases.',
    },
  ],

  writing: [
    {
      title: 'Editorial Polish',
      prompt:
        'Polish this draft paragraph to make it punchy, rhythmic, and eliminate passive voice: ',
    },
    {
      title: 'Executive Brief',
      prompt:
        'Draft an executive briefing memo summarizing quarterly strategic objectives and key risks.',
    },
    {
      title: 'Storytelling Hook',
      prompt:
        'Write three distinct opening hooks for an article about the quiet evolution of open-source software.',
    },
    {
      title: 'Speech Drafting',
      prompt:
        'Write an inspiring 3-minute keynote address welcoming incoming engineering fellows.',
    },
  ],

  research: [
    {
      title: 'Search & Grounding',
      prompt:
        'What are the most recent verified discoveries from the James Webb Space Telescope regarding early galaxies?',
    },
    {
      title: 'Comparative Analysis',
      prompt:
        'Compare empirical evidence for sodium-ion batteries versus solid-state lithium cells for grid storage.',
    },
    {
      title: 'Literature Synthesis',
      prompt:
        'Summarize the primary consensus and open debates regarding sleep deprivation and cognitive plasticity.',
    },
    {
      title: 'Fact Verification',
      prompt:
        'Investigate the historical timeline and verified origins of the Unix operating system at Bell Labs.',
    },
  ],

  brainstorming: [
    {
      title: 'Lateral Innovation',
      prompt:
        'Brainstorm 8 non-obvious product concepts combining personal local AI models with physical desk hardware.',
    },
    {
      title: 'Game & App Mechanics',
      prompt:
        'Ideate engaging, non-punitive gamification mechanisms for a daily language habit tracker.',
    },
    {
      title: 'Strategic Workshop',
      prompt:
        'Generate 5 contrarian business models for independent documentary filmmakers in 2026.',
    },
    {
      title: 'Event Theme Ideation',
      prompt:
        'Suggest 4 cohesive, memorable conceptual themes for an international tech & design summit.',
    },
  ],
};

const PROMPT_ICONS = [
  Lightbulb,
  Search,
  PenLine,
  Code2,
];

export const EmptyState: React.FC<EmptyStateProps> = ({
  currentMode,
  onSelectPrompt,
}) => {
  const activeModeConfig =
    MODES.find((mode) => mode.id === currentMode) ?? MODES[0];

  const ActiveModeIcon = activeModeConfig.icon;

  const prompts =
    MODE_PROMPTS[currentMode] ?? MODE_PROMPTS.general;

  return (
    <section className="martinez-empty-state flex w-full flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">

        {/* Brand introduction */}
        <div className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-[1.2rem] border border-indigo-300/20 bg-gradient-to-br from-indigo-500/20 via-violet-500/15 to-indigo-500/5 text-indigo-300 shadow-[0_12px_35px_rgba(79,70,229,0.13)]">
          <span
            className="absolute inset-1.5 rounded-[0.9rem] border border-indigo-300/10"
            aria-hidden="true"
          />

          <Sparkles
            size={25}
            strokeWidth={1.7}
          />
        </div>

        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-300/90 sm:text-[11px]">
          Your AI workspace
        </p>

        <h1 className="text-balance text-2xl font-semibold tracking-[-0.045em] text-white sm:text-3xl md:text-4xl">
          What are we working on?
        </h1>

        <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-400 sm:text-[15px]">
          Think through a problem, explore an idea, write something
          great, or build your next project with Martins AI.
        </p>

        {/* Current mode remains visible without duplicating header controls. */}
        <div className="mt-6 inline-flex max-w-full items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/70 px-3 py-1.5 text-xs text-neutral-300">
          <ActiveModeIcon
            size={14}
            className={activeModeConfig.accentColor}
          />

          <span className="font-medium">
            {activeModeConfig.name}
          </span>

          <span
            className="text-neutral-600"
            aria-hidden="true"
          >
            ·
          </span>

          <span className="truncate text-neutral-400">
            {activeModeConfig.tagline}
          </span>
        </div>

        {/* Suggested prompts */}
        <div className="mt-8 w-full text-left sm:mt-9">
          <div className="mb-3 flex items-end justify-between gap-3 px-0.5">
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-neutral-200">
                A few places to start
              </h2>

              <p className="mt-1 text-[11px] text-neutral-500 sm:text-xs">
                Choose a prompt or write your own below.
              </p>
            </div>

            <span className="hidden text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-600 sm:inline">
              Suggested prompts
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {prompts.map((item, index) => {
              const PromptIcon =
                PROMPT_ICONS[index % PROMPT_ICONS.length];

              return (
                <button
                  key={`${currentMode}-${item.title}`}
                  type="button"
                  onClick={() => onSelectPrompt(item.prompt)}
                  className="group flex min-h-[112px] w-full items-start gap-3 rounded-2xl border border-neutral-800/90 bg-neutral-900/45 p-3.5 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-indigo-400/30 hover:bg-neutral-900/90 focus-visible:ring-2 focus-visible:ring-indigo-400 sm:min-h-[120px] sm:p-4"
                >
                  {/* Prompt category icon */}
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-950/80 text-neutral-400 transition-colors group-hover:border-indigo-400/20 group-hover:bg-indigo-500/10 group-hover:text-indigo-300">
                    <PromptIcon
                      size={17}
                      strokeWidth={1.7}
                    />
                  </span>

                  {/* Prompt title and description */}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold leading-5 text-neutral-200 transition-colors group-hover:text-white sm:text-[13px]">
                        {item.title}
                      </span>

                      <ArrowRight
                        size={14}
                        className="shrink-0 text-neutral-600 transition-all group-hover:translate-x-0.5 group-hover:text-indigo-300"
                      />
                    </span>

                    <span className="mt-1.5 block line-clamp-2 text-[11px] leading-[1.6] text-neutral-400 sm:text-xs">
                      {item.prompt.trim()}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Guidance */}
        <p className="mt-6 flex items-center gap-2 text-[10px] text-neutral-600 sm:text-[11px]">
          <span
            className="h-1.5 w-1.5 rounded-full bg-emerald-400/80"
            aria-hidden="true"
          />

          Start with a suggestion, or use the message box below.
        </p>
      </div>
    </section>
  );
};