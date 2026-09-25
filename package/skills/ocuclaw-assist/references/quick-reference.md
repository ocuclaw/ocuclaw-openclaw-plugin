# OcuClaw quick reference

**Guide version:** 2026-09-25 (1.0.58)

Reminders only. For recovery procedures, load
`{baseDir}/references/troubleshooting.md`. Back to the skill's SKILL.md. The
`Step N` pointers in the table resolve in
`{baseDir}/references/fresh-install.md`.

## Quick reference

| What | Value |
|---|---|
| Relay address (OcuClaw app) | `wss://<node>.<tailnet>.ts.net:8444` |
| Even AI agent URL | `https://<node>.<tailnet>.ts.net:8443/v1/chat/completions` |
| Relay backend | `127.0.0.1:<wsPort>` (plugin-hosted; `wsPort` = `47800` on a fresh install — confirm with `openclaw config get plugins.entries.ocuclaw.config.wsPort`) |
| Install / enable / update | `openclaw plugins install clawhub:ocuclaw` · `openclaw plugins enable ocuclaw` · `openclaw plugins update ocuclaw@latest` (npm record) or `openclaw plugins update ocuclaw` (ClawHub record) (explicit npm fallback: `openclaw plugins install npm:ocuclaw`) |
| Install consent (OpenClaw 2026.9.x) | Install and update can need consent to OcuClaw's 8 tools + 2 skills. Ask once inside the install/update checkpoint, as ONE final message (tools, skills, command, then the question; nothing in an interim/commentary message); after a clear yes add `--accept-capabilities` only when `openclaw plugins install --help` (or `update --help`) lists it; 2026.7.x rejects it. Never `--force` an install from ClawHub; npm beta needs `--force` too. Declined → hand the plain command, no probe and no `--accept-capabilities`, to the person's terminal; OpenClaw asks its own `y/N` and they answer it. recovery-routing.md → **Installation consent and recorded source** |
| Assistant install / update | Ships inside the plugin: `openclaw plugins install clawhub:ocuclaw` installs both, the plugin update (row above) updates both. There is no separate assistant package. A separately installed copy shadows the bundled one silently: `openclaw skills info ocuclaw-assist --json` names the active copy (`source: openclaw-extra` is the bundled one). Clear a shadow with `openclaw skills remove ocuclaw-assist` where that verb exists, otherwise delete the folder holding the `filePath` that command reports. OpenClaw 2026.7.x has no `skills remove`. |
| Restart / status / doctor | Verify reload first; live-but-stale runtime: one `openclaw gateway restart --safe` · `openclaw gateway status` · `openclaw plugins doctor` |
| Config root | `plugins.entries.ocuclaw.config.*` via `openclaw config set` |
| Containerized host | Keep (or restore) loopback always. Tailscale must run where the gateway runs (same namespace; userspace networking is fine) because the controller reads `tailscale serve status` from the gateway process's PATH. A bridge/named network with the ingress proxy outside that namespace cannot pass Step 7 or Step 9: move Tailscale, never widen `wsBind`. DOCKER-RELAY-UNREACHABLE is that move, not a widening recipe. |
| Agent tool access | Apply SKILL.md's **Capability-first controller routing** table (Step 4 / AGENT-TOOLS-FILTERED). |
| Optional continuation | Matching advertised bundle: Home's **Optional setup** card, buttons **Set up voice** and **Set up Even AI**; later re-entry is **Settings > Voice** and **Settings > Defaults > Even AI**. The card has no other buttons, and Settings has no separate optional-setup row. Diagnostics live at **Settings > Display > debug section > Diagnostics**. Home dismissal and capability skips are separate; preserve pairing/core receipts. |
| Private phone entry | Masked field, explicit existing-secret replacement, then **Save and apply** on supported hot-reload OpenClaw. Reconnect and refresh active readback; a save is not a test. Unsupported activation stays pending. |
| Phone diagnostics | Preview one permission, explicitly confirm, then compare Saved choice with Active readback. Sending a report still requires its separate review and Send action. |
| Optional capability commands | On an advertised bundle: `openclaw ocuclaw credential soniox` or `credential even-ai` for hidden user entry; `even-ai enable/status/route/verify`; `diagnostics status`, `diagnostics access allow\|deny`, `diagnostics handoff allow\|deny`. Follow the observed activation result; generic restart guidance above does not authorize a Cloudways optional restart. Load fresh-install Steps 11/12/12b for the selected capability only. |
| Check versions | `npm view ocuclaw version` (latest) · `dist-tags` (channels) · `versions` (history) |
| Update / switch channel | Read `install.source` in `openclaw plugins inspect ocuclaw --json`. npm: `openclaw plugins update ocuclaw@latest` (moves to newest stable; bare `update ocuclaw` follows the recorded spec and can stay on a pinned `ocuclaw@1.3.7` or the `beta` tag). ClawHub: `openclaw plugins update ocuclaw` (a ClawHub record does not match `ocuclaw@latest`: OpenClaw 2026.7.x skips it with no update, 9.x errors) · `update ocuclaw@beta` (move to beta — npm and ClawHub both carry the `beta` tag since 2.0.4) · `install clawhub:ocuclaw --force` (roll back / move to the stable ClawHub lane; a replacement the person asked for, the only ClawHub case for `--force`). On 2026.9.x each can need the consent row above. |
| Bug report with diagnostics | `externalDebugToolsEnabled` permits bounded diagnostic capture, preview, cache, and local save; `allowDebugUpload` separately permits full-bundle handoff to the phone for user-initiated upload (requires both, plugin ≥ 1.3). Then app Settings → **Client Debug Enabled** → yellow bug icon → **Send Bug Report** → post the `OCU-…` ticket in Discord (ESCALATE Lane 1 / Step 12b) |
| Community / support | Discord `https://discord.ocuclaw.com` |
| Donate (optional — not paid support) | `https://buymeacoffee.com/ocuclaw` |
