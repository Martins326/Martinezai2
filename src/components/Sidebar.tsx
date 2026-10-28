import React, { useState, useMemo, useEffect, useRef } from "react";

import type { Conversation } from "../types";

import {
  Plus,
  Search,
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  Trash2,
  Edit2,
  Download,
  Check,
  X,
  MessageSquare,
  Sparkles,
  ChevronRight,
  PanelLeftClose,
  MoreVertical,
  UserRound,
  BadgeCheck,
  Images,
  Library,
  Folder,
  Clock3,
  Plug,
  BrainCircuit,
} from "lucide-react";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onDeleteConversation: (id: string) => void;
  onTogglePin: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onExportConversation: (
    conv: Conversation,
    format: "markdown" | "json",
  ) => void;
  onClearAll: () => void;
  showArchived: boolean;
  onToggleArchived: () => void;
  isOpen: boolean;
  onClose: () => void;

  accountName: string;
  accountEmail: string;
  emailVerified: boolean;
  onOpenAccount: () => void;
  onOpenImages: () => void;
  onOpenLibrary: () => void;
  onOpenProjects: () => void;
  onOpenScheduled: () => void;
  onOpenPlugins: () => void;
  onOpenSimulation: () => void;
  accountHasProfilePicture?: boolean;
  accountProfilePictureUpdatedAt?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeId,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
  onTogglePin,
  onToggleArchive,
  onExportConversation,
  onClearAll,
  showArchived,
  onToggleArchived,
  isOpen,
  onClose,
  accountName,
  accountEmail,
  emailVerified,
  onOpenAccount,
  onOpenImages,
  onOpenLibrary,
  onOpenProjects,
  onOpenScheduled,
  onOpenPlugins,
  onOpenSimulation,
  accountHasProfilePicture,
  accountProfilePictureUpdatedAt,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Project conversations are only listed inside their own project,
  // except when searching across all conversations.
  const filteredConversations = useMemo(() => {
    return conversations.filter((conversation) => {
      if (conversation.projectId && !searchQuery.trim()) {
        return false;
      }

      if (showArchived ? !conversation.isArchived : conversation.isArchived) {
        return false;
      }

      if (!searchQuery.trim()) {
        return true;
      }

      const query = searchQuery.trim().toLowerCase();

      const titleMatch = conversation.title.toLowerCase().includes(query);

      const messageMatch = conversation.messages.some((message) =>
        message.content.toLowerCase().includes(query),
      );

      return titleMatch || messageMatch;
    });
  }, [conversations, showArchived, searchQuery]);

  // Cmd/Ctrl+K focuses conversation search from anywhere in the app.
  // Escape clears and blurs the search field when it is focused.
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }

      if (
        event.key === "Escape" &&
        document.activeElement === searchInputRef.current
      ) {
        setSearchQuery("");
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", handleShortcut);

    return () => {
      window.removeEventListener("keydown", handleShortcut);
    };
  }, []);

  // Group ordinary conversations by date.
  const { pinned, today, yesterday, previous7Days, older } = useMemo(() => {
    const oneDay = 24 * 60 * 60 * 1000;
    const startOfToday = new Date().setHours(0, 0, 0, 0);

    const pinnedList: Conversation[] = [];
    const todayList: Conversation[] = [];
    const yesterdayList: Conversation[] = [];
    const previousList: Conversation[] = [];
    const olderList: Conversation[] = [];

    for (const conversation of filteredConversations) {
      if (conversation.isPinned && !showArchived) {
        pinnedList.push(conversation);
        continue;
      }

      const updated = conversation.updatedAt || conversation.createdAt;

      if (updated >= startOfToday) {
        todayList.push(conversation);
      } else if (updated >= startOfToday - oneDay) {
        yesterdayList.push(conversation);
      } else if (updated >= startOfToday - 7 * oneDay) {
        previousList.push(conversation);
      } else {
        olderList.push(conversation);
      }
    }

    return {
      pinned: pinnedList,
      today: todayList,
      yesterday: yesterdayList,
      previous7Days: previousList,
      older: olderList,
    };
  }, [filteredConversations, showArchived]);

  // Start renaming a conversation without selecting it.
  const handleStartRename = (conversation: Conversation) => {
    setEditingId(conversation.id);
    setEditTitle(conversation.title);
    setActiveMenuId(null);
  };

  // Save a renamed conversation and close its inline editor.
  const handleSaveRename = (id: string) => {
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }

    setEditingId(null);
  };

  // Render a single conversation row with its complete action menu.
  const renderConversationItem = (conversation: Conversation) => {
    const isActive = conversation.id === activeId;
    const isEditing = conversation.id === editingId;
    const isMenuOpen = conversation.id === activeMenuId;

    return (
      <div
        key={conversation.id}
        role="button"
        tabIndex={isEditing ? -1 : 0}
        aria-current={isActive ? "page" : undefined}
        aria-label={`Open conversation: ${conversation.title}`}
        className={`martinez-sidebar-conversation group relative flex min-h-10 items-center gap-2 rounded-xl border px-2.5 py-2 text-xs transition-all duration-150 cursor-pointer ${
          isActive
            ? "bg-indigo-500/10 text-white font-medium ring-1 ring-inset ring-indigo-400/15"
            : "text-neutral-300 hover:bg-neutral-800/60 hover:text-white"
        }`}
        onClick={() => {
          if (!isEditing) {
            onSelectConversation(conversation.id);

            if (window.innerWidth < 768) {
              onClose();
            }
          }
        }}
        onKeyDown={(event) => {
          if (!isEditing && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            onSelectConversation(conversation.id);

            if (window.innerWidth < 768) {
              onClose();
            }
          }
        }}
      >
        <MessageSquare
          size={14}
          aria-hidden="true"
          className="shrink-0 text-neutral-400 transition-colors group-hover:text-indigo-400"
        />

        {isEditing ? (
          <div
            className="flex min-w-0 flex-1 items-center gap-1"
            onClick={(event) => event.stopPropagation()}
          >
            <input
              type="text"
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSaveRename(conversation.id);
                }

                if (event.key === "Escape") {
                  event.preventDefault();
                  setEditingId(null);
                }
              }}
              autoFocus
              aria-label="Edit conversation title"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />

            <button
              type="button"
              onClick={() => handleSaveRename(conversation.id)}
              className="rounded-md p-1.5 text-emerald-400 transition-colors hover:bg-emerald-500/10 hover:text-emerald-300"
              aria-label="Save conversation title"
              title="Save title"
            >
              <Check size={13} />
            </button>

            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
              aria-label="Cancel renaming"
              title="Cancel"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <span className="block truncate leading-5">
              {conversation.title}
            </span>

            {searchQuery.trim() &&
              (() => {
                const query = searchQuery.trim().toLowerCase();

                const match = conversation.messages.find((message) =>
                  message.content.toLowerCase().includes(query),
                );

                if (!match) return null;

                const content = match.content.replace(/\s+/g, " ").trim();
                const index = content.toLowerCase().indexOf(query);
                const start = Math.max(0, index - 35);
                const end = index + query.length + 65;

                const snippet =
                  `${start > 0 ? "…" : ""}` +
                  content.slice(start, end) +
                  `${end < content.length ? "…" : ""}`;

                return (
                  <span className="mt-1 block truncate text-[10px] font-normal text-neutral-500">
                    {match.role === "user" ? "You: " : "AI: "}
                    {snippet}
                  </span>
                );
              })()}

            {searchQuery.trim() && conversation.projectId && (
              <span className="mt-0.5 block text-[10px] font-medium text-indigo-400">
                Project conversation
              </span>
            )}
          </div>
        )}

        {conversation.isPinned && !isEditing && (
          <Pin
            size={11}
            aria-label="Pinned conversation"
            className="shrink-0 rotate-45 text-indigo-400"
          />
        )}

        {!isEditing && (
          <div
            className="relative shrink-0"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() =>
                setActiveMenuId(isMenuOpen ? null : conversation.id)
              }
              className="rounded-lg p-1.5 text-neutral-500 opacity-100 transition-all hover:bg-neutral-700 hover:text-white focus:opacity-100 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
              title="Conversation options"
              aria-label={`Options for ${conversation.title}`}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
            >
              <MoreVertical size={14} />
            </button>

            {isMenuOpen && (
              <div
                role="menu"
                aria-label={`Actions for ${conversation.title}`}
                className="martinez-sidebar-conversation-menu absolute right-0 top-full z-[70] mt-1 w-44 space-y-0.5 rounded-xl border border-neutral-800 bg-neutral-900 p-1 shadow-2xl backdrop-blur-xl"
                onMouseLeave={() => setActiveMenuId(null)}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleStartRename(conversation)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
                >
                  <Edit2 size={13} />
                  <span>Rename</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onTogglePin(conversation.id);
                    setActiveMenuId(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
                >
                  {conversation.isPinned ? (
                    <PinOff size={13} />
                  ) : (
                    <Pin size={13} />
                  )}

                  <span>{conversation.isPinned ? "Unpin" : "Pin"}</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onToggleArchive(conversation.id);
                    setActiveMenuId(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
                >
                  {conversation.isArchived ? (
                    <ArchiveRestore size={13} />
                  ) : (
                    <Archive size={13} />
                  )}

                  <span>{conversation.isArchived ? "Restore" : "Archive"}</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onExportConversation(conversation, "markdown");
                    setActiveMenuId(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
                >
                  <Download size={13} />
                  <span>Export Markdown</span>
                </button>

                <div className="my-1 h-px bg-neutral-800" role="separator" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onDeleteConversation(conversation.id);
                    setActiveMenuId(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-rose-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                >
                  <Trash2 size={13} />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render the date-group label and its conversations.
  const renderConversationGroup = (label: string, items: Conversation[]) => {
    if (items.length === 0) {
      return null;
    }

    return (
      <section
        key={label}
        className="martinez-sidebar-history-group space-y-1"
        aria-label={label}
      >
        <h3 className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">
          {label}
        </h3>

        {items.map(renderConversationItem)}
      </section>
    );
  };

  return (
    <>
      {/* Mobile backdrop: tapping outside closes the sidebar. */}
      {isOpen && (
        <div
          className="martinez-sidebar-backdrop fixed inset-0 z-40 bg-black/65 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Primary navigation sidebar. */}
      <aside
        id="martinez-conversation-sidebar"
        aria-label="Conversation navigation"
        aria-hidden={
          !isOpen && typeof window !== "undefined" && window.innerWidth < 768
        }
        className={`martinez-sidebar-shell fixed inset-y-0 left-0 z-50 flex w-[17.5rem] shrink-0 flex-col border-r transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand and mobile close button. */}
        <div className="martinez-sidebar-brand-row flex shrink-0 items-center justify-between border-b px-4 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="martinez-sidebar-brand-mark flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white">
              <Sparkles size={17} aria-hidden="true" />
            </div>

            <div className="min-w-0">
              <div className="text-sm font-bold leading-none tracking-tight text-white">
                Martins AI
              </div>

              <div className="mt-1 text-[10px] tracking-wide text-neutral-500">
                Your AI. Your Ideas.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 md:hidden"
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        {/* Primary creation action. */}
        <div className="shrink-0 px-3 pb-3 pt-3.5">
          <button
            type="button"
            onClick={() => {
              onNewConversation();

              if (window.innerWidth < 768) {
                onClose();
              }
            }}
            className="martinez-sidebar-new-chat flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-neutral-100 transition-all duration-150 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
          >
            <Plus size={16} aria-hidden="true" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Search conversations by title or message content. */}
        <div className="shrink-0 px-3 pb-3">
          <div className="martinez-sidebar-search relative rounded-xl border border-neutral-800/80 bg-neutral-900/70 transition-all">
            <Search
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
            />

            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search all chats... (Ctrl K)"
              aria-label="Search all conversations"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl bg-transparent py-3 pl-8 pr-8 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none"
            />

            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
                aria-label="Clear conversation search"
                title="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Workspace destinations. All original navigation callbacks remain. */}
        <nav
          className="martinez-sidebar-navigation shrink-0 px-3 pb-3"
          aria-label="Workspace"
        >
          <div className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">
            Workspace
          </div>

          <button
            type="button"
            onClick={() => {
              onOpenImages();
              if (window.innerWidth < 768) onClose();
            }}
            className="martinez-sidebar-nav-item flex min-h-10 w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-neutral-200 transition-all duration-150 hover:bg-neutral-800/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
          >
            <Images size={18} aria-hidden="true" />
            <span>Images</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenLibrary();
              if (window.innerWidth < 768) onClose();
            }}
            className="martinez-sidebar-nav-item flex min-h-10 w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-neutral-200 transition-all duration-150 hover:bg-neutral-800/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
          >
            <Library size={18} aria-hidden="true" />
            <span>Library</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenProjects();
              if (window.innerWidth < 768) onClose();
            }}
            className="martinez-sidebar-nav-item flex min-h-10 w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-neutral-200 transition-all duration-150 hover:bg-neutral-800/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
          >
            <Folder size={18} aria-hidden="true" />
            <span>Projects</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenScheduled();
              if (window.innerWidth < 768) onClose();
            }}
            className="martinez-sidebar-nav-item flex min-h-10 w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-neutral-200 transition-all duration-150 hover:bg-neutral-800/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
          >
            <Clock3 size={18} aria-hidden="true" />
            <span>Scheduled</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenPlugins();
              if (window.innerWidth < 768) onClose();
            }}
            className="martinez-sidebar-nav-item flex min-h-10 w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-neutral-200 transition-all duration-150 hover:bg-neutral-800/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
          >
            <Plug size={18} aria-hidden="true" />
            <span>Plugins</span>
          </button>


                    <button
            type="button"
            onClick={() => {
              onOpenSimulation();
              if (window.innerWidth < 768) onClose();
            }}
            className="martinez-sidebar-nav-item flex min-h-10 w-full items-center gap-3 rounded-xl border border-indigo-400/20 bg-indigo-500/10 px-3 py-2.5 text-sm font-medium text-indigo-200 transition-all duration-150 hover:bg-indigo-500/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
          >
            <BrainCircuit size={18} aria-hidden="true" />
            <span>Simulation Studio</span>
            <span className="ml-auto rounded-full border border-indigo-300/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-indigo-300">
              New
            </span>
          </button>

          <div className="mt-4 border-t border-neutral-800/80" />
        </nav>

        {/* Scrollable conversation history. */}
        <div className="martinez-sidebar-history min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-2.5 py-4">
          {filteredConversations.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-500">
                {searchQuery ? (
                  <Search size={17} aria-hidden="true" />
                ) : (
                  <MessageSquare size={17} aria-hidden="true" />
                )}
              </div>

              <p className="text-xs font-medium text-neutral-300">
                {searchQuery
                  ? "No matching conversations"
                  : showArchived
                    ? "No archived conversations"
                    : "No recent conversations"}
              </p>

              <p className="mt-1 text-[10px] leading-relaxed text-neutral-500">
                {searchQuery
                  ? "Try another search term."
                  : showArchived
                    ? "Archived chats will appear here."
                    : "Start a new chat to begin a conversation."}
              </p>
            </div>
          ) : (
            <>
              {renderConversationGroup("Pinned", pinned)}
              {renderConversationGroup("Today", today)}
              {renderConversationGroup("Yesterday", yesterday)}
              {renderConversationGroup("Previous 7 Days", previous7Days)}
              {renderConversationGroup("Older", older)}
            </>
          )}
        </div>

        {/* Desktop-only history utilities. */}
        <div className="martinez-sidebar-utility hidden space-y-1 border-t border-neutral-900/80 bg-neutral-950/70 p-3 md:block">
          <button
            type="button"
            onClick={onToggleArchived}
            className="flex min-h-10 w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs text-neutral-400 transition-colors hover:bg-neutral-900 hover:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
            aria-pressed={showArchived}
          >
            <span className="flex items-center gap-2">
              <Archive size={14} aria-hidden="true" />

              <span>
                {showArchived ? "View Active Chats" : "Archived Chats"}
              </span>
            </span>

            {showArchived && (
              <span className="text-[10px] font-medium text-indigo-400">
                Viewing
              </span>
            )}
          </button>

          {conversations.some((conversation) => !conversation.projectId) && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="flex min-h-10 w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs text-rose-400/80 transition-colors hover:bg-rose-500/10 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70"
            >
              <Trash2 size={14} aria-hidden="true" />
              <span>Clear Recent Chats</span>
            </button>
          )}
        </div>

        {/* Account and settings entry point. */}
        <div className="martinez-sidebar-footer border-t border-neutral-900/80 bg-neutral-950/70 p-3">
          <button
            type="button"
            onClick={() => {
              onOpenAccount();
              if (window.innerWidth < 768) onClose();
            }}
            className="martinez-sidebar-account group flex w-full items-center gap-3 rounded-2xl border p-3 text-left shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70"
            aria-label="Open account and settings"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-lg shadow-indigo-950/40">
              {accountHasProfilePicture ? (
                <img
                  src={`/api/auth/profile-picture?v=${accountProfilePictureUpdatedAt || 0}`}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                accountName.trim().charAt(0).toUpperCase() || (
                  <UserRound size={17} aria-hidden="true" />
                )
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="block truncate text-xs font-semibold text-neutral-100">
                  {accountName || "My account"}
                </span>

                {emailVerified && (
                  <BadgeCheck
                    size={13}
                    aria-label="Email verified"
                    className="shrink-0 text-emerald-400"
                  />
                )}
              </span>

              <span className="mt-1 block truncate text-[10px] text-neutral-400">
                {accountEmail}
              </span>

              <span
                className={`mt-1 block text-[10px] ${
                  emailVerified ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {emailVerified ? "Email verified" : "Email not verified"}
              </span>
            </span>

            <ChevronRight
              size={15}
              aria-hidden="true"
              className="shrink-0 text-neutral-500 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-300"
            />
          </button>
        </div>
      </aside>

      {/* Confirm before clearing recent non-project conversations. */}
      {showClearConfirm && (
        <div
          className="martinez-sidebar-confirm-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowClearConfirm(false);
            }
          }}
        >
          <div
            className="martinez-sidebar-confirm-panel w-full max-w-sm space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5 shadow-2xl"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="martinez-clear-chats-title"
            aria-describedby="martinez-clear-chats-description"
          >
            <div className="flex items-center gap-3 text-rose-400">
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-2">
                <Trash2 size={20} aria-hidden="true" />
              </div>

              <h3
                id="martinez-clear-chats-title"
                className="text-sm font-semibold text-white"
              >
                Delete Recent Chats?
              </h3>
            </div>

            <p
              id="martinez-clear-chats-description"
              className="text-xs leading-relaxed text-neutral-400"
            >
              This will permanently delete recent conversations. Project
              conversations will stay inside their projects. This action cannot
              be undone.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="rounded-lg px-3 py-2 text-xs font-medium text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  onClearAll();
                  setShowClearConfirm(false);
                }}
                className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                Delete Recent Chats
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
