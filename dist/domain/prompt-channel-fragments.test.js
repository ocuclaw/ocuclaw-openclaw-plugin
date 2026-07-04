import assert from "node:assert/strict";
import test from "node:test";
import { composeChannelTwoFragment } from "./prompt-channel-fragments.ts";

const ENABLED_BOTH = { emoji: true, pace: true };

test("no transitions, glasses connected → undefined (no injection)", () => {
  assert.equal(
    composeChannelTwoFragment({
      startEnabled: ENABLED_BOTH,
      currentEnabled: ENABLED_BOTH,
      glassesConnected: true,
    }),
    undefined,
  );
});

test("emoji disabled mid-session → tiny stop-notice mentioning emoji only", () => {
  const out = composeChannelTwoFragment({
    startEnabled: ENABLED_BOTH,
    currentEnabled: { emoji: false, pace: true },
    glassesConnected: true,
  });
  assert.match(out, /emoji/i);
  assert.doesNotMatch(out, /dwell|skim|pace/i);
  assert.ok(out.length < 200, "stop-notice must stay tiny");
});

test("pace disabled mid-session → tiny stop-notice mentioning pace only", () => {
  const out = composeChannelTwoFragment({
    startEnabled: ENABLED_BOTH,
    currentEnabled: { emoji: true, pace: false },
    glassesConnected: true,
  });
  assert.match(out, /dwell|skim|pace/i);
  assert.doesNotMatch(out, /<emoji/i);
});

test("enabling a feature that was OFF at start does NOT inject (lands next session)", () => {
  assert.equal(
    composeChannelTwoFragment({
      startEnabled: { emoji: false, pace: false },
      currentEnabled: { emoji: true, pace: true },
      glassesConnected: true,
    }),
    undefined,
  );
});

test("glasses disconnected → render gate fragment", () => {
  const out = composeChannelTwoFragment({
    startEnabled: ENABLED_BOTH,
    currentEnabled: ENABLED_BOTH,
    glassesConnected: false,
  });
  assert.match(out, /render_glasses_ui/);
  assert.match(out, /not connected|no glasses/i);
});

test("multiple fragments join with a blank line and stay small", () => {
  const out = composeChannelTwoFragment({
    startEnabled: ENABLED_BOTH,
    currentEnabled: { emoji: false, pace: false },
    glassesConnected: false,
  });
  assert.match(out, /emoji/i);
  assert.match(out, /dwell|skim|pace/i);
  assert.match(out, /render_glasses_ui/);
  assert.ok(out.length < 400);
});
