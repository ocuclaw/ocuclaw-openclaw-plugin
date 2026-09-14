# OcuClaw quick reference

**Guide version:** 2026-09-14 (1.0.43)

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
| Assistant install / update | Active workspace: `openclaw skills install @ocuclaw/ocuclaw-assist` · specific agent: add `--agent <agent-id>` · shared managed `~/.openclaw/skills`: add `--global` · update the same scope with `openclaw skills update @ocuclaw/ocuclaw-assist` plus the same scope flag |
| Restart / status / doctor | Verify reload first; live-but-stale runtime: one `openclaw gateway restart --safe` · `openclaw gateway status` · `openclaw plugins doctor` |
| Config root | `plugins.entries.ocuclaw.config.*` via `openclaw config set` |
| Containerized host | Keep (or restore) loopback for host networking, a same-namespace proxy, or unknown topology. After a real connection failure, only a confirmed bridge/named network with the ingress proxy outside that namespace may use container `wsBind` `0.0.0.0`; DOCKER-RELAY-UNREACHABLE must first prove the host publish is `127.0.0.1:<wsPort>:<wsPort>`. |
| Agent tool access | Apply SKILL.md's **Capability-first controller routing** table (Step 4 / AGENT-TOOLS-FILTERED). |
| Check versions | `npm view ocuclaw version` (latest) · `dist-tags` (channels) · `versions` (history) |
| Update / switch channel | `openclaw plugins update ocuclaw` (follows the recorded install source) · `update ocuclaw@beta` (move to beta — npm and ClawHub both carry the `beta` tag since 2.0.4) · `install clawhub:ocuclaw --force` (roll back / move to the stable ClawHub lane) |
| Bug report with diagnostics | `externalDebugToolsEnabled` permits bounded diagnostic capture, preview, cache, and local save; `allowDebugUpload` separately permits full-bundle handoff to the phone for user-initiated upload (requires both, plugin ≥ 1.3). Then app Settings → **Client Debug Enabled** → yellow bug icon → **Send Bug Report** → post the `OCU-…` ticket in Discord (ESCALATE Lane 1 / Step 12b) |
| Community / support | Discord `https://discord.ocuclaw.com` |
| Donate (optional — not paid support) | `https://buymeacoffee.com/ocuclaw` |
