import assert from "node:assert/strict";
import test from "node:test";
import { composeGlassesUiNudgeSystemPrompt } from "./glasses-ui-system-prompt.ts";

test("pointer is short and references the tool + 'see its description'", () => {
  const out = composeGlassesUiNudgeSystemPrompt();
  assert.match(out, /render_glasses_ui/);
  assert.match(out, /description/i);

  assert.match(out, /available\/deferred tools/);
  assert.ok(out.length < 420, `pointer should stay lean, got ${out.length}`);
});
