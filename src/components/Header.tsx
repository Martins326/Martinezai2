import React from 'react';
import { PanelLeft, Sparkles } from 'lucide-react';

import type { AssistantMode } from '../types';
import { ModeSelector } from './ModeSelector';

interface HeaderProps {
  onToggleSidebar: () => void;
  activeMode: AssistantMode;
  onSelectMode: (mode: AssistantMode) => void;
  chatTitle: string;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  activeMode,
  onSelectMode,
  chatTitle,
}) => {
  const conversationTitle = chatTitle.trim() || 'New conversation';

  return (
  <header className="martinez-app-header sticky top-0 z-50 flex shrink-0 items-center justify-between gap-3 px-3 sm:px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="martinez-header-icon-button shrink-0"
          title="Toggle sidebar"
          aria-label="Toggle conversation sidebar"
          aria-controls="martinez-conversation-sidebar"
        >
          <PanelLeft size={19} strokeWidth={1.8} />
        </button>

        <div
          className="martinez-header-divider hidden sm:block"
          aria-hidden="true"
        />

        <div className="martinez-header-brand min-w-0 sm:hidden">
          <span
            className="martinez-header-brand-mark"
            aria-hidden="true"
          >
            <Sparkles size={15} strokeWidth={1.9} />
          </span>

          <span className="max-[380px]:hidden">
            Martins AI
          </span>
        </div>

        <div className="hidden min-w-0 flex-col gap-1 sm:flex">
          <span className="martinez-header-kicker">
            Workspace
          </span>

          <span
            className="martinez-header-title max-w-[min(34vw,28rem)]"
            title={conversationTitle}
          >
            {conversationTitle}
          </span>
        </div>
      </div>

      <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
        <ModeSelector
          currentMode={activeMode}
          onSelectMode={onSelectMode}
        />
      </div>
    </header>
  );
};