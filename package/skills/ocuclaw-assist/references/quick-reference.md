# OcuClaw quick reference

**Guide version:** 2026-09-19 (1.0.56)

Reminders only. For recovery procedures, load
`{baseDir}/references/troubleshooting.md`. Back to the skill's SKILL.md. The
`Step N` pointers in the table resolve in
`{baseDir}/references/fresh-install.md`.

## Quick reference

| What | Value |
|---|---|
| Relay address (OcuClaw app) | `wss://<node>.<tailnet>.ts.net:8444` |
| Even AI agent URL | `https://<node>.<tailnet>.ts.net:8443/v1/chat/completions` |
| Relay backend | `localhost:<wsPort>` (plugin-hosted; `wsPort` = `47800` on a fresh install — confirm with `openclaw config get plugins.entries.ocuclaw.config.wsPort`) |
| Install / enable / update | `openclaw plugins install clawhub:ocuclaw` · `openclaw plugins enable ocuclaw` · `openclaw plugins update ocuclaw` (explicit npm fallback: `openclaw plugins install npm:ocuclaw`) |
| Assistant install / update | Ships inside the plugin: `openclaw plugins install clawhub:ocuclaw` installs both, `openclaw plugins update ocuclaw` updates both. There is no separate assistant package. A separately installed copy shadows the bundled one silently: `openclaw skills info ocuclaw-assist --json` names the active copy (`source: openclaw-extra` is the bundled one). Clear a shadow with `openclaw skills remove ocuclaw-assist` where that verb exists, otherwise delete the folder holding the `filePath` that command reports. OpenClaw 2026.7.x has no `skills remove`. |
| Restart / status / doctor | Verify reload first; live-but-stale runtime: one `openclaw gateway restart --safe` · `openclaw gateway status` · `openclaw plugins doctor` |
| Config root | `plugins.entries.ocuclaw.config.*` via `openclaw config set` |
| Containerized host | Keep (or restore) loopback for host networking, a same-namespace proxy, or unknown topology. After a real connection failure, only a confirmed bridge/named network with the ingress proxy outside that namespace may use container `wsBind` `0.0.0.0`; DOCKER-RELAY-UNREACHABLE must first prove the host publish is `127.0.0.1:<wsPort>:<wsPort>`. |
| Agent tool access | Apply SKILL.md's **Capability-first controller routing** table (Step 4 / AGENT-TOOLS-FILTERED). |
| Optional continuation | Matching advertised bundle: Home **Optional setup → Choose what to add**; **Settings → Optional setup** always reopens it. Home dismissal and capability skips are separate; preserve pairing/core receipts. |
| Private phone entry | Masked field, explicit existing-secret replacement, then **Save and apply** on supported hot-reload OpenClaw. Reconnect and refresh active readback; a save is not a test. Unsupported activation stays pending. |
| Phone diagnostics | Preview one permission, explicitly confirm, then compare Saved choice with Active readback. Sending a report still requires its separate review and Send action. |
| Optional capability commands | On an advertised bundle: `openclaw ocuclaw credential soniox` or `credential even-ai` for hidden user entry; `even-ai enable/status/route/verify`; `diagnostics status`, `diagnostics access allow\|deny`, `diagnostics handoff allow\|deny`. Follow the observed activation result; generic restart guidance above does not authorize a Cloudways optional restart. Load fresh-install Steps 11/12/12b for the selected capability only. |
| Check versions | `npm view ocuclaw version` (latest) · `dist-tags` (channels) · `versions` (history) |
| Update / switch channel | `openclaw plugins update ocuclaw` (follows the recorded install source) · `update ocuclaw@beta` (move to beta — npm and ClawHub both carry the `beta` tag since 2.0.4) · `install clawhub:ocuclaw --force` (roll back / move to the stable ClawHub lane) |
| Bug report with diagnostics | `externalDebugToolsEnabled` permits bounded diagnostic capture, preview, cache, and local save; `allowDebugUpload` separately permits full-bundle handoff to the phone for user-initiated upload (requires both, plugin ≥ 1.3). Then app Settings → **Client Debug Enabled** → yellow bug icon → **Send Bug Report** → post the `OCU-…` ticket in Discord (ESCALATE Lane 1 / Step 12b) |
| Community / support | Discord `https://discord.ocuclaw.com` |
| Donate (optional — not paid support) | `https://buymeacoffee.com/ocuclaw` |
