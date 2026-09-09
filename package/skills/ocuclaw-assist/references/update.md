# Updating OcuClaw

**Guide version:** 2026-07-17 (1.0.41)

This is the **stable update** path — for any already-installed OcuClaw user. You
do **not** need to be a beta tester to be here. For the **beta channel** (newer
pre-release builds) or a **rollback** from beta back to stable — beta-Discord
testers only — load `{baseDir}/references/beta.md` instead.

For a first-time install, this is the wrong file — load
`{baseDir}/references/fresh-install.md` instead.

Return to the skill's SKILL.md for the guardrails and router.

The "quick Step 10 message test" referenced below is in
`{baseDir}/references/fresh-install.md`; named failure cases (CASE-D,
HOST-OLD, ESCALATE) are in `{baseDir}/references/troubleshooting.md`; the WRAP
closing note is in `{baseDir}/references/wrap-feedback.md`.

## U1 — Update OcuClaw (already installed and healthy)

**U1 checklist — copy and tick:**
- [ ] Checked installed vs. latest version, told the user
- [ ] Pre-flight: evenAiEnabled/evenAiToken consistent (else CASE-D first)
- [ ] Migration pre-flight: hooks + tool access verified
- [ ] Updated + reload/restart verified (warning given)
- [ ] Verified: new Version + Status: loaded + quick message test

**CHECK / LIST — gather the version landscape and translate for the user:**

```
openclaw plugins inspect ocuclaw
```
Note the `Version:` line (installed version).

```
npm view ocuclaw version
```
Latest stable version.

```
npm view ocuclaw dist-tags
```
Available channels (`latest`, `beta`).

```
npm view ocuclaw versions --json
```
```
npm view ocuclaw time --json
```
Read the tail of those lists yourself and show the user only the most recent few versions with dates — e.g. "you're on 1.2.4 (Apr 3); latest is 1.3.0 (Jun 6)". Do not dump the full list. For what changed, point at the changelog or Discord — npm carries no release notes.

If installed == latest stable: tell them they're up to date. If they confirm they're a beta-Discord tester and want newer pre-release builds, load `{baseDir}/references/beta.md`; otherwise you're done.

**Pre-flight:** If the evenAiEnabled probe = 1 and the evenAiToken probe = 0 → run **CASE-D** before proceeding.

Before the first mutation in this entry, give rule 5's warning once because
OpenClaw may reload while applying policy or plugin changes. Do not repeat the
warning for each command.

**Migration pre-flight** — existing installs may predate keys that newer plugin versions need; fix them now so the reload/restart verification below picks everything up (for both reads, "Config path not found" just means unset — the command exits nonzero; record it, it's not a blocker):

1. `openclaw config get plugins.entries.ocuclaw.hooks.allowConversationAccess` — if not `true`, run:
   ```
   openclaw config set plugins.entries.ocuclaw.hooks.allowConversationAccess true --strict-json
   ```
   (Non-secret but privacy-relevant — OpenClaw only runs a plugin's conversation-lifecycle hooks with this set. For OcuClaw those hooks do end-of-turn housekeeping: settle any glasses-display, device-info, or location call still pending when a turn ends so nothing hangs; apply the Even-AI model preference; and name sessions with a short title distilled from the conversation — that last part reads conversation content, which is why the host gates it behind the user's explicit OK; tell the user that's what it's for.)
2. `openclaw config get tools` — this is the root pre-flight clue. Plugin
   builds carrying this guide expose OcuClaw's tools by default, so most
   installs need no change here (a leftover `alsoAllow: ["ocuclaw"]` from an
   older setup is harmless — leave it). Act only on a restrictive policy: a
   non-empty `allow` lacking `"ocuclaw"`/`"group:plugins"` → merge `"ocuclaw"`
   into it (never set `allow` and `alsoAllow` in the same scope); a blocking
   `deny` → STOP and ask the user. Apply SKILL.md's **Capability-first
   controller routing** table after restart; this root check is not the
   effective-session verdict.

No extra restart for these — they take effect at the post-update restart below.

**DO:**

```
openclaw plugins update ocuclaw
```

`update` follows the install's **recorded source**: installs tracked against npm
keep updating from npm — that is fine and fully supported; do NOT migrate a
working install just because the fresh-install lane now uses ClawHub. If the
user *asks* to move to the ClawHub lane, it's a one-time
`openclaw plugins install clawhub:ocuclaw --force` (plugin config — relayToken,
port, enablement — survives the swap; expect the community-channel advisory
line, a notice, not an error), then continue with the restart below.

Allow OpenClaw's reload planner to act, then run the VERIFY below. If the
gateway is live but still serves the old runtime, request one
`openclaw gateway restart --safe` and repeat VERIFY; do not restart
pre-emptively.

**VERIFY:** `openclaw plugins inspect ocuclaw --runtime` shows the new `Version:` and `Status: loaded` (the `--runtime` flag confirms live runtime registration, not just registry state). Report the guide and observed plugin versions, then apply SKILL.md's **Capability-first controller routing** table. Run a controller `verify` only when the selected lane says that surface exists; an older loaded plugin stays on the standalone version lane. Run a quick Step 10 message test. On success → load `{baseDir}/references/wrap-feedback.md` and deliver the **WRAP** closing note.

**If failed:** CASE-D if validation rejected the update; HOST-OLD if OpenClaw is too old for the new version; the app still reporting "plugin mismatch / update required" while `inspect` shows the new version → PLUGIN-RUNTIME-STALE; otherwise ESCALATE.
