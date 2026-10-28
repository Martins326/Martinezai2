import React, { useEffect, useRef, useState } from "react";

import type { Message, Attachment, PluginInvocation } from "../types";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ChatComposer } from "./ChatComposer";

import {
  Copy,
  Check,
  RotateCcw,
  Volume2,
  Volume1,
  LoaderCircle,
  ThumbsUp,
  ThumbsDown,
  Pencil,
  Sparkles,
  FileText,
  ExternalLink,
  X,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Puzzle,
} from "lucide-react";

/**
 * ChatGPT-style Plugin Invocation Card.
 * Displays real-time status and expandable request/response inspection.
 */
const PluginInvocationCard: React.FC<{
  invocation: PluginInvocation;
}> = ({ invocation }) => {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"request" | "response">("response");
  const [copied, setCopied] = useState(false);

  const isRunning = invocation.status === "running";
  const isError = invocation.status === "error";

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const payload = activeTab === "request" ? invocation.request : (invocation.response || {});
  const jsonStr = JSON.stringify(payload, null, 2);

  return (
    <div className="my-2.5 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/80 text-xs shadow-sm transition-all">
      <div
        className={`flex items-center justify-between px-3.5 py-2.5 select-none ${
          !isRunning ? "cursor-pointer hover:bg-neutral-800/60" : ""
        }`}
        onClick={() => !isRunning && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
            {isRunning ? (
              <LoaderCircle size={14} className="animate-spin text-emerald-400" />
            ) : isError ? (
              <AlertCircle size={14} className="text-rose-400" />
            ) : (
              <Puzzle size={14} className="text-emerald-400" />
            )}
          </div>
          <div className="flex items-center gap-2 font-medium">
            <span className="text-neutral-200">
              {isRunning
                ? `Using ${invocation.pluginName}...`
                : isError
                ? `Failed using ${invocation.pluginName}`
                : `Used ${invocation.pluginName}`}
            </span>
            {invocation.action && (
              <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400 font-mono">
                {invocation.action}
              </span>
            )}
          </div>
        </div>

        {!isRunning && (
          <div className="flex items-center gap-2 text-neutral-400">
            <span className="text-[11px] text-neutral-500">
              {expanded ? "Hide details" : "Show details"}
            </span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        )}
      </div>

      {expanded && !isRunning && (
        <div className="border-t border-neutral-800/80 bg-neutral-950/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1 rounded-lg bg-neutral-900 p-0.5 border border-neutral-800">
              <button
                type="button"
                onClick={() => setActiveTab("response")}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  activeTab === "response"
                    ? "bg-neutral-800 text-white shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                Response
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("request")}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  activeTab === "request"
                    ? "bg-neutral-800 text-white shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                Request
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleCopy(jsonStr)}
              className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-200"
              title="Copy JSON"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>

          <pre className="max-h-56 overflow-auto rounded-lg border border-neutral-800/80 bg-neutral-950 p-2.5 font-mono text-[11.5px] leading-5 text-emerald-300/90">
            {jsonStr}
          </pre>
        </div>
      )}
    </div>
  );
};

interface ChatMessageProps {
  message: Message;
  messageIndex?: number;
  isStreaming?: boolean;

  onRegenerate?: (messageId: string) => void;

  onEditAndResend?: (
    messageId: string,
    newContent: string,
    attachments: Attachment[],
    messageIndex?: number,
    enableSearch?: boolean,
  ) => void;

  enableSearch?: boolean;
  onToggleSearch?: () => void;

  onFeedback?: (messageId: string, feedback: "like" | "dislike") => void;

  onOpenArtifact?: (code: string, language: string, title?: string) => void;

  isSpeaking?: boolean;
  isLoadingSpeech?: boolean;
  isPaused?: boolean;

  onToggleSpeech?: (messageId: string, text: string) => void;
}

const formatMessageTime = (timestamp: number): string => {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatAttachmentSize = (size: number): string => {
  if (!Number.isFinite(size) || size < 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const actionButtonClass =
  "inline-flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-xl border border-transparent px-2.5 text-neutral-400 transition-colors hover:border-neutral-700/80 hover:bg-neutral-800/80 hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/80";

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isStreaming = false,
  onRegenerate,
  onEditAndResend,
  onFeedback,
  onOpenArtifact,
  isSpeaking = false,
  isLoadingSpeech = false,
  messageIndex,
  isPaused = false,
  onToggleSpeech,
  enableSearch = false,
  onToggleSearch,
}) => {
  const isUser = message.role === "user";
  const timestampText = formatMessageTime(message.timestamp);

  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isCopied, setIsCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [editContent, setEditContent] = useState(message.content);
  const [editAttachments, setEditAttachments] = useState<Attachment[]>(
    message.attachments || [],
  );

  const [editSearchEnabled, setEditSearchEnabled] = useState(enableSearch);

  // Keep the edit draft aligned if this message is updated
  // outside the editor.
  useEffect(() => {
    if (!isEditing) {
      setEditContent(message.content);
    }
  }, [message.content, isEditing]);

  // Avoid leaving a copy-feedback timer running after unmount.
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);

      setIsCopied(true);

      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }

      copyTimeoutRef.current = setTimeout(() => {
        setIsCopied(false);
        copyTimeoutRef.current = null;
      }, 2000);
    } catch (error) {
      console.error("Could not copy the response:", error);
    }
  };

  const handleStartEdit = () => {
    setEditContent(message.content);
    setEditAttachments(message.attachments || []);
    setEditSearchEnabled(enableSearch);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setEditAttachments(message.attachments || []);
    setEditSearchEnabled(enableSearch);
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    const editedText = editContent.trim();

    if ((!editedText && editAttachments.length === 0) || !onEditAndResend) {
      return;
    }

    onEditAndResend(
      message.id,
      editedText,
      editAttachments,
      messageIndex,
      editSearchEnabled,
    );

    setIsEditing(false);
  };

  const handleEditKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      handleCancelEdit();
    }

    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleSaveEdit();
    }
  };

  const messageLabel = isUser ? "Your message" : "Martins AI response";

  return (
    <article
      className="martinez-chat-message group/message w-full px-3 py-3.5 sm:px-4 md:px-6 md:py-4"
      aria-label={messageLabel}
    >
      <div
        className={`mx-auto flex w-full max-w-4xl items-start gap-2.5 sm:gap-3.5 ${
          isUser ? "justify-end" : "justify-start"
        }`}
      >
        {/* Assistant identity stays separate from response content. */}
        {!isUser && (
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/20 to-violet-500/10 text-indigo-300 shadow-sm shadow-indigo-950/20 sm:h-9 sm:w-9">
            <Sparkles size={17} strokeWidth={1.8} aria-hidden="true" />
          </div>
        )}

        <div
          className={`min-w-0 ${
            isUser
              ? "ml-auto w-fit max-w-[94%] sm:max-w-[84%]"
              : "flex-1 space-y-2.5 pt-0.5"
          }`}
        >
          {/* Message header */}
          <div
            className={`mb-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs ${
              isUser ? "justify-end" : "justify-between"
            }`}
          >
            <div
              className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 ${
                isUser ? "justify-end" : ""
              }`}
            >
              <span
                className={`font-semibold tracking-[-0.01em] ${
                  isUser ? "text-emerald-100/90" : "text-neutral-200"
                }`}
              >
                {isUser ? "You" : "Martins AI"}
              </span>

              {timestampText && (
                <time
                  dateTime={new Date(message.timestamp).toISOString()}
                  className="text-[10px] tabular-nums text-neutral-500"
                  title={new Date(message.timestamp).toLocaleString()}
                >
                  {timestampText}
                </time>
              )}

              {isUser && message.thinkHarder && (
                <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/25 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-300">
                  <Sparkles size={11} aria-hidden="true" />
                  Think Harder
                </span>
              )}
              {message.mode && !isUser && (
                <span className="rounded-full border border-neutral-800 bg-neutral-900/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.09em] text-neutral-500">
                  {message.mode}
                </span>
              )}

              {message.error && !isUser && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/[0.07] px-2 py-0.5 text-[10px] font-medium text-amber-300">
                  <AlertCircle size={11} aria-hidden="true" />
                  Needs attention
                </span>
              )}
            </div>

            {/* Existing user-message editing functionality. */}
            {isUser && !isEditing && onEditAndResend && (
              <button
                type="button"
                onClick={handleStartEdit}
                className="inline-flex min-h-8 min-w-8 items-center justify-center gap-1.5 rounded-lg px-2 text-emerald-100/55 transition-colors hover:bg-emerald-900/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 sm:opacity-0 sm:group-hover/message:opacity-100 sm:focus-visible:opacity-100"
                title="Edit message"
                aria-label="Edit your message"
              >
                <Pencil size={13} aria-hidden="true" />

                <span className="hidden text-[11px] sm:inline">Edit</span>
              </button>
            )}
          </div>

          {/* User message bubble / assistant response surface */}
          <div
            className={
              isUser
                ? "rounded-2xl rounded-br-md border border-emerald-700/30 bg-emerald-950/35 px-3.5 py-3 text-emerald-50/95 shadow-sm shadow-black/10 sm:px-4"
                : "min-w-0"
            }
          >
            {/* Message attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <div
                className={`flex flex-wrap gap-2 ${
                  message.content ? "mb-3" : ""
                }`}
                aria-label="Message attachments"
              >
                {message.attachments.map((attachment: Attachment) => {
                  const isImage = attachment.mimeType.startsWith("image/");

                  const formattedSize = formatAttachmentSize(attachment.size);

                  return (
                    <div
                      key={attachment.id}
                      className="flex max-w-full items-center gap-2 rounded-xl border border-neutral-700/70 bg-neutral-900/75 px-2.5 py-2 text-xs text-neutral-200"
                    >
                      {isImage ? (
                        <img
                          src={`data:${attachment.mimeType};base64,${attachment.data}`}
                          alt={attachment.name}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          className="h-9 w-9 shrink-0 rounded-lg border border-neutral-700 object-cover sm:h-10 sm:w-10"
                        />
                      ) : (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-400/10 bg-indigo-500/10 text-indigo-300 sm:h-10 sm:w-10">
                          <FileText size={17} aria-hidden="true" />
                        </span>
                      )}

                      <span className="min-w-0 flex-1">
                        <span
                          className="block max-w-[180px] truncate font-medium text-neutral-200 sm:max-w-[240px]"
                          title={attachment.name}
                        >
                          {attachment.name}
                        </span>

                        {formattedSize && (
                          <span className="mt-0.5 block text-[10px] text-neutral-500">
                            {formattedSize}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Message text or editing interface */}
            {isEditing ? (
              <div className="w-full min-w-0 space-y-3">
                <div className="rounded-2xl border border-indigo-500/30 bg-neutral-950/50 p-2">
                  <ChatComposer
                    key={message.id}
                    onSendMessage={(text, newAttachments) => {
                      const editedText = text.trim();

                      if (
                        (!editedText && newAttachments.length === 0) ||
                        !onEditAndResend
                      ) {
                        return;
                      }

                      onEditAndResend(
                        message.id,
                        editedText,
                        newAttachments,
                        messageIndex,
                        editSearchEnabled,
                      );

                      setIsEditing(false);
                    }}
                    isStreaming={isStreaming}
                    enableSearch={editSearchEnabled}
                    onToggleSearch={() => {
                      setEditSearchEnabled((previous) => !previous);
                    }}
                    placeholder="Edit your message..."
                    showDisclaimer={false}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <span className="text-[10px] text-neutral-500">
                    Edit your message, add attachments, or change Web Search.
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-neutral-700 px-3 text-xs font-medium text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
                    >
                      <X size={13} />
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className={`break-words text-[14.5px] leading-7 ${
                  isUser ? "text-emerald-50/95" : "text-neutral-200"
                }`}
              >
                {isUser ? (
                  <div className="whitespace-pre-wrap break-words">
                    {message.content}
                  </div>
                ) : (
                  <>
                    {/* ChatGPT-style Plugin Invocations */}
                    {message.pluginInvocations && message.pluginInvocations.length > 0 && (
                      <div className="mb-3 space-y-1.5" aria-label="Plugin execution cards">
                        {message.pluginInvocations.map((inv) => (
                          <PluginInvocationCard key={inv.callId} invocation={inv} />
                        ))}
                      </div>
                    )}

                    <MarkdownRenderer
                      content={message.content}
                      onOpenArtifact={onOpenArtifact}
                    />
                  </>
                )}

                {/* Preserve the live-response cursor during streaming. */}
                {isStreaming && (
                  <span
                    className="ml-1 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-indigo-400 align-middle"
                    aria-label="Response is being generated"
                  />
                )}
              </div>
            )}
          </div>

          {/* Grounding and research sources */}
          {message.groundingSources && message.groundingSources.length > 0 && (
            <section
              className="mt-4 border-t border-neutral-800/70 pt-3"
              aria-label="Web grounding sources"
            >
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500 sm:text-[11px]">
                <ExternalLink size={13} aria-hidden="true" />

                <span>Sources</span>

                <span className="rounded-full bg-neutral-800/80 px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-neutral-400">
                  {message.groundingSources.length}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {message.groundingSources.map((source, index) => (
                  <a
                    key={`${source.uri}-${index}`}
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/source inline-flex min-h-8 max-w-full items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/55 px-2.5 py-1.5 text-xs text-neutral-300 transition-colors hover:border-indigo-400/25 hover:bg-neutral-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/80"
                    title={source.title || source.uri}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-neutral-800 text-[10px] font-semibold text-neutral-400 group-hover/source:bg-indigo-500/10 group-hover/source:text-indigo-300">
                      {index + 1}
                    </span>

                    <span className="max-w-[220px] truncate sm:max-w-[280px]">
                      {source.title || source.uri}
                    </span>

                    <ExternalLink
                      size={11}
                      className="shrink-0 text-neutral-500 group-hover/source:text-indigo-300"
                      aria-hidden="true"
                    />
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Assistant actions */}
          {!isUser && !isStreaming && !isEditing && (
            <div
              className="mt-2 flex flex-wrap items-center gap-1 border-t border-neutral-800/50 pt-2 text-xs sm:border-t-0 sm:pt-1"
              role="group"
              aria-label="Assistant response actions"
            >
              {/* Copy response */}
              <button
                type="button"
                onClick={() => void handleCopy()}
                className={`${actionButtonClass} ${
                  isCopied
                    ? "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-300"
                    : ""
                }`}
                title={isCopied ? "Response copied" : "Copy response"}
                aria-label={isCopied ? "Response copied" : "Copy response"}
                aria-live="polite"
              >
                {isCopied ? (
                  <CheckCircle2 size={14} aria-hidden="true" />
                ) : (
                  <Copy size={14} aria-hidden="true" />
                )}

                <span className="hidden sm:inline">
                  {isCopied ? "Copied" : "Copy"}
                </span>
              </button>

              {/* Read aloud, pause, and resume */}
              {onToggleSpeech && (
                <button
                  type="button"
                  onClick={() => onToggleSpeech(message.id, message.content)}
                  className={`${actionButtonClass} ${
                    isSpeaking || isLoadingSpeech
                      ? "border-indigo-400/20 bg-indigo-500/10 text-indigo-300"
                      : ""
                  }`}
                  title={
                    isLoadingSpeech
                      ? "Preparing audio — tap to cancel"
                      : isSpeaking
                        ? isPaused
                          ? "Resume reading"
                          : "Pause reading"
                        : "Read aloud"
                  }
                  aria-label={
                    isLoadingSpeech
                      ? "Preparing response audio, tap to cancel"
                      : isSpeaking
                        ? isPaused
                          ? "Resume reading response"
                          : "Pause reading response"
                        : "Read response aloud"
                  }
                  aria-pressed={isSpeaking && !isPaused}
                  aria-busy={isLoadingSpeech}
                >
                  {isLoadingSpeech ? (
                    <LoaderCircle
                      size={14}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                  ) : isSpeaking ? (
                    isPaused ? (
                      <Volume1 size={14} aria-hidden="true" />
                    ) : (
                      <Volume2
                        size={14}
                        className="animate-pulse"
                        aria-hidden="true"
                      />
                    )
                  ) : (
                    <Volume2 size={14} aria-hidden="true" />
                  )}

                  <span className="hidden sm:inline">
                    {isLoadingSpeech
                      ? "Loading audio…"
                      : isSpeaking
                        ? isPaused
                          ? "Resume"
                          : "Pause"
                        : "Read aloud"}
                  </span>
                </button>
              )}

              {/* Regenerate response */}
              {onRegenerate && (
                <button
                  type="button"
                  onClick={() => onRegenerate(message.id)}
                  className={actionButtonClass}
                  title="Regenerate response"
                  aria-label="Regenerate response"
                >
                  <RotateCcw size={14} aria-hidden="true" />

                  <span className="hidden sm:inline">Regenerate</span>
                </button>
              )}

              {/* Preserve both feedback actions and current selections. */}
              {onFeedback && (
                <>
                  <span
                    className="mx-1 hidden h-4 w-px bg-neutral-800 sm:block"
                    aria-hidden="true"
                  />

                  <button
                    type="button"
                    onClick={() => onFeedback(message.id, "like")}
                    className={`${actionButtonClass} ${
                      message.feedback === "like"
                        ? "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-300"
                        : ""
                    }`}
                    title="Helpful response"
                    aria-label="Mark response helpful"
                    aria-pressed={message.feedback === "like"}
                  >
                    <ThumbsUp size={14} aria-hidden="true" />

                    <span className="hidden sm:inline">Helpful</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onFeedback(message.id, "dislike")}
                    className={`${actionButtonClass} ${
                      message.feedback === "dislike"
                        ? "border-rose-500/20 bg-rose-500/[0.07] text-rose-300"
                        : ""
                    }`}
                    title="Needs improvement"
                    aria-label="Mark response unhelpful"
                    aria-pressed={message.feedback === "dislike"}
                  >
                    <ThumbsDown size={14} aria-hidden="true" />

                    <span className="hidden sm:inline">Not helpful</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
};
