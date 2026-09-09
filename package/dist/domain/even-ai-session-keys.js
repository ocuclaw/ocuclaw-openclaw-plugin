export const DEFAULT_EVEN_AI_DEDICATED_SESSION_KEY = "ocuclaw:even-ai";
export const EVEN_AI_THROWAWAY_SESSION_PREFIX = "ocuclaw:even-ai:";
export const HERMES_EVEN_AI_SESSION_KEY_PATTERN =
  /^hermes:[^:]+:even-ai(?:[-_][a-z0-9][a-z0-9._-]*)?$/;

export function normalizeEvenAiSessionKey(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isHermesEvenAiSessionKey(value) {
  return HERMES_EVEN_AI_SESSION_KEY_PATTERN.test(
    normalizeEvenAiSessionKey(value),
  );
}

export function isEvenAiSessionKey(value) {
  const normalized = normalizeEvenAiSessionKey(value);
  return (
    normalized === DEFAULT_EVEN_AI_DEDICATED_SESSION_KEY ||
    normalized.startsWith(EVEN_AI_THROWAWAY_SESSION_PREFIX) ||
    HERMES_EVEN_AI_SESSION_KEY_PATTERN.test(normalized)
  );
}

export function extractEmbeddedEvenAiSessionKey(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const lowered = trimmed.toLowerCase();
  const anchors = ["ocuclaw:", "hermes:"];
  let anchorIndex = -1;
  for (const anchor of anchors) {
    const index = lowered.indexOf(anchor);
    if (index >= 0 && (anchorIndex < 0 || index < anchorIndex)) {
      anchorIndex = index;
    }
  }
  const candidate = anchorIndex >= 0 ? trimmed.slice(anchorIndex) : trimmed;
  return isEvenAiSessionKey(candidate) ? candidate : "";
}
