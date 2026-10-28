import React from 'react';
import { AssistantMode } from '../types';
import {
  Sparkles,
  GraduationCap,
  Code2,
  PenLine,
  Search,
  Lightbulb,
  Check,
  ChevronDown,
} from 'lucide-react';

export interface ModeConfig {
  id: AssistantMode;
  name: string;
  tagline: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accentColor: string;
  badgeBg: string;
}

export const MODES: ModeConfig[] = [
  {
    id: 'general',
    name: 'General Assistant',
    tagline: 'Versatile intelligence',
    description: 'Answers everyday questions, synthesizes facts, and helps with general everyday tasks.',
    icon: Sparkles,
    accentColor: 'text-indigo-400',
    badgeBg: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
  },
  {
    id: 'study',
    name: 'Study Mode',
    tagline: 'Patient tutoring & concepts',
    description: 'Explains concepts step by step, provides analogies, checks understanding, and nurtures deep comprehension.',
    icon: GraduationCap,
    accentColor: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  },
  {
    id: 'coding',
    name: 'Coding Mode',
    tagline: 'Engineering & debugging',
    description: 'Writes programs, diagnoses bugs, analyzes algorithms, and reviews architecture with production focus.',
    icon: Code2,
    accentColor: 'text-cyan-400',
    badgeBg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
  },
  {
    id: 'writing',
    name: 'Writing Mode',
    tagline: 'Drafting & editorial polish',
    description: 'Drafts, revises, polishes prose, enhances tone, and structures compelling documents and narratives.',
    icon: PenLine,
    accentColor: 'text-amber-400',
    badgeBg: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  },
  {
    id: 'research',
    name: 'Research Mode',
    tagline: 'Evidence & citations',
    description: 'Investigates questions with Google Search grounding, synthesizes evidence, and provides genuine citations.',
    icon: Search,
    accentColor: 'text-purple-400',
    badgeBg: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  },
  {
    id: 'brainstorming',
    name: 'Brainstorming Mode',
    tagline: 'Ideation & strategy',
    description: 'Generates lateral ideas, breaks down creative blocks, challenges assumptions, and crafts project roadmaps.',
    icon: Lightbulb,
    accentColor: 'text-rose-400',
    badgeBg: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  },
];

interface ModeSelectorProps {
  currentMode: AssistantMode;
  onSelectMode: (mode: AssistantMode) => void;
  disabled?: boolean;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  currentMode,
  onSelectMode,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const active = MODES.find((m) => m.id === currentMode) || MODES[0];
  const IconComponent = active.icon;

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="martinez-mode-selector relative" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-700/70 bg-neutral-900/80 hover:bg-neutral-800/80 text-xs font-medium text-neutral-200 transition-colors shadow-xs"
        title="Select Assistant Mode"
      >
        <IconComponent size={14} className={active.accentColor} />
        <span className="font-medium">{active.name}</span>
        <ChevronDown
          size={13}
          className={`text-neutral-400 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-72 md:w-80 rounded-xl bg-neutral-900 border border-neutral-800 shadow-xl z-50 p-1.5 space-y-1 backdrop-blur-md">
          <div className="px-2.5 py-1 text-[11px] font-semibold text-neutral-400 tracking-wider uppercase">
            Assistant Persona
          </div>
          {MODES.map((mode) => {
            const ItemIcon = mode.icon;
            const isSelected = mode.id === currentMode;

            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => {
                  onSelectMode(mode.id);
                  setIsOpen(false);
                }}
                className={`w-full text-left p-2.5 rounded-lg flex items-start gap-3 transition-colors ${
                  isSelected
                    ? 'bg-neutral-800/90 text-white'
                    : 'text-neutral-300 hover:bg-neutral-800/50 hover:text-white'
                }`}
              >
                <div className={`mt-0.5 p-1.5 rounded-md bg-neutral-800 ${mode.accentColor}`}>
                  <ItemIcon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{mode.name}</span>
                    {isSelected && <Check size={14} className="text-indigo-400" />}
                  </div>
                  <p className="text-[11px] text-neutral-400 line-clamp-2 mt-0.5 leading-snug">
                    {mode.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
