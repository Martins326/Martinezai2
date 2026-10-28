import React, { useEffect, useRef, useState } from "react";
import type { UserMemory, UserSettings } from "../types";
import { AccountPanel } from "./AccountPannel";

type Settings = UserSettings;
type SavedMemory = UserMemory;

type AccountProfile = {
  $id: string;
  name: string;
  email: string;
  emailVerification: boolean;
  hasProfilePicture?: boolean;
profilePictureUpdatedAt?: number;
};

interface SettingsModalProps {
  isOpen: boolean;
  showArchived: boolean;
  onToggleArchived: () => void;
  onClearAll: () => void;
  onClose: () => void;
  settings: Settings;
  onSaveSettings: (settings: Settings) => void;
  memories: SavedMemory[];
  onAddMemory: (text: string) => void;
  onDeleteMemory: (id: string) => void;
  onClearMemories: () => void;
  profile: AccountProfile;
  onSignOut: () => Promise<void> | void;
  onResendVerification: () => Promise<void>;
  onUpdateProfile: (name: string) => Promise<void>;
  authNotice: string;
  onOpenImageGen: () => void;
  onToggleWorkspace: () => void;
  isWorkspaceOpen: boolean;
  onUpdateProfilePicture: (
  imageDataUrl: string | null
) => Promise<void>;

onSummarizeProfilePicture: () => Promise<string>;
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20";

const buttonClass = "rounded-xl px-3.5 py-2.5 text-sm font-medium transition";

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  showArchived,
  onToggleArchived,
  onClearAll,
  onClose,
  settings,
  onSaveSettings,
  memories,
  onAddMemory,
  onDeleteMemory,
  onClearMemories,
  profile,
  onSignOut,
  onResendVerification,
  onUpdateProfile,
  authNotice,
  onOpenImageGen,
  onToggleWorkspace,
  isWorkspaceOpen,
  onUpdateProfilePicture,
onSummarizeProfilePicture,
}) => {
  const [draft, setDraft] = useState<Settings>(settings);
  const [memoryText, setMemoryText] = useState("");
  const wasOpenRef = useRef(false);

  useEffect(() => {
  if (isOpen && !wasOpenRef.current) {
    setDraft(settings);
  }

  wasOpenRef.current = isOpen;
}, [isOpen, settings]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const setSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const submitMemory = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const value = memoryText.trim();
    if (!value) return;

    onAddMemory(value);
    setMemoryText("");
  };

 

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-heading"
        className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 text-neutral-100 shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
          <div>
            <h2 id="settings-heading" className="text-lg font-semibold">
              Settings
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Personalize your Martins AI experience
            </p>
          </div>

          <button
            className="rounded-lg px-3 py-2 text-neutral-400 hover:bg-white/10 hover:text-white"
            onClick={onClose}
            aria-label="Close settings"
          >
            ✕
          </button>
        </header>

        <main className="min-h-0 flex-1 space-y-7 overflow-y-auto p-4 sm:p-6">
          <section className="space-y-4">
            <div>
              <h3 className="font-semibold">Preferences</h3>
              <p className="mt-1 text-xs text-neutral-500">
                Choose how the assistant responds.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-2 block text-neutral-300">Appearance</span>
                <select
                  className={inputClass}
                  value={draft.theme}
                  onChange={(e) =>
                    setSetting("theme", e.target.value as Settings["theme"])
                  }
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </label>

              <label className="text-sm">
                <span className="mb-2 block text-neutral-300">
                  Default assistant mode
                </span>
                <select
                  className={inputClass}
                  value={draft.defaultMode}
                  onChange={(e) =>
                    setSetting(
                      "defaultMode",
                      e.target.value as Settings["defaultMode"],
                    )
                  }
                >
                  <option value="general">General</option>
                  <option value="study">Study</option>
                  <option value="coding">Coding</option>
                  <option value="writing">Writing</option>
                  <option value="research">Research</option>
                  <option value="brainstorming">Brainstorming</option>
                </select>
              </label>

              <label className="text-sm">
  <span className="mb-2 block text-neutral-300">
    Response length
  </span>

  <select
    className={inputClass}
    value={draft.responseLength}
    onChange={(event) =>
      setSetting(
        "responseLength",
        event.target.value as UserSettings["responseLength"],
      )
    }
  >
    <option value="concise">Concise</option>
    <option value="balanced">Balanced</option>
    <option value="detailed">Detailed</option>
  </select>
</label>

              <label className="text-sm">
                <span className="mb-2 block text-neutral-300">Text size</span>
                <select
                  className={inputClass}
                  value={draft.fontSize}
                  onChange={(e) =>
                    setSetting(
                      "fontSize",
                      e.target.value as Settings["fontSize"],
                    )
                  }
                >
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                </select>
              </label>

             <label className="text-sm sm:col-span-2">
  <span className="mb-2 block text-neutral-300">
    Speech voice
  </span>

  <select
    className={inputClass}
    value={draft.ttsVoice || "default"}
    onChange={(event) =>
      setSetting("ttsVoice", event.target.value)
    }
  >
    <option value="default">Default (Kore)</option>
    <option value="Kore">Kore · clear and balanced</option>
    <option value="Puck">Puck · lively</option>
    <option value="Charon">Charon · deep</option>
    <option value="Fenrir">Fenrir · energetic</option>
    <option value="Aoede">Aoede · warm</option>
    <option value="Leda">Leda · youthful</option>
    <option value="Orus">Orus · firm</option>
    <option value="Zephyr">Zephyr · bright</option>
  </select>
</label>
            </div>

            <div className="divide-y divide-white/10 rounded-xl border border-white/10">
              {(
                [
                  [
                    "enableMemory",
                    "Memory",
                    "Allow the assistant to use saved memories.",
                  ],
                  [
                    "enableAutomaticMemory",
                    "Automatic memory",
                    "Allow helpful details to be suggested for memory.",
                  ],
                  [
                    "enableSearchGrounding",
                    "Web search grounding",
                    "Use search-grounded information when available.",
                  ],
                ] as const
              ).map(([key, title, description]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center justify-between gap-4 p-3.5"
                >
                  <span>
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="mt-1 block text-xs leading-5 text-neutral-500">
                      {description}
                    </span>
                  </span>

                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-violet-500"
                    checked={draft[key]}
                    onChange={(e) => setSetting(key, e.target.checked)}
                  />
                </label>
              ))}
            </div>

            <label className="block text-sm">
              <span className="mb-2 block text-neutral-300">
                Custom instructions
              </span>
              <textarea
                className={`${inputClass} min-h-24 resize-y`}
                value={draft.customInstructions}
                onChange={(e) =>
                  setSetting("customInstructions", e.target.value)
                }
                placeholder="Tell Martins AI how you want it to respond…"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                className={`${buttonClass} border border-white/10 hover:bg-white/10`}
                onClick={onOpenImageGen}
              >
                Open image studio
              </button>

              <button
                className={`${buttonClass} border border-white/10 hover:bg-white/10`}
                onClick={onToggleWorkspace}
              >
                {isWorkspaceOpen
                  ? "Close code workspace"
                  : "Open code workspace"}
              </button>
            </div>
          </section>

          <section className="space-y-3 border-t border-white/10 pt-6">
            <div>
              <h3 className="font-semibold">Memory</h3>
              <p className="mt-1 text-xs text-neutral-500">
                Add or remove details remembered across chats.
              </p>
            </div>

            <form onSubmit={submitMemory} className="flex gap-2">
              <input
                className={inputClass}
                value={memoryText}
                onChange={(e) => setMemoryText(e.target.value)}
                placeholder="Add a memory…"
              />

              <button
                type="submit"
                disabled={!memoryText.trim()}
                className={`${buttonClass} bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40`}
              >
                Add
              </button>
            </form>

            {memories.length ? (
              <div className="space-y-2">
                {memories.map((memory) => (
                  <div
                    key={memory.id}
                    className="flex items-start gap-3 rounded-xl border border-white/10 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap break-words text-sm">
                        {memory.text}
                      </p>
                      <p className="mt-1 text-[11px] text-neutral-500">
                        {memory.source === "automatic" ? "Automatic" : "Manual"}
                        {memory.createdAt
                          ? ` · ${new Date(memory.createdAt).toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>

                    <button
                      className="rounded-lg px-2 py-1 text-sm text-red-300 hover:bg-red-500/10"
                      onClick={() => onDeleteMemory(memory.id)}
                      aria-label="Delete memory"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-neutral-500">
                No saved memories yet.
              </p>
            )}

            <button
              className={`${buttonClass} border border-red-500/20 text-red-300 hover:bg-red-500/10`}
              disabled={!memories.length}
              onClick={() => {
                if (
                  window.confirm(
                    "Clear all saved memories? This cannot be undone.",
                  )
                ) {
                  onClearMemories();
                }
              }}
            >
              Clear all memories
            </button>
          </section>

         <section className="space-y-4 border-t border-white/10 pt-6">
  <AccountPanel
    profile={profile}
    showArchived={showArchived}
    onToggleArchived={onToggleArchived}
    onClearAll={onClearAll}
    onSignOut={onSignOut}
    onResendVerification={onResendVerification}
    onUpdateProfile={onUpdateProfile}
    authNotice={authNotice}
    onClose={onClose}
    profilePictureSummary={settings.profilePictureSummary || ""}
onUpdateProfilePicture={onUpdateProfilePicture}
onSummarizeProfilePicture={onSummarizeProfilePicture}
  />
</section>
        </main>

        <footer className="flex items-center justify-end gap-2 border-t border-white/10 bg-neutral-900/50 px-4 py-3 sm:px-6">
          <button
            className={`${buttonClass} text-neutral-300 hover:bg-white/10`}
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            className={`${buttonClass} bg-violet-600 text-white hover:bg-violet-500`}
            onClick={() => {
              onSaveSettings(draft);
              onClose();
            }}
          >
            Save preferences
          </button>
        </footer>
      </section>
    </div>
  );
};

export default SettingsModal;
