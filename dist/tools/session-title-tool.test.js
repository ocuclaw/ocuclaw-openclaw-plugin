import assert from "node:assert/strict";
import test from "node:test";
import { createSessionTitleToolHandler, TOOL_DESCRIPTION } from "./session-title-tool.ts";

function deps(over = {}) {
  const calls = [];
  return {
    calls,
    peekSessionKey: () => "ocuclaw:123",
    setSessionTitle: (k, t, o) => { calls.push({ k, t, o }); return { ok: true }; },
    ...over,
  };
}

test("description is explicit-rename-only", () => {
  assert.match(TOOL_DESCRIPTION, /explicitly asks to rename|user explicitly/i);
});

test("explicit rename passes origin user_tool", async () => {
  const d = deps();
  const h = createSessionTitleToolHandler(d);
  await h.setSessionTitle({ title: "Trip Planning" });
  assert.equal(d.calls[0].o.origin, "user_tool");
});

test("a user-locked session can STILL be renamed via the tool", async () => {
  const d = deps({
    setSessionTitle: (k, t, o) => {

      return { ok: true };
    },
  });
  const h = createSessionTitleToolHandler(d);
  const r = await h.setSessionTitle({ title: "New Name" });
  assert.deepEqual(r, { ok: true });
});

test("feature-disabled does NOT block an explicit rename", async () => {
  const d = deps({ isNeuralSessionNamesEnabled: () => false });
  const h = createSessionTitleToolHandler(d);
  const r = await h.setSessionTitle({ title: "Anything" });
  assert.deepEqual(r, { ok: true });
});

test("still rejects an empty title", async () => {
  const h = createSessionTitleToolHandler(deps());
  await assert.rejects(() => h.setSessionTitle({ title: "   " }), /title_empty/);
});

test("still rejects when no active session", async () => {
  const h = createSessionTitleToolHandler(deps({ peekSessionKey: () => "" }));
  await assert.rejects(() => h.setSessionTitle({ title: "X" }), /no_active_session/);
});
