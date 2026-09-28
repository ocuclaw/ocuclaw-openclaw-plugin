# OcuClaw configuration reference

This is the manual reference for the OpenClaw plugin half of OcuClaw on your
Even Realities G2 smart glasses. Most people never need it: install the plugin
and ask your agent to **set up OcuClaw**, or follow the guide at
https://ocuclaw.com/setup. The phone app, Tailscale and pairing are covered
there, not here.

## Install

Stable releases use the explicit ClawHub source:

```bash
openclaw plugins install clawhub:ocuclaw
```

npm is the explicit fallback (`openclaw plugins install npm:ocuclaw`) and
carries beta builds (`openclaw plugins install npm:ocuclaw@beta`).

On OpenClaw 2026.9 and later the install asks you to confirm (`y/N`). It lists
what OcuClaw may do: 8 tools (draw on your glasses, manage LiveUI templates and
tasks, read the glasses and device state, set session titles, read your
location, run setup) and 2 skills (the glasses UI guide and the Setup
Assistant). Answer `y` to install. ClawHub may ask twice; answer `y` both times.
If your agent runs the install for you, it asks you the same question in chat
first and never answers for you. Older OpenClaw hosts do not ask.

The plugin update can ask again when a new version adds a tool, and on the
first update after you upgrade OpenClaw from 2026.7. In a script with no
terminal, add `--accept-capabilities` once you have reviewed the list;
OpenClaw 2026.7 does not know that flag. An npm install on 2026.9 also needs
`--force`, because npm is outside ClawHub review. Never add `--force` to the
install from ClawHub.

The OcuClaw Setup Assistant ships inside the plugin, so the plugin update keeps
it in step. There is no separate assistant package to install. If you
installed the standalone `ocuclaw-assist` skill before it was retired, it
silently overrides the plugin's copy and pins you to an old guide. Clear it
once and the bundled assistant takes over: `openclaw skills remove
ocuclaw-assist` where your host has that verb, otherwise delete the folder
holding the `filePath` that `openclaw skills info ocuclaw-assist --json`
reports. OpenClaw 2026.7.x has no `skills remove`.

## Relay credential

Nothing to type for the relay credential. The first time the plugin loads
without one it creates a private Relay Credential on this host and the relay
starts with it; the phone receives it through `openclaw ocuclaw pair`, never by
retyping. Until that first load the plugin is unconfigured and does not open
the relay listener. An existing credential is never replaced. To keep the relay
off on purpose, disable the plugin (`openclaw plugins disable ocuclaw`); an
emptied credential is refilled at the next load.

## Voice

- `sonioxApiKey`: turns on Soniox speech-to-text for voice input.

```bash
openclaw config set plugins.entries.ocuclaw.config.sonioxApiKey "your-soniox-api-key"
```

## Even AI

When the phone WebUI shows **Use Even AI with OcuClaw**, ask the detected host:

> I want to enable Even AI for OcuClaw. Use the OcuClaw setup skill and guide me through it.

The agent-led and manual paths use the same six checkpoints: **Unlock Agent
Configuration**; **Store the private secret**; **Enable Even AI**; **Create and
verify the private `:8443` route**; configure the **Even Realities app**; and
finish with a **real Even AI request from the glasses**. Keep the **Even AI
agent URL** separate from the **OcuClaw app relay address**.

The keys behind those checkpoints:

- `evenAiToken`: the password you create for Even AI requests. It must match
  the password in the Even AI Agent Configure section of the Even Realities app.
- `evenAiEnabled`: turns on Even AI for OcuClaw after the token is stored.

```bash
openclaw config set plugins.entries.ocuclaw.config.evenAiToken "your-even-ai-token"
openclaw config set plugins.entries.ocuclaw.config.evenAiEnabled true --strict-json
```

When `evenAiEnabled` is `true`, `evenAiToken` is required. Config validation
rejects the change if you turn on Even AI without the token.

Optional Even AI tuning (only used when `evenAiEnabled` is `true`):

- `evenAiRoutingMode`: `active` routes through the current session (default),
  `background` reuses a dedicated background session, `background_new` starts a
  fresh background session per request.
- `evenAiSystemPrompt`: extra system prompt added to Even AI runs only.

```bash
openclaw config set plugins.entries.ocuclaw.config.evenAiRoutingMode "active"
openclaw config set plugins.entries.ocuclaw.config.evenAiSystemPrompt "your-extra-prompt"
```

These two seed the Even AI settings on first boot. If you use the OcuClaw
glasses client or phone WebUI, the in-app Even AI settings editor takes over
afterward, and later changes to these keys do not affect live behaviour unless
the stored settings are reset. For hosts that use only the direct Even
Realities Even AI pathway and never launch the OcuClaw client, these keys are
the only way to set routing mode and system prompt. `evenAiSystemPrompt` has no
glasses-side editor, so set it in the phone WebUI or config.

## Advanced settings

```bash
openclaw config set plugins.entries.ocuclaw.config.wsBind "127.0.0.1"
# A fresh install uses port 47800; older installs keep 9000.
# Pick any free port in 30000-49151 if you override it.
openclaw config set plugins.entries.ocuclaw.config.wsPort 47800 --strict-json
# Recent sessions fetched for the WebUI switcher/search list (default 80). Glasses
# clamp to their own item-count cap, so this only widens the WebUI list.
openclaw config set plugins.entries.ocuclaw.config.sessionLimit 80 --strict-json
# Optional model override ("provider/model") for the background session-title
# distiller. A small, fast, inexpensive model is a good choice. Leave unset to use
# your normal model.
openclaw config set plugins.entries.ocuclaw.config.sessionTitleModel "provider/model"
# How long render_glasses_ui waits for a user pick before resolving { result: "timeout" }.
# Default 1800000 (30 minutes); 0 turns the timeout off (infinite wait).
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
lease is active. Debug tools can still lease specific categories at any time.

Every setting, with its description and default, is listed in
`openclaw.plugin.json` in this package.

## Enable, reload and verify

```bash
openclaw plugins enable ocuclaw
```

OpenClaw normally reloads plugin and config changes itself. Verify first:

```bash
openclaw plugins inspect ocuclaw --runtime
openclaw plugins doctor
openclaw gateway status
```

If the gateway is live but inspection still shows a stale runtime, request one
safe restart:

```bash
openclaw gateway restart --safe
```
