# OcuClaw

OcuClaw is an OpenClaw plugin for Even G2 smart glasses. Use the OcuClaw application within Even Hub App Store to connect the client side.

## Package trust

OcuClaw is a community package, not an official or bundled OpenClaw plugin.
Each ClawHub release carries source attribution to the public
`ocuclaw/ocuclaw-openclaw-plugin` mirror, including its immutable commit and
package path. A clean scan means ClawHub's scanner accepted that exact published
artifact; it does not grant official OpenClaw status. Check the release's linked
source and current moderation result on ClawHub rather than inferring trust from
this README.

## Guided setup (recommended)

Let your OpenClaw agent drive the whole setup. Install the plugin, then ask the
agent to "set up OcuClaw":

```bash
openclaw plugins install clawhub:ocuclaw
```

The OcuClaw Setup Assistant ships inside the plugin, so that one command gives
you both and `openclaw plugins update ocuclaw` keeps them in step. There is no
separate assistant package to install. If you installed the standalone
`ocuclaw-assist` skill before it was retired, it silently overrides the
plugin's copy and pins you to an old guide. Clear it once and the bundled
assistant takes over: `openclaw skills remove ocuclaw-assist` where your host
has that verb, otherwise delete the folder holding the `filePath` that
`openclaw skills info ocuclaw-assist --json` reports. OpenClaw 2026.7.x has no
`skills remove`.

On a Cloudways managed host, `openclaw ocuclaw cloudways setup` does the whole
setup in one command: with your explicit consent at each point, it downloads the
pinned Tailscale build into `~/bin`, runs it in userspace-networking mode as your
own user, and publishes the relay to your tailnet only (never public, never
Funnel), pairs your phone, then waits with you for your first message and its
reply on the display.

The sections below are the manual reference for the plugin half.

## Requirements

OpenClaw `>= 2026.6.9` (the plugin's minimum supported host version; older hosts refuse the install cleanly). Upgrade with `openclaw update`, or `npm install -g openclaw@latest` on very old builds.

## Install

Install the plugin from the OpenClaw CLI:

```bash
openclaw plugins install clawhub:ocuclaw
```

Stable releases use the explicit ClawHub source above. npm is the explicit
fallback (`openclaw plugins install npm:ocuclaw`) and carries beta builds
(`openclaw plugins install npm:ocuclaw@beta`).

## Configure

Required:

Nothing to type for the relay credential. The first time the plugin loads
without one it creates a private Relay Credential on this host and the relay
starts with it; the phone receives it through `openclaw ocuclaw pair`, never by
retyping. Until that first load the plugin is unconfigured and does not open
the relay listener. An existing credential is never replaced. To keep the relay
off on purpose, disable the plugin (`openclaw plugins disable ocuclaw`); an
emptied credential is refilled at the next load.

Recommended:

- `sonioxApiKey`: Enables Soniox speech-to-text for voice input.

```bash
openclaw config set plugins.entries.ocuclaw.config.sonioxApiKey "your-soniox-api-key"
```

- `evenAiToken`: Sets the user-created password for Even AI requests. This must match the password set in the Even AI Agent Configure section within the Even Realities app.

```bash
openclaw config set plugins.entries.ocuclaw.config.evenAiToken "your-even-ai-token"
```

- `evenAiEnabled`: Enables Even AI integration for OcuClaw after the token is stored.

```bash
openclaw config set plugins.entries.ocuclaw.config.evenAiEnabled true --strict-json
```

> **Note:** When `evenAiEnabled` is `true`, `evenAiToken` is required. Config validation will reject the change if you enable Even AI without setting the token.

When the phone WebUI shows **Use Even AI with OcuClaw**, ask the detected host:

> I want to enable Even AI for OcuClaw. Use the OcuClaw setup skill and guide me through it.

The agent-led and manual paths use the same six checkpoints: **Unlock Agent
Configuration**; **Store the private secret**; **Enable Even AI**; **Create and
verify the private `:8443` route**; configure the **Even Realities app**; and
finish with a **real Even AI request from the glasses**. Keep the **Even AI
agent URL** separate from the **OcuClaw app relay address**.

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
# External debug access permits bounded diagnostic capture, preview, cache, and
# local save on the OpenClaw host. It does not itself make app events stream live.
openclaw config set plugins.entries.ocuclaw.config.externalDebugToolsEnabled true --strict-json
# Developer hosts can auto-arm the full app + relay preset. When omitted on
# OpenClaw, this follows the resolved externalDebugToolsEnabled value.
openclaw config set plugins.entries.ocuclaw.config.debugAutoArm true --strict-json
# Separate upload consent: allowDebugUpload permits full-bundle handoff to the
# phone for a user-initiated upload. It requires externalDebugToolsEnabled too.
openclaw config set plugins.entries.ocuclaw.config.allowDebugUpload true --strict-json
# Per-channel filters that suppress or sample noisy debug events.
openclaw config set plugins.entries.ocuclaw.config.debugNoisyPolicies '{}' --strict-json
```

`externalDebugToolsEnabled` admits authenticated tools and permits Debug Report
assembly/local save. `debugAutoArm` only controls fresh-start app-side live leases:
normal capture remains in the phone ring and folds into the report on Submit when no
lease is active. `debugctl set` can still lease specific categories at any time.

Run `openclaw plugins inspect ocuclaw` to see all settings with their descriptions and defaults.

## Enable

```bash
openclaw plugins enable ocuclaw
```

## Reload and verify

OpenClaw normally reloads plugin and config changes itself. Verify first with
the commands below. If the gateway is live but inspection still shows a stale
runtime, request one safe restart:

```bash
openclaw gateway restart --safe
```

## Verify

```bash
openclaw plugins inspect ocuclaw --runtime
openclaw plugins doctor
openclaw gateway status
```
