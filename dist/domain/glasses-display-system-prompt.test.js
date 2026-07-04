import assert from "node:assert/strict";
import test from "node:test";
import { composeGlassesDisplaySystemPrompt } from "./glasses-display-system-prompt.ts";
import { MESSAGE_EMOJI_ALLOWLIST } from "./message-emoji-allowlist.ts";

test("neither feature enabled → empty string", () => {
  assert.equal(
    composeGlassesDisplaySystemPrompt({ emoji: false, pace: false }),
    "",
  );
});

test("emoji-only includes emoji tag + full allowlist, omits pace tags", () => {
  const out = composeGlassesDisplaySystemPrompt({ emoji: true, pace: false });
  assert.match(out, /<emoji:X>/);
  assert.doesNotMatch(out, /<dwell>/);
  assert.doesNotMatch(out, /<skim>/);
  for (const e of MESSAGE_EMOJI_ALLOWLIST) assert.ok(out.includes(e), `missing ${e}`);
  assert.match(out, /^<glasses_display>/);
  assert.match(out, /<\/glasses_display>$/);
});

test("pace-only includes dwell/skim, omits emoji + allowlist", () => {
  const out = composeGlassesDisplaySystemPrompt({ emoji: false, pace: true });
  assert.match(out, /<dwell>/);
  assert.match(out, /<skim>/);
  assert.doesNotMatch(out, /<emoji:X>/);

  assert.ok(!out.includes(MESSAGE_EMOJI_ALLOWLIST[0]));
});

test("both enabled includes all three tags and the allowlist once", () => {
  const out = composeGlassesDisplaySystemPrompt({ emoji: true, pace: true });
  assert.match(out, /<emoji:X>/);
  assert.match(out, /<dwell>/);
  assert.match(out, /<skim>/);
  assert.equal(out.match(/<glasses_display>/g).length, 1);
});

test("output is deterministic (same inputs → identical bytes)", () => {
  const a = composeGlassesDisplaySystemPrompt({ emoji: true, pace: true });
  const b = composeGlassesDisplaySystemPrompt({ emoji: true, pace: true });
  assert.equal(a, b);
});
