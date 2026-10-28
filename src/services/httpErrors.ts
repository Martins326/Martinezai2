/** Build a readable fallback when an API error response has no JSON message. */
export function formatHttpErrorFallback(
  fallback: string,
  status: number,
): string {
  return `${fallback} (HTTP ${status})`;
}