# OcuClaw beta channel & rollback

**Guide version:** 2026-07-17 (1.0.41)

**Beta-Discord testers only.** Beta builds are pre-release and can be unstable.
If the user is **not** a confirmed beta-testing Discord member, this is the wrong
file — load `{baseDir}/references/update.md` for the normal stable update
instead.

Return to the skill's SKILL.md for the guardrails and router.

The "quick Step 10 message test" referenced below is in
`{baseDir}/references/fresh-install.md`; named failure cases (CASE-D,
HOST-OLD, BETA-REPORT) are in `{baseDir}/references/troubleshooting.md`; the
WRAP closing note is in `{baseDir}/references/wrap-feedback.md`. To see what
beta builds exist, run the version-landscape checks in
`{baseDir}/references/update.md`.

## B1 — Beta channel (beta-Discord testers only) — UPDATE / ROLLBACK ONLY

**Gate:** Beta builds are for members of the beta-testing Discord group and can be unstable. If the user is not a confirmed beta-Discord member, route them to the stable update — load `{baseDir}/references/update.md`. Continue only once confirmed.

**B1 checklist — copy and tick:**
- [ ] Confirmed the user is a beta-Discord tester (gate)
- [ ] Pre-flight: evenAi consistent (else CASE-D first)
- [ ] Migration pre-flight: hooks + tool access verified (per update.md)
- [ ] Moved to target beta (update ocuclaw@beta) — or rolled back (install clawhub:ocuclaw --force) — + reload/restart verified
- [ ] Verified: expected Version + Status: loaded + quick message test

**Pre-flight:** If the evenAiEnabled probe = 1 and the evenAiToken probe = 0 → run **CASE-D** before proceeding. Then run the **Migration pre-flight** from `{baseDir}/references/update.md` (hooks.allowConversationAccess + tool access) — beta moves and rollbacks need the same keys as stable updates; changes take effect through the reload/restart verification below.

Before the first mutation in this entry, give rule 5's warning once because
OpenClaw may reload while applying policy or plugin changes. Do not repeat the
warning for each command.

**Move to a newer beta:**

```
openclaw plugins update ocuclaw@beta
```

To move to a specific pinned build from the Discord (e.g. `1.3.0-beta.2`):

```
openclaw plugins update ocuclaw@1.3.0-beta.2
```

Re-run `update ocuclaw@beta` later to jump to a newer beta when one drops.

**Roll back to stable (if a beta misbehaves):**

```
openclaw plugins install clawhub:ocuclaw --force
```

Why `--force`: rolling back is usually a downgrade; plain `install` aborts as "already installed," and `update ocuclaw` stays on the tracked `@beta` spec — `--force` is the documented overwrite path. The `clawhub:` prefix pins the stable lane (ClawHub carries stable releases only; betas live on npm). Expect the community-channel advisory line — a notice, not an error. Plugin config (relayToken etc.) survives the swap. If the host rejects the `clawhub:` prefix (older builds): `openclaw plugins install npm:ocuclaw@latest --force`.

**After either action** — allow OpenClaw's reload planner to act, then run
VERIFY. If the gateway is live but still serves the old runtime, request one
`openclaw gateway restart --safe` and repeat VERIFY; do not restart
pre-emptively.

**VERIFY:** `openclaw plugins inspect ocuclaw --runtime` shows the expected `Version:` and `Status: loaded` (the `--runtime` flag confirms live runtime registration, not just registry state). Run a quick Step 10 message test. On success → load `{baseDir}/references/wrap-feedback.md` and deliver the **WRAP** closing note.

**If failed:** HOST-OLD if a beta requires a newer OpenClaw; the app still reporting "plugin mismatch / update required" while `inspect` shows the expected version → PLUGIN-RUNTIME-STALE (`{baseDir}/references/troubleshooting.md`); otherwise assemble the **BETA-REPORT** bundle (`{baseDir}/references/troubleshooting.md`) for the beta Discord — it includes the in-app debug-upload option, which attaches real diagnostics.
