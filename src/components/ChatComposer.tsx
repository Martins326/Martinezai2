import React, { useCallback, useEffect, useRef, useState } from "react";

import {
  AlertCircle,
  ArrowUp,
  AudioLines,
  Camera,
  FileText,
  Globe,
  Image as ImageIcon,
  Mic,
  MicOff,
  Paperclip,
  Plus,
  Sparkles,
  Square,
  X,
  Puzzle,
  ArrowLeft,
} from "lucide-react";

import { ASSISTANT_PLUGINS } from "../plugins/registry";

import type { Attachment } from "../types";
import { useVoiceInput } from "../hooks/useVoiceInput";

interface ChatComposerProps {
  onSendMessage: (
    text: string,
    attachments: Attachment[],
    activePlugins?: string[],
  ) => void;
  onStopGeneration?: () => void;
  isStreaming: boolean;
  enableSearch: boolean;
  onToggleSearch: () => void;
  placeholder?: string;
  showDisclaimer?: boolean;
  onOpenVoiceChat?: () => void;

  thinkHarderForNextPrompt?: boolean;
  onToggleThinkHarderForNextPrompt?: () => void;
  showThinkHarderToggle?: boolean;
  enabledPlugins?: string[];
  downloadedPlugins?: string[];
  activePlugins?: string[];
  onToggleActivePlugin?: (pluginId: string) => void;
  onOpenPlugins?: () => void;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  // Images
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".heic": "image/heic",
  ".heif": "image/heif",

  // Documents
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".rtf": "application/rtf",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".epub": "application/epub+zip",

  // Spreadsheets
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
  ".csv": "text/csv",
  ".tsv": "text/tab-separated-values",

  // Presentations
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".odp": "application/vnd.oasis.opendocument.presentation",

  // Text and data
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".json": "application/json",
  ".jsonl": "application/json",
  ".xml": "application/xml",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
  ".html": "text/html",
  ".htm": "text/html",
  ".css": "text/plain",
  ".log": "text/plain",
  ".ini": "text/plain",
  ".toml": "text/plain",
  ".env": "text/plain",

  // Programming files
  ".js": "text/plain",
  ".jsx": "text/plain",
  ".ts": "text/plain",
  ".tsx": "text/plain",
  ".mjs": "text/plain",
  ".cjs": "text/plain",
  ".py": "text/plain",
  ".java": "text/plain",
  ".c": "text/plain",
  ".h": "text/plain",
  ".cpp": "text/plain",
  ".cs": "text/plain",
  ".php": "text/plain",
  ".sql": "text/plain",
  ".sh": "text/plain",
  ".ipynb": "application/json",

  // Audio
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".aac": "audio/aac",
  ".flac": "audio/flac",

  // Video
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mpeg": "video/mpeg",
  ".mpg": "video/mpeg",

  // Archives
  ".gz": "application/gzip",
  ".tar": "application/x-tar",
};

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_SIZE = 18 * 1024 * 1024;

function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(0)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  onSendMessage,
  onStopGeneration,
  isStreaming,
  enableSearch,
  onToggleSearch,
  placeholder = "Ask Martins AI anything...",
  showDisclaimer = true,
  onOpenVoiceChat,
  thinkHarderForNextPrompt = false,
  onToggleThinkHarderForNextPrompt,
  showThinkHarderToggle = true,
  enabledPlugins = [],
  downloadedPlugins: downloadedPluginsProp,
  activePlugins: activePluginsProp,
  onToggleActivePlugin,
  onOpenPlugins,
}) => {
  const [inputText, setInputText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [voiceErrorDismissed, setVoiceErrorDismissed] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);

  const [localActivePluginIds, setLocalActivePluginIds] = useState<string[]>(
    activePluginsProp || ["weather", "calculator", "market"],
  );
  const activePluginIds = activePluginsProp ?? localActivePluginIds;

  const [showPluginDropdown, setShowPluginDropdown] = useState(false);
  const pluginMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        pluginMenuRef.current &&
        !pluginMenuRef.current.contains(event.target as Node)
      ) {
        setShowPluginDropdown(false);
      }
    };
    if (showPluginDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showPluginDropdown]);

  const togglePluginActive = (id: string) => {
    if (onToggleActivePlugin) {
      onToggleActivePlugin(id);
    } else {
      setLocalActivePluginIds((prev) =>
        prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
      );
    }
  };

  const effectiveDownloaded = downloadedPluginsProp || enabledPlugins || [
    "weather",
    "calculator",
    "market",
    "world-clock",
    "web-grounding",
  ];
  const downloadedPluginObjects = ASSISTANT_PLUGINS.filter((p) =>
    effectiveDownloaded.includes(p.id),
  );
  const activePluginObjects = ASSISTANT_PLUGINS.filter((p) =>
    activePluginIds.includes(p.id),
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toolsContainerRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [showPluginPicker, setShowPluginPicker] = useState(false);
  const [highlightedPluginIndex, setHighlightedPluginIndex] = useState(0);

  // Keep the speech-recognition callback stable.
  const voiceBaseTextRef = useRef("");

  const handleTranscriptChange = useCallback((text: string) => {
    const base = voiceBaseTextRef.current.trimEnd();

    setInputText(base ? `${base} ${text}`.trimEnd() : text);
  }, []);

  const {
    isListening,
    isSupported,
    error: voiceError,
    toggleListening,
  } = useVoiceInput({
    onTranscriptChange: handleTranscriptChange,
  });

  const handleToggleVoiceInput = useCallback(() => {
    if (!isListening) {
      voiceBaseTextRef.current = inputText.trimEnd();
    }

    toggleListening();
  }, [inputText, isListening, toggleListening]);

  useEffect(() => {
    if (voiceError) {
      setVoiceErrorDismissed(false);
    }
  }, [voiceError]);

  // Automatically resize the message input.
  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [inputText]);

  // Close the tools menu when clicking outside it.
  useEffect(() => {
    if (!showToolsMenu) return;

    const closeOutside = (event: MouseEvent | TouchEvent) => {
      if (
        event.target instanceof Node &&
        toolsContainerRef.current &&
        !toolsContainerRef.current.contains(event.target)
      ) {
        setShowToolsMenu(false);
      }
    };

    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("touchstart", closeOutside);

    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("touchstart", closeOutside);
    };
  }, [showToolsMenu]);

  // Send the current message and reset the composer.
  const handleSend = () => {
    if ((!inputText.trim() && attachments.length === 0) || isStreaming) {
      return;
    }

    onSendMessage(inputText.trim(), attachments, activePluginIds);

    setInputText("");
    setAttachments([]);
    setFileError(null);
    setShowToolsMenu(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const inputElement = event.currentTarget;
    const selectedFiles = Array.from(inputElement.files || []);

    inputElement.value = "";
    setFileError(null);

    if (!selectedFiles.length) return;

    void (async () => {
      let accumulatedSize = attachments.reduce(
        (total, item) => total + item.size,
        0,
      );

      for (const file of selectedFiles) {
        if (file.size > MAX_FILE_SIZE) {
          setFileError(`File "${file.name}" exceeds the 20 MB per-file limit.`);
          continue;
        }

        if (accumulatedSize + file.size > MAX_TOTAL_ATTACHMENT_SIZE) {
          setFileError(
            "Attachments together must be 18 MB or smaller. Remove a file or choose smaller files.",
          );
          continue;
        }

        const lowerCaseName = file.name.toLowerCase();

        if (/\.(zip|7z|rar)$/i.test(lowerCaseName)) {
          setFileError(
            `"${file.name}" is not supported as an archive yet. Please use .tar, .tar.gz, or .tgz.`,
          );
          continue;
        }

        const extension = lowerCaseName.includes(".")
          ? `.${lowerCaseName.split(".").pop()}`
          : "";

        const mime =
          MIME_BY_EXTENSION[extension] ||
          file.type ||
          "application/octet-stream";

        try {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();

            reader.onerror = () =>
              reject(
                new Error(`Could not read "${file.name}". Please try again.`),
              );

            reader.onload = () => {
              if (typeof reader.result !== "string") {
                reject(
                  new Error(`Could not read "${file.name}". Please try again.`),
                );
                return;
              }

              resolve(reader.result);
            };

            reader.readAsDataURL(file);
          });

          const newAttachment: Attachment = {
            id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: file.name,
            mimeType: mime,
            size: file.size,
            data: dataUrl.split(",")[1] || "",
          };

          setAttachments((previous) => [...previous, newAttachment]);

          accumulatedSize += file.size;
        } catch (error: unknown) {
          setFileError(
            error instanceof Error
              ? error.message
              : `Could not read "${file.name}".`,
          );
        }
      }
    })();
  };

  const removeAttachment = (id: string) => {
    setAttachments((previous) => previous.filter((item) => item.id !== id));
  };

  const openFilePicker = (
    inputRef: React.RefObject<HTMLInputElement | null>,
  ) => {
    setShowToolsMenu(false);
    inputRef.current?.click();
  };

  const enabledPluginOptions = ASSISTANT_PLUGINS.filter((plugin) =>
    enabledPlugins.includes(plugin.id),
  );

  const cursorPosition =
    textareaRef.current?.selectionStart ?? inputText.length;

  const textBeforeCursor = inputText.slice(0, cursorPosition);
  const atIndex = textBeforeCursor.lastIndexOf("@");
  const atQuery = atIndex >= 0 ? textBeforeCursor.slice(atIndex + 1) : "";

  const showAtSuggestions =
    atIndex >= 0 &&
    !/[\r\n]/.test(atQuery) &&
    (atQuery.length === 0 || !/\s/.test(atQuery));

  const atSuggestions = showAtSuggestions
    ? enabledPluginOptions.filter((plugin) => {
        const query = atQuery.toLowerCase();

        return (
          plugin.name.toLowerCase().startsWith(query) ||
          plugin.id.toLowerCase().startsWith(query)
        );
      })
    : [];

  const selectPlugin = (
    plugin: (typeof ASSISTANT_PLUGINS)[number],
    fromAt = false,
  ) => {
    const selectionStart =
      textareaRef.current?.selectionStart ?? inputText.length;

    const selectionEnd = textareaRef.current?.selectionEnd ?? selectionStart;

    const beforeCursor = inputText.slice(0, selectionStart);
    const mentionAt = fromAt ? beforeCursor.lastIndexOf("@") : -1;

    const currentQuery =
      mentionAt >= 0 ? beforeCursor.slice(mentionAt + 1) : "";

    const replacingAtQuery =
      fromAt && mentionAt >= 0 && !/[\r\n\s]/.test(currentQuery);

    let nextText: string;
    let caretAfterMention: number;

    if (replacingAtQuery) {
      const before = inputText.slice(0, mentionAt);
      const after = inputText.slice(selectionEnd).replace(/^\s+/, "");

      nextText = `${before}@${plugin.name} ${after}`;
      caretAfterMention = before.length + plugin.name.length + 2;
    } else {
      const existing = inputText.trimStart();
      const mentionPrefix = `@${plugin.name} `;

      nextText = existing ? `${mentionPrefix}${existing}` : mentionPrefix;

      caretAfterMention = mentionPrefix.length;
    }

    setInputText(nextText);
    setHighlightedPluginIndex(0);
    setShowPluginPicker(false);
    setShowToolsMenu(false);

    window.requestAnimationFrame(() => {
      const textarea = textareaRef.current;

      textarea?.focus();
      textarea?.setSelectionRange(caretAfterMention, caretAfterMention);
    });
  };

  const activeAtSuggestionIndex = Math.min(
    highlightedPluginIndex,
    Math.max(0, atSuggestions.length - 1),
  );

  // Navigate @mention suggestions with the keyboard. Enter selects a visible
  // suggestion; Shift + Enter still inserts a line break, and Enter sends when
  // no suggestion is available.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showAtSuggestions && atSuggestions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightedPluginIndex((current) =>
          (current + 1) % atSuggestions.length,
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightedPluginIndex((current) =>
          (current - 1 + atSuggestions.length) % atSuggestions.length,
        );
        return;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        selectPlugin(atSuggestions[activeAtSuggestionIndex], true);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }

    if (event.key === "Escape") {
      setShowToolsMenu(false);
    }
  };

  const canSubmit =
    (inputText.trim().length > 0 || attachments.length > 0) && !isStreaming;

  const hasMessage = inputText.trim().length > 0 || attachments.length > 0;

  const visibleVoiceError = voiceError && !voiceErrorDismissed;

  return (
    <div
      className="martinez-composer-panel relative overflow-visible rounded-[1.65rem] border transition-all duration-200 focus-within:border-violet-400/60 focus-within:shadow-[0_0_0_4px_rgba(139,92,246,0.10),0_20px_60px_rgba(0,0,0,0.10)]"
      style={{ color: "var(--app-text)" }}
    >
      <div className="martinez-chat-composer w-full shrink-0 px-3 pb-3 pt-2 sm:px-4 md:pb-4">
        {/* Error messages */}
        {(fileError || visibleVoiceError) && (
          <div className="mb-3 space-y-2" aria-live="polite">
            {fileError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-3 text-xs text-rose-500"
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0" />

                <span className="min-w-0 flex-1 leading-relaxed">
                  {fileError}
                </span>

                <button
                  type="button"
                  onClick={() => setFileError(null)}
                  className="rounded-lg p-1 transition hover:bg-rose-500/10"
                  aria-label="Dismiss file error"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {visibleVoiceError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-3 text-xs text-rose-500"
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0" />

                <span className="min-w-0 flex-1 leading-relaxed">
                  {voiceError}
                </span>

                <button
                  type="button"
                  onClick={() => setVoiceErrorDismissed(true)}
                  className="rounded-lg p-1 transition hover:bg-rose-500/10"
                  aria-label="Dismiss voice input error"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Premium message composer */}
        <div
          className="relative overflow-visible rounded-[1.65rem] border transition-all duration-200 focus-within:border-violet-400/60 focus-within:shadow-[0_0_0_4px_rgba(139,92,246,0.10),0_20px_60px_rgba(0,0,0,0.10)]"
          style={{
            background:
              "color-mix(in srgb, var(--app-panel) 94%, var(--app-accent) 6%)",
            borderColor: "var(--app-border-strong)",
            boxShadow:
              "0 18px 52px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.035)",
          }}
        >
          {/* Composer heading */}
          <div className="flex items-center justify-between gap-3 px-4 pt-3.5 sm:px-5 sm:pt-4">
            <div
              className="flex min-w-0 items-center gap-2 text-[11px] font-semibold tracking-wide"
              style={{ color: "var(--app-muted)" }}
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-lg"
                style={{
                  background: "var(--app-accent-soft)",
                  color: "var(--app-accent)",
                }}
              >
                <Sparkles size={13} />
              </span>

              <span>Message Martins AI</span>
            </div>

            {enableSearch && (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-[10px] font-semibold text-sky-500">
                <Globe size={11} />
                Web search on
              </span>
            )}
          </div>

          {/* Attachment previews */}
          {attachments.length > 0 && (
            <section
              aria-label="Attached files"
              className="mx-3 mt-3 rounded-2xl border p-3 sm:mx-4"
              style={{
                background: "var(--app-panel-raised)",
                borderColor: "var(--app-border)",
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: "var(--app-muted)" }}
                >
                  Attachments · {attachments.length}
                </span>

                <span
                  className="text-[10px]"
                  style={{ color: "var(--app-subtle)" }}
                >
                  20 MB max each
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {attachments.map((attachment) => {
                  const isImage = attachment.mimeType.startsWith("image/");

                  return (
                    <div
                      key={attachment.id}
                      className="flex min-w-0 max-w-full items-center gap-2 rounded-xl border py-1.5 pl-2 pr-1.5 text-xs"
                      style={{
                        background: "var(--app-panel)",
                        borderColor: "var(--app-border)",
                        color: "var(--app-text)",
                      }}
                    >
                      {isImage ? (
                        <img
                          src={`data:${attachment.mimeType};base64,${attachment.data}`}
                          alt={attachment.name}
                          className="h-9 w-9 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                          style={{
                            background: "var(--app-accent-soft)",
                            color: "var(--app-accent)",
                          }}
                        >
                          <FileText size={17} />
                        </span>
                      )}

                      <span className="min-w-0 flex-1">
                        <span
                          className="block max-w-[160px] truncate font-semibold"
                          title={attachment.name}
                        >
                          {attachment.name}
                        </span>

                        <span
                          className="mt-0.5 block text-[10px]"
                          style={{ color: "var(--app-subtle)" }}
                        >
                          {formatFileSize(attachment.size)}
                        </span>
                      </span>

                      <button
                        type="button"
                        onClick={() => removeAttachment(attachment.id)}
                        className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition hover:bg-rose-500/10 hover:text-rose-500"
                        style={{ color: "var(--app-muted)" }}
                        title={`Remove ${attachment.name}`}
                        aria-label={`Remove attachment ${attachment.name}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Typing @ opens the enabled-plugin picker. */}
          {showAtSuggestions && enabledPluginOptions.length > 0 && (
            <div
              className="absolute bottom-full left-3 z-[120] mb-2 w-72 max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border p-2 shadow-2xl"
              role="listbox"
              aria-label="Plugin suggestions"
              style={{
                background: "var(--app-panel)",
                borderColor: "var(--app-border-strong)",
                color: "var(--app-text)",
                boxShadow: "0 24px 70px rgba(0,0,0,0.28)",
              }}
            >
              <div
                className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.15em]"
                style={{ color: "var(--app-subtle)" }}
              >
                Enabled plugins
              </div>

              {atSuggestions.length > 0 ? (
                atSuggestions.map((plugin, index) => (
                  <button
                    key={plugin.id}
                    type="button"
                    role="option"
                    aria-selected={index === activeAtSuggestionIndex}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setHighlightedPluginIndex(index)}
                    onClick={() => selectPlugin(plugin, true)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-violet-500/10 ${index === activeAtSuggestionIndex ? "bg-violet-500/10" : ""}`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
                      {plugin.icon}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        {plugin.name}
                      </span>

                      <span
                        className="mt-0.5 block text-xs"
                        style={{ color: "var(--app-muted)" }}
                      >
                        Activate for this message only
                      </span>
                    </span>
                  </button>
                ))
              ) : (
                <div
                  className="px-3 py-3 text-xs"
                  style={{ color: "var(--app-muted)" }}
                >
                  No enabled plugin matches “{atQuery}”.
                </div>
              )}
            </div>
          )}

          {/* ChatGPT-style Active Plugin Pills Bar */}
          {activePluginIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 px-4 pt-2.5 pb-1 border-b border-neutral-800/40">
              <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 mr-1 select-none">
                <Puzzle size={13} className="text-emerald-400" />
                Active:
              </span>
              {activePluginObjects.map((plugin) => (
                <div
                  key={plugin.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs text-emerald-300 font-medium"
                >
                  <span className="scale-75 text-emerald-400">{plugin.icon}</span>
                  <span>{plugin.name}</span>
                  <button
                    type="button"
                    onClick={() => togglePluginActive(plugin.id)}
                    className="ml-0.5 rounded-full p-0.5 text-emerald-400/70 hover:bg-emerald-500/20 hover:text-emerald-200"
                    title={`Deactivate ${plugin.name}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setShowPluginDropdown(true)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-neutral-700/80 px-2 py-0.5 text-xs text-neutral-400 hover:border-neutral-500 hover:text-neutral-200 transition"
              >
                <Plus size={11} />
                <span>Add</span>
              </button>
            </div>
          )}

          {/* Message input */}
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(event) => {
              setInputText(event.target.value);
              setHighlightedPluginIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening ? "Listening… speak naturally" : placeholder
            }
            rows={1}
            aria-label="Message Martins AI"
            className="block max-h-[200px] min-h-[82px] w-full resize-none bg-transparent px-4 pb-3 pt-3.5 text-[14px] leading-7 outline-none placeholder:text-neutral-500 focus:outline-none sm:px-5 sm:text-[15px]"
            style={{ color: "var(--app-text)" }}
          />

          {/* Live microphone indicator */}
          {isListening && (
            <div
              className="flex items-center gap-2 px-4 pb-2 text-[11px] text-rose-500 sm:px-5"
              role="status"
              aria-live="polite"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
              </span>
              Voice input is listening — speak now
            </div>
          )}

          {/* Hidden file pickers */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="*/*"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Select files to attach"
          />

          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
            aria-label="Choose photos"
          />

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Take a photo"
          />

          {/* Composer toolbar */}
          <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1 sm:px-4 sm:pb-3.5">
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              {/* Attachment and tools menu */}
              <div ref={toolsContainerRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowToolsMenu((previous) => !previous);
                    setShowPluginPicker(false);
                  }}
                  aria-expanded={showToolsMenu}
                  aria-haspopup="menu"
                  aria-label={
                    showToolsMenu ? "Close tools menu" : "Open tools menu"
                  }
                  title="Add photos, files, or tools"
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl border transition-all duration-200 focus-visible:ring-2 focus-visible:ring-violet-400 ${
                    showToolsMenu ? "rotate-45" : "hover:-translate-y-0.5"
                  }`}
                  style={{
                    background: "var(--app-panel-raised)",
                    borderColor: "var(--app-border-strong)",
                    color: "var(--app-text)",
                  }}
                >
                  <span className="relative inline-flex">
                    <Plus size={20} strokeWidth={2} />

                    {thinkHarderForNextPrompt && (
                      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-violet-400 ring-2 ring-[var(--app-panel-raised)]" />
                    )}
                  </span>
                </button>

                {showToolsMenu && (
                  <div
                    role="menu"
                    aria-label={
                      showPluginPicker ? "Enabled plugins" : "Message tools"
                    }
                    className="absolute bottom-full left-0 z-[100] mb-3 w-72 max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border p-2 shadow-2xl"
                    style={{
                      background: "var(--app-panel)",
                      borderColor: "var(--app-border-strong)",
                      color: "var(--app-text)",
                      boxShadow: "0 24px 70px rgba(0,0,0,0.28)",
                    }}
                  >
                    <div
                      className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.15em]"
                      style={{ color: "var(--app-subtle)" }}
                    >
                      Add to your message
                    </div>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => openFilePicker(cameraInputRef)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-violet-500/10"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                        <Camera size={18} />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">
                          Camera
                        </span>
                        <span
                          className="mt-0.5 block text-xs"
                          style={{ color: "var(--app-muted)" }}
                        >
                          Take a photo
                        </span>
                      </span>
                    </button>

                    {showPluginPicker ? (
  <>
    <div className="mb-1 flex items-center gap-2 px-2 py-1">
      <button
        type="button"
        aria-label="Back to message tools"
        onClick={() => setShowPluginPicker(false)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-violet-500/10"
      >
        <ArrowLeft size={16} />
      </button>

      <div className="min-w-0">
        <div className="text-sm font-semibold">
          Choose a plugin
        </div>

        <div
          className="text-[11px]"
          style={{ color: "var(--app-muted)" }}
        >
          Only plugins enabled on your account appear here.
        </div>
      </div>
    </div>

    {enabledPluginOptions.length ? (
      enabledPluginOptions.map((plugin) => (
        <button
          key={plugin.id}
          type="button"
          role="menuitem"
          onClick={() => selectPlugin(plugin)}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-violet-500/10"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
            {plugin.icon}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
              {plugin.name}
            </span>

            <span
              className="mt-0.5 block text-xs"
              style={{ color: "var(--app-muted)" }}
            >
              {plugin.description}
            </span>
          </span>
        </button>
      ))
    ) : (
      <div
        className="px-3 py-4 text-sm"
        style={{ color: "var(--app-muted)" }}
      >
        No plugins are enabled yet. Enable one in Plugin Studio.

        {onOpenPlugins && (
          <button
            type="button"
            onClick={() => {
              setShowPluginPicker(false);
              setShowToolsMenu(false);
              onOpenPlugins();
            }}
            className="mt-3 block rounded-lg bg-violet-500/10 px-3 py-2 font-semibold text-violet-400"
          >
            Open Plugin Studio
          </button>
        )}
      </div>
    )}
  </>
) : (
  <>
    {/* Keep all the existing message-tools JSX here. */}
  </>
)}

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => openFilePicker(photoInputRef)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-violet-500/10"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                        <ImageIcon size={18} />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">
                          Photos
                        </span>
                        <span
                          className="mt-0.5 block text-xs"
                          style={{ color: "var(--app-muted)" }}
                        >
                          Choose images from device
                        </span>
                      </span>
                    </button>

                    {showThinkHarderToggle && (
                      <button
                        type="button"
                        role="menuitem"
                        aria-pressed={thinkHarderForNextPrompt}
                        onClick={() => onToggleThinkHarderForNextPrompt?.()}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-violet-500/10"
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                            thinkHarderForNextPrompt
                              ? "bg-violet-500/20 text-violet-300"
                              : "bg-violet-500/10 text-violet-400"
                          }`}
                        >
                          <Sparkles size={18} />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">
                            Think Harder
                          </span>

                          <span
                            className="mt-0.5 block text-xs"
                            style={{ color: "var(--app-muted)" }}
                          >
                            Review the full chat and double-check the answer
                          </span>
                        </span>

                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                            thinkHarderForNextPrompt
                              ? "bg-violet-500/20 text-violet-300"
                              : "bg-neutral-500/10 text-neutral-400"
                          }`}
                        >
                          {thinkHarderForNextPrompt ? "ON" : "OFF"}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => openFilePicker(fileInputRef)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-violet-500/10"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500">
                        <Paperclip size={18} />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">
                          Files
                        </span>
                        <span
                          className="mt-0.5 block text-xs"
                          style={{ color: "var(--app-muted)" }}
                        >
                          PDFs, documents, code and more
                        </span>
                      </span>
                    </button>

                    {/* Web Search has intentionally been removed from this menu. */}
                  </div>
                )}
              </div>

              {/* Single quick web-search toggle — remains outside the + menu */}
              <button
                type="button"
                onClick={onToggleSearch}
                aria-pressed={enableSearch}
                className="inline-flex h-10 items-center gap-1.5 rounded-2xl border px-3 text-xs font-semibold transition hover:-translate-y-0.5"
                style={{
                  background: enableSearch
                    ? "var(--app-accent-soft)"
                    : "transparent",
                  borderColor: enableSearch
                    ? "color-mix(in srgb, var(--app-accent) 38%, transparent)"
                    : "var(--app-border)",
                  color: enableSearch
                    ? "var(--app-accent)"
                    : "var(--app-muted)",
                }}
                title={
                  enableSearch ? "Turn web search off" : "Turn web search on"
                }
              >
                <Globe size={15} />
                <span className="hidden min-[390px]:inline">Search</span>
                {enableSearch && (
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                )}
              </button>

              {/* ChatGPT-style Plugin Activator Button & Popover */}
              <div ref={pluginMenuRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowPluginDropdown((prev) => !prev)}
                  aria-expanded={showPluginDropdown}
                  className={`inline-flex h-10 items-center gap-1.5 rounded-2xl border px-3 text-xs font-semibold transition hover:-translate-y-0.5 ${
                    activePluginIds.length > 0
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-neutral-700/60 bg-transparent text-neutral-400 hover:text-neutral-200"
                  }`}
                  title="Activate or deactivate downloaded plugins for this chat"
                >
                  <Puzzle
                    size={15}
                    className={activePluginIds.length > 0 ? "text-emerald-400" : ""}
                  />
                  <span className="hidden min-[420px]:inline">
                    {activePluginIds.length > 0
                      ? `Plugins (${activePluginIds.length})`
                      : "Plugins"}
                  </span>
                  {activePluginIds.length > 0 && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  )}
                </button>

                {showPluginDropdown && (
                  <div
                    role="dialog"
                    aria-label="Active Plugins"
                    className="absolute bottom-full left-0 z-[120] mb-3 w-80 max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border p-3 shadow-2xl backdrop-blur-xl"
                    style={{
                      background: "var(--app-panel)",
                      borderColor: "var(--app-border-strong)",
                      color: "var(--app-text)",
                      boxShadow: "0 24px 70px rgba(0,0,0,0.35)",
                    }}
                  >
                    <div className="mb-2 flex items-center justify-between border-b border-neutral-800/80 pb-2">
                      <div className="flex items-center gap-1.5">
                        <Puzzle size={15} className="text-emerald-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-neutral-200">
                          Active Plugins
                        </span>
                      </div>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                        {activePluginIds.length} active
                      </span>
                    </div>

                    <p className="mb-2.5 text-[11px] leading-4 text-neutral-400">
                      Toggle which downloaded plugins are activated for this conversation:
                    </p>

                    <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                      {downloadedPluginObjects.length > 0 ? (
                        downloadedPluginObjects.map((plugin) => {
                          const isActive = activePluginIds.includes(plugin.id);
                          return (
                            <button
                              key={plugin.id}
                              type="button"
                              onClick={() => togglePluginActive(plugin.id)}
                              className={`flex w-full items-start gap-2.5 rounded-xl p-2 text-left transition ${
                                isActive
                                  ? "bg-emerald-500/10 border border-emerald-500/20"
                                  : "hover:bg-neutral-800/50 border border-transparent"
                              }`}
                            >
                              <div
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                  isActive
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : "bg-neutral-800 text-neutral-400"
                                }`}
                              >
                                {plugin.icon}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-neutral-200">
                                    {plugin.name}
                                  </span>
                                  <span
                                    className={`h-4 w-7 rounded-full transition-colors relative flex items-center px-0.5 ${
                                      isActive ? "bg-emerald-500" : "bg-neutral-700"
                                    }`}
                                  >
                                    <span
                                      className={`h-3 w-3 rounded-full bg-white transition-transform ${
                                        isActive ? "translate-x-3" : "translate-x-0"
                                      }`}
                                    />
                                  </span>
                                </div>
                                <p className="mt-0.5 line-clamp-1 text-[10.5px] text-neutral-400">
                                  {plugin.description}
                                </p>
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="rounded-xl border border-dashed border-neutral-800 p-3 text-center">
                          <p className="text-xs text-neutral-400">
                            No plugins downloaded yet.
                          </p>
                          {onOpenPlugins && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowPluginDropdown(false);
                                onOpenPlugins();
                              }}
                              className="mt-2 inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow"
                            >
                              Open Plugin Store
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {onOpenPlugins && (
                      <div className="mt-2.5 border-t border-neutral-800/80 pt-2 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setShowPluginDropdown(false);
                            onOpenPlugins();
                          }}
                          className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 transition"
                        >
                          Browse & Download More Plugins in Store →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Quick voice-input toggle */}
              {isSupported && (
                <button
                  type="button"
                  onClick={handleToggleVoiceInput}
                  aria-pressed={isListening}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border transition hover:-translate-y-0.5"
                  style={{
                    background: isListening
                      ? "rgba(244,63,94,0.10)"
                      : "transparent",
                    borderColor: isListening
                      ? "rgba(244,63,94,0.25)"
                      : "var(--app-border)",
                    color: isListening ? "#f43f5e" : "var(--app-muted)",
                  }}
                  title={
                    isListening ? "Stop voice input" : "Dictate your message"
                  }
                  aria-label={
                    isListening ? "Stop voice input" : "Dictate your message"
                  }
                >
                  {isListening ? <MicOff size={17} /> : <Mic size={17} />}
                </button>
              )}
            </div>

            {/* Send, open voice chat, or stop generation */}
            <div className="flex shrink-0 items-center gap-2">
              {isStreaming ? (
                <button
                  type="button"
                  onClick={onStopGeneration}
                  disabled={!onStopGeneration}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border px-3.5 text-xs font-bold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    borderColor: "var(--app-border-strong)",
                    background: "var(--app-panel-raised)",
                    color: "var(--app-text)",
                  }}
                  title="Stop response generation"
                  aria-label="Stop response generation"
                >
                  <Square size={13} className="fill-current" />
                  <span className="hidden sm:inline">Stop</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!hasMessage) {
                      onOpenVoiceChat?.();
                    } else {
                      handleSend();
                    }
                  }}
                  disabled={
                    (!hasMessage && !onOpenVoiceChat) ||
                    (hasMessage && !canSubmit)
                  }
                  className="group inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-2xl px-3.5 text-xs font-bold text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-violet-500/20 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    background:
                      "linear-gradient(135deg, #8b5cf6 0%, #6366f1 55%, #4f46e5 100%)",
                    boxShadow: "0 8px 22px rgba(99,102,241,0.24)",
                  }}
                  title={
                    !hasMessage ? "Open voice chat" : "Send message (Enter)"
                  }
                  aria-label={!hasMessage ? "Open voice chat" : "Send message"}
                >
                  {!hasMessage ? (
                    <>
                      <AudioLines size={17} />
                      <span className="hidden sm:inline">Voice</span>
                    </>
                  ) : (
                    <>
                      <span className="hidden sm:inline">Send</span>
                      <ArrowUp size={17} strokeWidth={2.7} />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Composer footer */}
        {showDisclaimer && (
          <div
            className="mt-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-1 text-center text-[10px] leading-relaxed sm:text-[11px]"
            style={{ color: "var(--app-subtle)" }}
          >
            <span>Martins AI can make mistakes. Verify important details.</span>
            <span className="hidden opacity-60 sm:inline">·</span>
            <span className="hidden sm:inline">
              Enter to send · Shift + Enter for a new line
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
