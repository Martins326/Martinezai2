import type { Project } from "../types";

/**
 * Adds context from the project linked to the current conversation.
 * An ordinary conversation passes null/undefined and receives no project data.
 */
export function appendProjectContext(
  currentContext: string,
  project?: Pick<
    Project,
    "name" | "description" | "instructions" | "summary"
  > | null,
): string {
  if (!project) return currentContext;

  const description = project.description?.trim();
  const instructions = project.instructions?.trim();
  const summary = project.summary?.trim();

  // Do not add an empty project section when the project has no saved context.
  if (!description && !instructions && !summary) {
    return currentContext;
  }

  const sections = [
    `Project: ${project.name.trim() || "Untitled project"}`,
  ];

  if (description) {
    sections.push(`Project description:\n${description}`);
  }

  if (summary) {
    sections.push(`Project summary / background:\n${summary}`);
  }

  if (instructions) {
    sections.push(`Project-specific instructions:\n${instructions}`);
  }

  const projectContext =
    `Project workspace context (use only for this conversation):\n` +
    sections.join("\n\n");

  return currentContext.trim()
    ? `${currentContext.trim()}\n\n${projectContext}`
    : projectContext;
}