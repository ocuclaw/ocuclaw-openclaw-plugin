# OcuClaw beta channel & rollback

**Guide version:** 2026-09-25 (1.0.58)

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
- [ ] Selected an obtainable compatible pair and approved source; update or rollback + reload/restart verified
- [ ] Verified: expected Version + Status: loaded + quick message test

**Pre-flight:** If the evenAiEnabled probe = 1 and the evenAiToken probe = 0 → run **CASE-D** before proceeding. Then run the **Migration pre-flight** from `{baseDir}/references/update.md` (hooks.allowConversationAccess + tool access) — beta moves and rollbacks need the same keys as stable updates; changes take effect through the reload/restart verification below.

Before the first mutation in this entry, give rule 5's warning once because
OpenClaw may reload while applying policy or plugin changes. Do not repeat the
warning for each command.

Follow recovery-routing.md's **Interrupted upgrade, retry and compatible
recovery** checks before changing either component and after a failed attempt.

OpenClaw 2026.9.x can ask for consent when a beta adds tools or skills, and on
the first update after the host moved from 2026.7.x. Follow recovery-routing.md's
**Installation consent and recorded source**: ask once inside this checkpoint,
as ONE final message that ends with the question, then probe `--help` for the
flag. Never consent for the person; declined → the plain command, no
`--accept-capabilities`.

**Move to a newer beta:**

```
u=(); openclaw plugins update --help 2>&1 | grep -q -- '--accept-capabilities' && u+=(--accept-capabilities)
openclaw plugins update ocuclaw@beta "${u[@]}"
```

To move to a specific pinned build from the Discord (e.g. `1.3.0-beta.2`):

```
openclaw plugins update ocuclaw@1.3.0-beta.2 "${u[@]}"
```

Re-run `update ocuclaw@beta` later to jump to a newer beta when one drops.

**Roll back to stable (if a beta misbehaves):**

First read recovery-routing.md and verify an obtainable compatible client/bundle
pair. Stable 1.3.7 cannot serve a client requiring bundle >=2.0.2. If Even Hub
does not offer a compatible older phone app, do not run the downgrade below;
retain the current installation and identify an obtainable forward-recovery
candidate. The complete 1.3.7 migration/rollback proof is pending separate work.
Only after compatibility, source and explicit rollback approval are established,
select the exact target version on the existing source where available and follow
recovery-routing.md's **Installation consent and recorded source** procedure.
Do not silently switch an npm installation to ClawHub or use a moving `latest`
tag as the rollback identity. If the recorded source cannot supply that version,
establish an approved obtainable source before proceeding.

Rollback is an explicit installation replacement: `update ocuclaw` can remain
on the tracked beta spec. On the current host replacement needs both source and
capability consent, not `--force` alone. Preserve and compare relayToken, port,
enablement and phone connection settings. A technical rollback with retained or
rebuilt client bytes does not establish an obtainable phone downgrade. If that
client cannot be installed, use the compatible forward-recovery branch above.

**After either action** — allow OpenClaw's reload planner to act, then run
VERIFY. If the gateway is live but still serves the old runtime, request one
`openclaw gateway restart --safe` and repeat VERIFY; do not restart
pre-emptively.

**VERIFY:** `openclaw plugins inspect ocuclaw --runtime` shows the expected `Version:` and `Status: loaded` (the `--runtime` flag confirms live runtime registration, not just registry state). Run a quick Step 10 message test. On success → load `{baseDir}/references/wrap-feedback.md` and deliver the **WRAP** closing note.

**If failed:** HOST-OLD if a beta requires a newer OpenClaw; the app still reporting "plugin mismatch / update required" while `inspect` shows the expected version → PLUGIN-RUNTIME-STALE (`{baseDir}/references/troubleshooting.md`); otherwise assemble the **BETA-REPORT** bundle (`{baseDir}/references/troubleshooting.md`) for the beta Discord — it includes the in-app debug-upload option, which attaches real diagnostics.
