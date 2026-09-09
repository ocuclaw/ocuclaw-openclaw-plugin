export const CUSTOM_SYSTEM_PROMPT_MAX_CODE_POINTS = 4_000;

export function normalizeCustomSystemPrompt(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function countUnicodeCodePoints(value) {
  return Array.from(typeof value === "string" ? value : "").length;
}

export function normalizeAndValidateCustomSystemPrompt(value) {
  const normalized = normalizeCustomSystemPrompt(value);
  const codePointCount = countUnicodeCodePoints(normalized);
  if (codePointCount > CUSTOM_SYSTEM_PROMPT_MAX_CODE_POINTS) {
    throw new RangeError(
      `systemPrompt must be 4,000 Unicode code points or fewer after trimming ` +
        `(received ${codePointCount.toLocaleString("en-US")}). Shorten it before saving.`,
    );
  }
  return normalized;
}
