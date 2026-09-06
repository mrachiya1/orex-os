/**
 * Deterministic session title from the first message -- no extra AI call
 * spent solely on naming a conversation (prompts/015 Decisions #11). A
 * smarter model-generated title can replace this later without touching
 * callers, since they only see the string result.
 */
export function deriveSessionTitle(firstMessage: string): string {
  const cleaned = firstMessage.trim().replace(/\s+/g, " ").replace(/[.?!]+$/, "");
  if (!cleaned) return "New conversation";

  const maxLength = 60;
  const truncated =
    cleaned.length <= maxLength
      ? cleaned
      : `${cleaned.slice(0, cleaned.lastIndexOf(" ", maxLength) > 0 ? cleaned.lastIndexOf(" ", maxLength) : maxLength)}…`;

  const skipWords = new Set(["a", "an", "the", "and", "or", "of", "to", "for", "in", "on", "at", "is", "are", "my", "me"]);
  return truncated
    .split(" ")
    .map((word, i) => {
      if (i > 0 && skipWords.has(word.toLowerCase())) return word.toLowerCase();
      const lower = word.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}
