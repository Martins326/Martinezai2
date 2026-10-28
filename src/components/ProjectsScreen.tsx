import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Folder,
  Plus,
  MessageSquare,
  Pencil,
  Trash2,
  Check,
  X,
  Sparkles,
  Save,
  FileText,
  Settings2,
  Clock3,
  MessagesSquare,
  ArrowUpRight,
} from "lucide-react";

import type { Project, Conversation } from "../types";

interface ProjectsScreenProps {
  projects: Project[];
  conversations: Conversation[];
  activeConversation: Conversation | null;
  renderConversationContent: React.ReactNode;
  isLight: boolean;
  onCreateProject: (project: Project) => void;
  onRenameProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
  onCreateProjectChat: (projectId: string) => string;
  onOpenConversation: (id: string) => void;
  onBackToChat: () => void;
}

export const ProjectsScreen: React.FC<ProjectsScreenProps> = ({
  projects,
  conversations,
  activeConversation,
  renderConversationContent,
  isLight,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
  onCreateProjectChat,
  onOpenConversation,
  onBackToChat,
}) => {
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newInstructions, setNewInstructions] = useState("");

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );

  const [editingProjectId, setEditingProjectId] = useState<string | null>(
    null,
  );
  const [editingName, setEditingName] = useState("");

  const [openConversationId, setOpenConversationId] = useState<string | null>(
    null,
  );

  const [editingInstructions, setEditingInstructions] = useState("");
  const [editingSummary, setEditingSummary] = useState("");

  const [contextSaved, setContextSaved] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");

  const [showProjectSettings, setShowProjectSettings] = useState(false);

  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? null;

  const projectConversations = selectedProject
    ? conversations
        .filter(
          (conversation) => conversation.projectId === selectedProject.id,
        )
        .sort((a, b) => b.updatedAt - a.updatedAt)
    : [];

  const openConversation =
    projectConversations.find(
      (conversation) => conversation.id === openConversationId,
    ) ?? null;

  const panelClass = isLight
    ? "border-neutral-200 bg-white text-neutral-900"
    : "border-neutral-800 bg-neutral-900 text-neutral-100";

  const mutedClass = isLight ? "text-neutral-500" : "text-neutral-400";

  const inputClass = isLight
    ? "border-neutral-300 bg-white text-neutral-900 placeholder:text-neutral-400"
    : "border-neutral-700 bg-neutral-950 text-neutral-100 placeholder:text-neutral-500";

  const subtlePanelClass = isLight
    ? "border-neutral-200 bg-neutral-50"
    : "border-neutral-800 bg-neutral-950/60";

  const dividerClass = isLight
    ? "border-neutral-200"
    : "border-neutral-800";

  /*
   * Keep the editor synchronized with the currently selected project's
   * saved context. The editor is not reset when unrelated project data
   * changes.
   */
  useEffect(() => {
    if (!selectedProject) {
      setEditingInstructions("");
      setEditingSummary("");
      setContextSaved(false);
      return;
    }

    setEditingInstructions(selectedProject.instructions ?? "");
    setEditingSummary(selectedProject.summary ?? "");
    setContextSaved(false);
  }, [
    selectedProject?.id,
    selectedProject?.instructions,
    selectedProject?.summary,
  ]);

  const handleSelectProject = (project: Project) => {
    setSelectedProjectId(project.id);
    setOpenConversationId(null);
    setShowProjectSettings(false);
    setEditingInstructions(project.instructions ?? "");
    setEditingSummary(project.summary ?? "");
    setContextSaved(false);
  };

  const handleCreateProject = () => {
    const name = newName.trim();

    if (!name) {
      return;
    }

    const now = Date.now();

    const project: Project = {
      id:
        "project_" +
        now +
        "_" +
        Math.random().toString(36).slice(2, 8),
      name,
      description: newDescription.trim(),
      instructions: newInstructions.trim(),
      summary: "",
      color: "indigo",
      createdAt: now,
      updatedAt: now,
    };

    onCreateProject(project);

    setSelectedProjectId(project.id);
    setOpenConversationId(null);

    setEditingInstructions(project.instructions);
    setEditingSummary(project.summary);
    setContextSaved(false);

    setNewName("");
    setNewDescription("");
    setNewInstructions("");
  };

  const handleRenameProject = (project: Project) => {
    const name = editingName.trim();

    if (!name) {
      return;
    }

    onRenameProject({
      ...project,
      name,
      updatedAt: Date.now(),
    });

    setEditingProjectId(null);
    setEditingName("");
  };

  const handleDeleteProject = (project: Project) => {
    const confirmed = window.confirm(
      `Delete the project "${project.name}"? Its conversations and artifacts will be kept, but will no longer be linked to this project.`,
    );

    if (!confirmed) {
      return;
    }

    onDeleteProject(project.id);

    if (selectedProjectId === project.id) {
      setSelectedProjectId(null);
      setOpenConversationId(null);
      setEditingInstructions("");
      setEditingSummary("");
      setContextSaved(false);
    }

    if (editingProjectId === project.id) {
      setEditingProjectId(null);
      setEditingName("");
    }
  };

  const handleSaveProjectContext = () => {
    if (!selectedProject) {
      return;
    }

    const updatedProject: Project = {
      ...selectedProject,
      instructions: editingInstructions.trim(),
      summary: editingSummary.trim(),
      updatedAt: Date.now(),
    };

    onRenameProject(updatedProject);
    setContextSaved(true);
  };

  const handleCreateProjectChat = () => {
    if (!selectedProject) {
      return;
    }

    const conversationId = onCreateProjectChat(selectedProject.id);

    setOpenConversationId(conversationId);
  };

  const handleOpenConversation = (conversationId: string) => {
    const belongsToSelectedProject = projectConversations.some(
      (conversation) => conversation.id === conversationId,
    );

    if (!belongsToSelectedProject) {
      return;
    }

    setOpenConversationId(conversationId);
    onOpenConversation(conversationId);
  };

  const handleBackToProject = () => {
    setOpenConversationId(null);
  };

  const handleBackToProjects = () => {
    setSelectedProjectId(null);
    setOpenConversationId(null);
    setShowProjectSettings(false);
    setContextSaved(false);
  };

  const filteredProjects = projects.filter((project) => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return (
      project.name.toLowerCase().includes(query) ||
      project.description.toLowerCase().includes(query)
    );
  });

  const hasContextChanges =
    selectedProject !== null &&
    (editingInstructions.trim() !== (selectedProject.instructions ?? "").trim() ||
      editingSummary.trim() !== (selectedProject.summary ?? "").trim());

  /*
   * Show the existing chat interface inside the selected project.
   * Project selection and the conversation list remain in component state.
   */
  if (
    selectedProject &&
    openConversation &&
    activeConversation?.id === openConversation.id
  ) {
    return (
      <div className="martinez-projects-conversation flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          className={`flex shrink-0 items-center gap-3 border-b px-4 py-3 sm:px-6 ${dividerClass} ${
            isLight ? "bg-white" : "bg-neutral-950"
          }`}
        >
          <button
            type="button"
            onClick={handleBackToProject}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition hover:opacity-75 ${panelClass}`}
            aria-label={`Back to ${selectedProject.name}`}
            title={`Back to ${selectedProject.name}`}
          >
            <ArrowLeft size={15} />
            <span className="hidden sm:inline">
              Back to project
            </span>
            <span className="sm:hidden">Back</span>
          </button>

          <div className="min-w-0 flex-1">
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-2 py-1 text-[10px] font-semibold text-indigo-400">
              <Folder size={11} />
              {selectedProject.name}
            </div>

            <h1 className="truncate text-sm font-semibold sm:text-base">
              {openConversation.title}
            </h1>
          </div>

          <button
            type="button"
            onClick={handleBackToProjects}
            className={`hidden shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs transition hover:opacity-75 sm:inline-flex ${panelClass}`}
            title="View all projects"
          >
            <ArrowLeft size={14} />
            All projects
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {renderConversationContent}
        </div>
      </div>
    );
  }

  return (
    <div className="martinez-projects-screen min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Page header */}
        <header className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToChat}
            className={`rounded-xl border p-2.5 transition hover:opacity-75 ${panelClass}`}
            aria-label="Back to chat"
            title="Back to chat"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold tracking-tight">
              {selectedProject ? selectedProject.name : "Projects"}
            </h1>

            <p className={`mt-1 text-sm ${mutedClass}`}>
              {selectedProject
                ? "Your project workspace and related conversations."
                : "Keep related chats, instructions, and work organized in one place."}
            </p>
          </div>

          <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 sm:flex">
            <Sparkles size={22} />
          </div>
        </header>

        {selectedProject ? (
          /* ============================================================
             SELECTED PROJECT WORKSPACE
             ============================================================ */
          <div className="space-y-5">
            <button
              type="button"
              onClick={handleBackToProjects}
              className="inline-flex items-center gap-2 text-sm font-medium text-indigo-400 transition hover:text-indigo-300"
            >
              <ArrowLeft size={15} />
              All projects
            </button>

            {/* Project overview */}
            <section
              className={`rounded-2xl border p-5 sm:p-6 ${panelClass}`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="shrink-0 rounded-2xl bg-indigo-500/10 p-3.5 text-indigo-400">
                    <Folder size={25} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="break-words text-lg font-semibold">
                      {selectedProject.name}
                    </h2>

                    <p className={`mt-1 text-sm leading-6 ${mutedClass}`}>
                      {selectedProject.description ||
                        "No description yet. You can add one when editing the project."}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs ${mutedClass}`}
                      >
                        <Clock3 size={13} />
                        Created{" "}
                        {new Date(
                          selectedProject.createdAt,
                        ).toLocaleDateString()}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1.5 text-xs ${mutedClass}`}
                      >
                        <MessagesSquare size={13} />
                        {projectConversations.length}{" "}
                        {projectConversations.length === 1
                          ? "conversation"
                          : "conversations"}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCreateProjectChat}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-neutral-900"
                >
                  <Plus size={17} />
                  New project chat
                </button>
              </div>
            </section>

            {/* Project context editor */}
            <section
              className={`overflow-hidden rounded-2xl border ${panelClass}`}
            >
              <button
                type="button"
                onClick={() =>
                  setShowProjectSettings((current) => !current)
                }
                className={`flex w-full items-center gap-3 p-4 text-left transition hover:opacity-80 sm:p-5 ${
                  isLight ? "hover:bg-neutral-50" : "hover:bg-neutral-800/40"
                }`}
                aria-expanded={showProjectSettings}
                aria-controls="project-context-editor"
              >
                <div className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-400">
                  <Settings2 size={19} />
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">
                    Project instructions & context
                  </h2>

                  <p className={`mt-1 text-xs leading-5 ${mutedClass}`}>
                    Tell the AI what it should know and how it should work
                    in this project.
                  </p>
                </div>

                <span
                  className={`shrink-0 text-xs font-medium ${
                    hasContextChanges
                      ? "text-amber-500"
                      : contextSaved
                        ? "text-emerald-500"
                        : "text-indigo-400"
                  }`}
                >
                  {hasContextChanges
                    ? "Unsaved changes"
                    : contextSaved
                      ? "Saved"
                      : showProjectSettings
                        ? "Hide"
                        : "Edit"}
                </span>
              </button>

              {showProjectSettings && (
                <div
                  id="project-context-editor"
                  className={`space-y-5 border-t p-4 sm:p-5 ${dividerClass}`}
                >
                  <div
                    className={`rounded-xl border p-3 ${subtlePanelClass}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <Sparkles
                        size={17}
                        className="mt-0.5 shrink-0 text-indigo-400"
                      />

                      <p
                        className={`text-xs leading-5 ${mutedClass}`}
                      >
                        These instructions and the summary are intended
                        for conversations belonging to this project.
                        Keep them focused on this project's goals,
                        requirements, and decisions.
                      </p>
                    </div>
                  </div>

                  <label className="block space-y-2">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <Settings2
                        size={15}
                        className="text-indigo-400"
                      />
                      Project instructions
                    </span>

                    <textarea
                      value={editingInstructions}
                      onChange={(event) => {
                        setEditingInstructions(event.target.value);
                        setContextSaved(false);
                      }}
                      rows={5}
                      maxLength={8000}
                      placeholder={
                        "Example: Preserve existing features, use TypeScript, explain changes clearly, and follow this project's coding conventions."
                      }
                      className={`w-full resize-y rounded-xl border px-3 py-3 text-sm leading-6 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${inputClass}`}
                    />

                    <span
                      className={`block text-right text-xs ${mutedClass}`}
                    >
                      {editingInstructions.length}/8000 characters
                    </span>
                  </label>

                  <label className="block space-y-2">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <FileText
                        size={15}
                        className="text-indigo-400"
                      />
                      Project summary & background
                    </span>

                    <textarea
                      value={editingSummary}
                      onChange={(event) => {
                        setEditingSummary(event.target.value);
                        setContextSaved(false);
                      }}
                      rows={5}
                      maxLength={8000}
                      placeholder={
                        "Record important background, decisions, technical details, constraints, goals, and progress so the AI can maintain continuity."
                      }
                      className={`w-full resize-y rounded-xl border px-3 py-3 text-sm leading-6 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${inputClass}`}
                    />

                    <span
                      className={`block text-right text-xs ${mutedClass}`}
                    >
                      {editingSummary.length}/8000 characters
                    </span>
                  </label>

                  <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className={`text-xs leading-5 ${mutedClass}`}>
                      Saving updates this project's instructions and
                      summary. Existing conversations remain intact.
                    </p>

                    <div className="flex shrink-0 items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingInstructions(
                            selectedProject.instructions ?? "",
                          );
                          setEditingSummary(
                            selectedProject.summary ?? "",
                          );
                          setContextSaved(false);
                        }}
                        disabled={!hasContextChanges}
                        className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${panelClass}`}
                      >
                        Reset changes
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveProjectContext}
                        disabled={!hasContextChanges}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Save size={14} />
                        Save context
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Project conversations */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">
                    Project conversations
                  </h2>

                  <p className={`mt-1 text-xs ${mutedClass}`}>
                    Open a conversation to continue working in this
                    project.
                  </p>
                </div>

                <span
                  className={`rounded-lg border px-2.5 py-1 text-xs ${panelClass}`}
                >
                  {projectConversations.length} total
                </span>
              </div>

              {projectConversations.length === 0 ? (
                <div
                  className={`rounded-2xl border border-dashed p-8 text-center sm:p-10 ${panelClass}`}
                >
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400">
                    <MessageSquare size={24} />
                  </div>

                  <h3 className="font-semibold">
                    No conversations yet
                  </h3>

                  <p
                    className={`mx-auto mt-2 max-w-sm text-sm leading-6 ${mutedClass}`}
                  >
                    Start a project chat to keep your discussions and
                    related work connected to this workspace.
                  </p>

                  <button
                    type="button"
                    onClick={handleCreateProjectChat}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
                  >
                    <Plus size={16} />
                    Create first conversation
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {projectConversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() =>
                        handleOpenConversation(conversation.id)
                      }
                      className={`group flex w-full items-center gap-3 rounded-xl border p-4 text-left transition hover:border-indigo-400/50 ${
                        isLight
                          ? "border-neutral-200 bg-white hover:bg-neutral-50"
                          : "border-neutral-800 bg-neutral-900 hover:bg-neutral-800/60"
                      }`}
                    >
                      <div className="shrink-0 rounded-xl bg-indigo-500/10 p-2.5 text-indigo-400 transition group-hover:bg-indigo-500/15">
                        <MessageSquare size={19} />
                      </div>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {conversation.title || "Untitled conversation"}
                        </span>

                        <span className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-400">
                            <Folder size={10} />
                            Project conversation
                          </span>

                          <span
                            className={`text-xs ${mutedClass}`}
                          >
                            {conversation.messages.length}{" "}
                            {conversation.messages.length === 1
                              ? "message"
                              : "messages"}
                          </span>

                          <span
                            className={`text-xs ${mutedClass}`}
                          >
                            Updated{" "}
                            {new Date(
                              conversation.updatedAt,
                            ).toLocaleDateString()}
                          </span>
                        </span>
                      </span>

                      <ArrowUpRight
                        size={17}
                        className={`shrink-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-indigo-400 ${mutedClass}`}
                      />
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          /* ============================================================
             ALL PROJECTS / CREATE PROJECT
             ============================================================ */
          <div className="space-y-6">
            {/* Create project */}
            <section
              className={`rounded-2xl border p-5 sm:p-6 ${panelClass}`}
            >
              <div className="mb-5 flex items-start gap-3">
                <div className="rounded-xl bg-indigo-500/10 p-3 text-indigo-400">
                  <Plus size={21} />
                </div>

                <div>
                  <h2 className="font-semibold">Create a project</h2>

                  <p className={`mt-1 text-sm leading-6 ${mutedClass}`}>
                    Give your work a name and set optional instructions
                    for the AI.
                  </p>
                </div>
              </div>

              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleCreateProject();
                }}
              >
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold">
                    Project name
                  </span>

                  <input
                    value={newName}
                    onChange={(event) =>
                      setNewName(event.target.value)
                    }
                    placeholder="e.g. MartinezAI development"
                    maxLength={100}
                    required
                    className={`w-full rounded-xl border px-3 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${inputClass}`}
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold">
                    Description
                  </span>

                  <textarea
                    value={newDescription}
                    onChange={(event) =>
                      setNewDescription(event.target.value)
                    }
                    placeholder="What is this project about?"
                    rows={2}
                    maxLength={500}
                    className={`w-full resize-y rounded-xl border px-3 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${inputClass}`}
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold">
                    Initial AI instructions
                  </span>

                  <textarea
                    value={newInstructions}
                    onChange={(event) =>
                      setNewInstructions(event.target.value)
                    }
                    placeholder="Optional: Tell the AI how it should work in this project."
                    rows={3}
                    maxLength={8000}
                    className={`w-full resize-y rounded-xl border px-3 py-3 text-sm leading-6 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${inputClass}`}
                  />
                </label>

                <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className={`text-xs leading-5 ${mutedClass}`}>
                    You can edit the instructions and add a project
                    summary after creating the project.
                  </p>

                  <button
                    type="submit"
                    disabled={!newName.trim()}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus size={17} />
                    Create project
                  </button>
                </div>
              </form>
            </section>

            {/* Project list */}
            <section className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">
                    Your projects
                  </h2>

                  <p className={`mt-1 text-sm ${mutedClass}`}>
                    Open a workspace to manage its context and chats.
                  </p>
                </div>

                <span
                  className={`self-start rounded-lg border px-2.5 py-1.5 text-xs ${panelClass}`}
                >
                  {projects.length}{" "}
                  {projects.length === 1 ? "project" : "projects"}
                </span>
              </div>

              {projects.length > 0 && (
                <div>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) =>
                      setSearchQuery(event.target.value)
                    }
                    placeholder="Search projects..."
                    aria-label="Search projects"
                    className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 sm:max-w-sm ${inputClass}`}
                  />
                </div>
              )}

              {projects.length === 0 ? (
                <div
                  className={`rounded-2xl border border-dashed p-10 text-center ${panelClass}`}
                >
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400">
                    <Folder size={28} />
                  </div>

                  <h3 className="font-semibold">
                    Your workspace starts here
                  </h3>

                  <p
                    className={`mx-auto mt-2 max-w-sm text-sm leading-6 ${mutedClass}`}
                  >
                    Create your first project to organize related
                    conversations, instructions, and background
                    information.
                  </p>
                </div>
              ) : filteredProjects.length === 0 ? (
                <div
                  className={`rounded-2xl border border-dashed p-8 text-center ${panelClass}`}
                >
                  <Folder
                    size={26}
                    className={`mx-auto mb-3 ${mutedClass}`}
                  />

                  <p className="font-medium">No matching projects</p>

                  <p className={`mt-1 text-sm ${mutedClass}`}>
                    Try a different project name or description.
                  </p>

                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="mt-3 text-sm font-medium text-indigo-400 hover:text-indigo-300"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {filteredProjects.map((project) => {
                    const count = conversations.filter(
                      (conversation) =>
                        conversation.projectId === project.id,
                    ).length;

                    const isEditing =
                      editingProjectId === project.id;

                    return (
                      <article
                        key={project.id}
                        className={`rounded-2xl border p-4 transition hover:border-indigo-400/40 ${panelClass}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 rounded-xl bg-indigo-500/10 p-3 text-indigo-400">
                            <Folder size={22} />
                          </div>

                          <div className="min-w-0 flex-1">
                            {isEditing ? (
                              <form
                                className="flex gap-2"
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  handleRenameProject(project);
                                }}
                              >
                                <input
                                  value={editingName}
                                  onChange={(event) =>
                                    setEditingName(event.target.value)
                                  }
                                  maxLength={100}
                                  autoFocus
                                  required
                                  aria-label="New project name"
                                  className={`min-w-0 flex-1 rounded-lg border px-2.5 py-2 text-sm outline-none focus:border-indigo-500 ${inputClass}`}
                                />

                                <button
                                  type="submit"
                                  disabled={!editingName.trim()}
                                  className="rounded-lg p-2 text-emerald-400 transition hover:bg-emerald-500/10 disabled:opacity-40"
                                  aria-label="Save project name"
                                  title="Save name"
                                >
                                  <Check size={16} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingProjectId(null);
                                    setEditingName("");
                                  }}
                                  className={`rounded-lg p-2 transition hover:bg-neutral-500/10 ${mutedClass}`}
                                  aria-label="Cancel renaming"
                                  title="Cancel"
                                >
                                  <X size={16} />
                                </button>
                              </form>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  handleSelectProject(project)
                                }
                                className="block max-w-full truncate text-left font-semibold transition hover:text-indigo-400"
                              >
                                {project.name}
                              </button>
                            )}

                            <p
                              className={`mt-1 line-clamp-2 text-sm leading-5 ${mutedClass}`}
                            >
                              {project.description ||
                                "No description yet."}
                            </p>

                            <div
                              className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${mutedClass}`}
                            >
                              <span className="inline-flex items-center gap-1">
                                <MessageSquare size={12} />
                                {count}{" "}
                                {count === 1
                                  ? "conversation"
                                  : "conversations"}
                              </span>

                              {project.instructions?.trim() && (
                                <span className="inline-flex items-center gap-1 text-indigo-400">
                                  <Settings2 size={12} />
                                  Instructions
                                </span>
                              )}

                              {project.summary?.trim() && (
                                <span className="inline-flex items-center gap-1 text-indigo-400">
                                  <FileText size={12} />
                                  Summary
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div
                          className={`mt-4 flex items-center justify-between gap-2 border-t pt-3 ${dividerClass}`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              handleSelectProject(project)
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg py-2 text-sm font-semibold text-indigo-400 transition hover:text-indigo-300"
                          >
                            Open project
                            <ArrowUpRight size={15} />
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingProjectId(project.id);
                                setEditingName(project.name);
                              }}
                              className={`rounded-lg p-2 transition hover:bg-indigo-500/10 hover:text-indigo-400 ${mutedClass}`}
                              aria-label={`Rename ${project.name}`}
                              title="Rename project"
                            >
                              <Pencil size={15} />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteProject(project)
                              }
                              className={`rounded-lg p-2 transition hover:bg-red-500/10 hover:text-red-400 ${mutedClass}`}
                              aria-label={`Delete ${project.name}`}
                              title="Delete project"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};