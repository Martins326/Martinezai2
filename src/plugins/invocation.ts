import { ASSISTANT_PLUGINS } from "./registry";

export function getPluginInvocation(
  text: string,
  enabledPluginIds: string[],
): { pluginId: string; prompt: string } | null {
  const enabledPlugins = ASSISTANT_PLUGINS.filter((plugin) =>
    enabledPluginIds.includes(plugin.id),
  );
  const lowerText = text.toLowerCase();

  let match: {
    pluginId: string;
    index: number;
    mention: string;
  } | null = null;

  for (const plugin of enabledPlugins) {
    // Display names are used by the picker; IDs also support direct typing such as @calculator.
    const candidates = [...new Set([plugin.name, plugin.id])];

    for (const candidate of candidates) {
      const mention = `@${candidate}`;
      let index = lowerText.indexOf(mention.toLowerCase());

      while (index >= 0) {
        const charAfterMention = text[index + mention.length] || "";
        const hasValidBoundary =
          !charAfterMention || /[\s:;,.!?]/.test(charAfterMention);

        if (
          hasValidBoundary &&
          (match === null || index < match.index)
        ) {
          match = {
            pluginId: plugin.id,
            index,
            mention,
          };
        }

        index = lowerText.indexOf(mention.toLowerCase(), index + 1);
      }
    }
  }

  if (!match) return null;

  // Remove only the invocation tag. Preserve line breaks and the user's original formatting.
  const prompt = `${text.slice(0, match.index)}${text.slice(
    match.index + match.mention.length,
  )}`
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return {
    pluginId: match.pluginId,
    prompt,
  };
}