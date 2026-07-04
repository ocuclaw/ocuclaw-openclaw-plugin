import assert from "node:assert/strict";
import test from "node:test";
import { createRuntimeConfig } from "./runtime-config.ts";

const base = { relayToken: "tok" };
const openclawConfig = { gateway: { auth: { token: "gw" } } };

test("absent sessionTitleModel → undefined/empty (zero-config path)", () => {
  const cfg = createRuntimeConfig({ pluginConfig: { ...base }, openclawConfig });
  assert.ok(!cfg.sessionTitleModel);
});

test("sessionTitleModel string is carried through", () => {
  const cfg = createRuntimeConfig({
    pluginConfig: { ...base, sessionTitleModel: "openai/gpt-5-mini" },
    openclawConfig,
  });
  assert.equal(cfg.sessionTitleModel, "openai/gpt-5-mini");
});
