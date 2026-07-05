# OcuClaw

OcuClaw is an OpenClaw plugin for Even G2 smart glasses. Use the OcuClaw application within Even Hub App Store to connect the client side.

## Guided setup (recommended)

Let your OpenClaw agent drive the whole setup — install the OcuClaw assistant skill, then ask the agent to "set up OcuClaw":

```bash
openclaw skills install @ocuclaw/ocuclaw-assist
```

The sections below are the manual reference for the plugin half.

## Requirements

OpenClaw `>= 2026.6.9` (older versions have a known plugin-install bug). Upgrade with `npm install -g openclaw@latest`.

## Install

Install the plugin from the OpenClaw CLI:

```bash
openclaw plugins install ocuclaw
```

## Configure

Required:

Set the OcuClaw relay token. This is a user-created password that must match the relay server token field in the OcuClaw application within Even Hub App Store.

```bash
openclaw config set plugins.entries.ocuclaw.config.relayToken "your-relay-token"
```

Recommended:

- `sonioxApiKey`: Enables Soniox speech-to-text for voice input.

```bash
openclaw config set plugins.entries.ocuclaw.config.sonioxApiKey "your-soniox-api-key"
```

- `evenAiEnabled`: Enables Even AI integration for OcuClaw.

```bash
openclaw config set plugins.entries.ocuclaw.config.evenAiEnabled true --strict-json
```

- `evenAiToken`: Sets the user-created password for Even AI requests. This must match the password set in the Even AI Agent Configure section within the Even Realities app.

```bash
openclaw config set plugins.entries.ocuclaw.config.evenAiToken "your-even-ai-token"
```

> **Note:** When `evenAiEnabled` is `true`, `evenAiToken` is required. Config validation will reject the change if you enable Even AI without setting the token.

Optional Even AI tuning (only used when `evenAiEnabled` is `true`):

- `evenAiRoutingMode`: `active` routes through the current session (default), `background` reuses a dedicated background session, `background_new` starts a fresh background session per request.
- `evenAiSystemPrompt`: Extra system prompt appended to Even AI runs only.

```bash
openclaw config set plugins.entries.ocuclaw.config.evenAiRoutingMode "active"
openclaw config set plugins.entries.ocuclaw.config.evenAiSystemPrompt "your-extra-prompt"
```

> **Note:** These two seed the Even AI settings on first boot. If you use the OcuClaw glasses client or phone WebUI, the in-app Even AI settings editor takes over afterward, and later changes to these config keys won't affect live behaviour unless the stored settings are reset. For deployments that use **only** the direct Even Realities Even AI pathway — never launching the OcuClaw client — these keys are the only way to configure routing mode and system prompt. `evenAiSystemPrompt` has no glasses-side editor, so set it via the phone WebUI or config.

Advanced optional settings:

```bash
openclaw config set plugins.entries.ocuclaw.config.wsBind "127.0.0.1"
# wsPort default is 9000; on Windows that port is often reserved by WinNAT, so the
# setup assistant uses 47800. Pick any free port in 30000-49151 if you override it.
openclaw config set plugins.entries.ocuclaw.config.wsPort 47800 --strict-json
# Recent sessions fetched for the WebUI switcher/search list (default 80). Glasses
# clamp to their own item-count cap, so this only widens the WebUI list.
openclaw config set plugins.entries.ocuclaw.config.sessionLimit 80 --strict-json
# Optional model override ("provider/model") for the background session-title
# distiller. This is a lightweight background task, so a small, fast, inexpensive
# model is a good choice (e.g. Anthropic's Haiku) — it keeps title generation off
# your main model's tokens and latency. Leave unset to use your normal model.
openclaw config set plugins.entries.ocuclaw.config.sessionTitleModel "anthropic/claude-haiku-4-5"
# How long render_glasses_ui waits for a user pick before resolving { result: "timeout" }.
# Default 1800000 (30 minutes); 0 disables the timeout (infinite wait).
openclaw config set plugins.entries.ocuclaw.config.renderGlassesUiTimeoutMs 1800000 --strict-json
# How long (ms) a fresh agent summary outranks a tool label in the glasses activity
# status. Default 5000, clamped to 3000-8000.
openclaw config set plugins.entries.ocuclaw.config.freshnessWindowMs 5000 --strict-json
# Debug tooling (only relevant when externalDebugToolsEnabled is true):
openclaw config set plugins.entries.ocuclaw.config.externalDebugToolsEnabled true --strict-json
# Debug bundle upload gate. Uploads require BOTH externalDebugToolsEnabled AND
# allowDebugUpload to be true — otherwise uploads fail with upload_not_allowed.
openclaw config set plugins.entries.ocuclaw.config.allowDebugUpload true --strict-json
# Per-channel filters that suppress or sample noisy debug events.
openclaw config set plugins.entries.ocuclaw.config.debugNoisyPolicies '{}' --strict-json
```

Run `openclaw plugins inspect ocuclaw` to see all settings with their descriptions and defaults.

## Enable

```bash
openclaw plugins enable ocuclaw
```

## Restart

Restart the gateway so the plugin and config changes take effect:

```bash
openclaw gateway restart
```

> **Note:** On container/foreground gateways (no installed service) `gateway restart` reports "no installed service"; config hot-reloads instead — verify with `openclaw plugins inspect ocuclaw --runtime`.

## Verify

```bash
openclaw plugins inspect ocuclaw --runtime
openclaw plugins doctor
openclaw gateway status
```
