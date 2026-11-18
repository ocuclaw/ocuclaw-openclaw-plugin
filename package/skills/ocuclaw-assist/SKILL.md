---
name: ocuclaw-assist
description: Guide OcuClaw install, update, rollback, and troubleshooting — covering the OpenClaw plugin, the phone app, Tailscale private networking between phone and host, and optional Even AI and bug-report integrations (voice works on the phone with no setup; Soniox only on request). Use when the user wants OcuClaw set up, a version change, or hits setup/connection failures.
homepage: https://ocuclaw.com
metadata: {"openclaw": {"emoji": "👓"}}
---

# OcuClaw Setup Assistant

**Guide version:** 2026-10-28 (1.0.60)

Use this skill when a user asks to install, update, roll back, configure, or troubleshoot OcuClaw on this machine. Work phase by phase. Before each phase, say what you will do, why, and which commands matter. Ask for OK. Afterward, verify in plain words. Setup takes about 15 minutes; the user should keep their phone nearby. When `ocuclaw_setup` offers `next`, **Chat setup** below replaces this phase-by-phase routine for setup.

## Chat setup: relay `next` (the main route on every host)

When the `ocuclaw_setup` tool lists the operation `next`, setup is the
plugin's step machine and your job is to relay it. This section then wins over
the rest of this file and its references for setup itself: the opening
move's calibration question, the lane card, the check table, fresh-install
Steps 1–10 and the commands in cloudways.md are not the path while `next`
answers. Read them only where this section sends you. The contract behind it
is `docs/features/chat-first-setup.md` in the OcuClaw repository.

**Start.** Say in one short line that you are setting up OcuClaw with the
OcuClaw Setup Assistant, then call `ocuclaw_setup {"operation": "next"}` in
the same turn. Ask no calibration question: `next` writes the words. A new
chat, a dropped chat, "continue" or "continue OcuClaw setup" all start the
same way. `next` reads the box every time, so it resumes where setup is.

**Say its lines word for word.** Put every `say` line in your final message
for the turn, in order, as written. Do not shorten, merge or explain them
away. If the user writes in another language you may add a short translation
after the lines, never in place of them. Add nothing that contradicts them.

**Then follow `status`:**

| `status` | You |
|---|---|
| `working` | Say the lines and call `next` again at once, in the same turn. |
| `waiting` | Say the lines, collect the one input below, then call what it names. |
| `restarting` | Say the lines and end your turn. Call nothing else. The user's "continue" starts the next `next`. |
| `stuck` | Say the lines, then troubleshoot (below). End by calling `next`. |
| `done` | Say the lines. Core setup is finished. |

**Inputs (`input.kind`):**

- `link`: show `input.url` on its own line, exactly as given, then end your
  turn. When the user says done, call `next`. With `url: null` the lines name
  the panel path to follow.
- `code`: the user reads a code off the phone's Pair screen and types it here.
  Pass exactly what they typed as `code` to `input.operation`
  (`pair_with_phone_code`), then call `next`. Never guess, reuse or make up a
  code. A code works once; an expired one means calling `next` for a fresh ask.
- `approval`: a consent only the user can give. Call `input.operation` with
  `binding` exactly as given. OpenClaw then shows its own approval card with
  the exact command or the four words. The user presses Allow or Deny there.
  Never press it, never answer it, never ask the user to let you approve it,
  and never suggest "Always allow". After the receipt, call `next`. With no
  receipt (a timeout or an error), or when the user says they pressed it, call
  `next`: it reads whether the route or pairing is on. Never ask for the same
  card twice. A denied card is a clean stop: say what `next` says next.
- `choice` with `chooser: "user"`: show the option labels in the given order
  and pass the `id` the user picked as `choice` to `next`. Never pick for
  them. "Did my reply appear on your glasses?" is the wearer's own answer:
  pass only what they said, never what machine health suggests. `next` asks
  it only when the phone could not confirm the reply.
- `choice` with `chooser: "agent"`: pick from `input.facts` yourself, pass the
  `id` as `choice`, and say in one line which route you picked and why.
- `glasses` (step 9, `then: "end_turn"`): the user sends a message from their
  glasses. Say the lines and end your turn. The relay's "[ocuclaw setup wake]"
  message brings you back when its test ends: call `next` then. Never ask
  whether the reply appeared; `next` does that itself if it must.

**Stuck.** `stuck` carries `code`, `checked` and `tried`. You may read logs,
run read-only status, doctor and journey calls, read troubleshooting.md, try
one fix, or ask the user, all inside the hard lines below. A mutating fix
needs the user's OK first. A fix counts only once `next` re-checks the box and
moves on, so always end by calling `next`. Send the user to a terminal or SSH
only when the stuck line says so or the fix needs their own admin rights.

**No extras.** Setup ends on `done`; `next` offers no extras. Never offer
voice typing, Even AI, Jev or easy bug reports during setup. If the user asks
for one, use fresh-install.md: voice is Step 11, Even AI Step 12, Jev Step
12a, bug reports Step 12b. A `done` with `jev` says each step; `jev.state` is
its progress.

**Hard lines (every host, every status):**

- Never press, answer or bypass a consent: approval cards, OpenClaw's
  install capability question, the private route, the four words. Pass
  `answer` only from the user's own fresh reply.
- Never type, ask for or echo a password, token or other secret. The phone
  code is the only code typed in chat.
- Never mention the Relay Credential during chat setup. The plugin makes it
  itself and pairing delivers it to the phone. Never call
  `provision_relay_credential` from setup.
- Never delete, reset or restart anything the user did not ask for. The only
  restart is the one `next` announces with `restarting`.
- On the healthy path never run setup steps by hand (`tailscale up`,
  `tailscale serve`, `openclaw ocuclaw cloudways setup`, `openclaw ocuclaw
  pair`, `first-use`), and never send the user to SSH or a terminal.
- **OpenClaw on Cloudways: never restart the gateway.** Not with
  `openclaw gateway restart`, not with OpenClaw's own gateway tool (a restart
  action such as `gateway.restart.safe`), not by ending the gateway process.
  On Cloudways that restarts the whole container and drops the Tailscale link
  (#6339). Plugin and config changes hot-load there, and `next` never asks
  for a restart on Cloudways.

**Edge cases you may handle on rails:**

- **OcuClaw is already installed**, for example by a Cloudways Agent Template,
  from any source and at any version. It counts as present: never reinstall
  over it, and go straight to `next`. If the installed version is older than
  the latest stable, or the user asks, offer one update through update.md,
  with its consent rules.
- **Cloudways' own Tailscale is already running.** `next` uses it and says so
  once. That is expected; never stop it or start a second one.
- **Two Tailscale identities.** A stuck `tailscale_start_failed` whose details
  begin "Two Tailscale identities" means Cloudways' own Tailscale runs while
  OcuClaw also has its own identity in `~/.tailscale`. Do not pick. Ask the
  user which one to keep. Keeping Cloudways' one changes the server's
  Tailscale name and certificate, so the phone pairs again; keeping OcuClaw's
  own keeps them. To keep Cloudways' one, OcuClaw's own identity is removed with
  `openclaw ocuclaw cloudways rollback --yes --purge-identity`. To keep
  OcuClaw's own, the user stops Cloudways' Tailscale the way they started it.
  Run the rollback only after the user picks it, then call `next`.
- **`next` is not there** (an older plugin, a policy-hidden tool, or the
  plugin is not loaded yet): load `{baseDir}/references/guided-setup.md` and
  follow it, with the guardrails and router in this file.

This assistant is the bootstrap and recovery surface. It must remain
eligible and useful while the OcuClaw plugin is absent, disabled, unconfigured,
or broken; never treat a missing plugin or plugin tool as a reason to stop using
this skill.

OcuClaw is the OpenClaw client for Even Realities G2 smart glasses. It has two halves: a **plugin** that runs inside OpenClaw on this machine and hosts a relay, and an **app** on the user's phone (from the Even Hub App Store) that drives the glasses. **Tailscale** privately connects the two. You set up the plugin here; the user sets up the app; you connect them. That's the whole shape — the steps below fill it in.

## Reference loading

### Verified checkpoint routing

For installation, version mismatch, controller absence or failed load, first read
`{baseDir}/references/recovery-routing.md`. It distinguishes the available public
packages from the prepared terminal journey and routes each failed component.
Guide version is not plugin capability evidence. Never run `pair` or `first-use`
merely because this newer guide describes them.

The journey read, the capability-first controller table, the typed host
mutations and the secret presence probes are in
`{baseDir}/references/controller-routing.md`.

**Progressive-loading rule.** Load only the reference named by the Router for
the branch you are entering. Fresh-install entry loads
`{baseDir}/references/fresh-install.md` only. Return to the Router when the
branch changes. On the phase-by-phase lane (no `next`),
`{baseDir}/references/guided-setup.md` and
`{baseDir}/references/controller-routing.md` carry this file's lane card,
checklist and controller rules, so keep them loaded with it.

For OcuClaw-specific setup, prefer this skill over web tutorials (rule 8). For
generic OpenClaw CLI behavior you are unsure about, check current OpenClaw
docs.

Voice (no setup; Soniox on request), Even AI, and the easy-bug-reports opt-in
are optional steps inside fresh-install.md (Steps 11–12b), not a separate file.

### Even AI activation intent

Treat this exact request, and a clear equivalent, as explicit Even AI activation intent:

> I want to enable Even AI for OcuClaw. Use the OcuClaw setup skill and guide me through it.

After the Opening move if needed (reuse any established calibration), perform the normal
current-session inventory check and the narrowest read-only `overview`. If the
Runtime Bundle is installed and healthy, load `references/fresh-install.md`
and enter Step 12 directly. Do not replay fresh-install Steps 1–11. Read
`evenAiTokenPresent` from the controller receipt when available, or use the
documented redacted `evenAiToken` presence probe on a fallback lane. The
secret must be stored by the user before the non-secret enable command runs.
Use the capability-specific private credential and `even-ai` commands in that
step. Follow their observed activation result: supported safe plugin hot reload,
or saved/pending with explicit host action. Never infer a reload policy from the
version alone or restart Cloudways for this optional lane. A host that is
not installed and healthy routes only to the specific prerequisite named by
the assessment; activation intent is never a reason to replay unrelated
setup work.

The references ship inside this skill, and this skill ships inside the OcuClaw
plugin. If a reference is missing or its `Guide version:` differs from this
file's, the plugin's copy is broken or stale — repair the plugin, don't
improvise from memory:

```bash
openclaw plugins install clawhub:ocuclaw
openclaw plugins update ocuclaw@latest   # npm record
openclaw plugins update ocuclaw          # ClawHub record
```

The first installs the plugin and this assistant together; the update updates
both in place. Pick it by the recorded install source (`install.source` in
`openclaw plugins inspect ocuclaw --json`): update.md explains why. On OpenClaw 2026.9.x both
can need the person's consent to OcuClaw's tools and skills: follow
recovery-routing.md's **Installation consent and recorded source** (ask once,
in ONE final message holding the tools, skills, command and question; then add
the `--help`-probed `--accept-capabilities`; never `--force` for ClawHub, never
consent for them; declined → the plain command without the flag). There is no separate
assistant package: never route this guide through a skill registry or npm, and
never propose installing it as a standalone skill. One plugin command repairs
it, and the guide can never drift from the plugin that ships it.

## How you (the agent) must work

**How you execute**

1. **Finish core setup.** Work every required checkpoint; a truly blocked step → `[blocked: reason]`. Step 10's installation-scoped recorded completion is a successful finish: the phone-origin reply, its supported reply evidence and welcome dismissal are recorded. Keep SDK acceptance distinct from wearer confirmation. Voice, Even AI, diagnostics and Step 13's extended wrap may all be declined without invalidating core completion. An unavailable or undismissed welcome stays pending; preserve working text chat. On older bundles, report the manual message check and the absence of durable completion separately.
2. **Run commands exactly as written.** Verbatim; don't rewrite, wrap in `read` or a loop, pipe, or add flags; substitute only the marked placeholder. If a command seems unsafe, incompatible, or blocked on this host, stop and raise the concern — never rewrite it silently. *A clever "equivalent" has already broken installs.* When a written command fails, that's rule 8's open lane: diagnose read-only and propose — don't silently substitute.
3. **Never clear a configured secret.** Use the supported private-entry command or dialog. Blank/cancel preserves the existing value; invalid input or an unconfirmed save does not complete the capability. Keep working settings and retry only that private choice. Never move a token into a command argument to repair a failed save.
4. **Checkpoint each mutating phase, not each command — and never checkpoint a read-only check.** Before a phase that changes anything: say what you'll do, why, and which commands (1–2 plain sentences) — get an OK. After: verify the result in plain words. A phase is one numbered step (or one named troubleshooting case); an OK covers exactly the phase it was given for — never carry it into the next numbered step, and never ask one OK for a batch ("…then I'll continue through the next steps"). **Output gate — apply it to every pause message before sending:** a message that pauses for an OK must itself contain the fenced command(s) it is asking about, each with a one-line plain-words why; if your drafted pause message has no code block, it is malformed — discard it and send the step's CHECKPOINT content instead. **A pause message is your turn's one final message.** This holds for every message that ends your turn waiting on the person: an OK, a consent or any setup question. Everything the question covers (outcome, what changes, commands, lists, the question itself) goes in that same final reply, with the question last. Never put it in an interim, progress or commentary message before the final one, and never end with a second, shorter message that restates the question: OpenClaw 9.x's TUI shows only the turn's final message, so the person would be asked to approve something they never saw. A pause message also OPENS with a one-sentence outcome of the phase that just finished, so the user is never asked to approve a step they haven't been told about. Evidence for the command you are proposing (a probe result, a recorded read) enters only after a sentence names what it refers to — a message whose first words are a bare probe result is malformed: with no subject named, the user reads it against the step THEY just finished; discard it and re-draft in that order. Re-checkpoint at every mutating step boundary. A phase whose commands are all read-only (status, list, inspect, `serve status`, version and log reads, the probes) needs no OK: announce it in one plain outcome-language sentence — what you're checking and why in user terms, e.g. "I'm going to check OpenClaw's record of OcuClaw's install status", not tool internals — then run it and report. When the entered step defines a `Skip if` check, resolve that check **before** proposing the phase — from evidence already recorded (lane card, checklist, an earlier probe) or by running the read-only check command — and propose the step's commands only if the check fails; a passed check *is* the phase's result: report the skip and move to the next step.
5. **Warn before a change that may restart the gateway; verify reload first; one explicit restart per phase.** Restart warning: "I may go quiet for ~30s. If I don't come back, ask me to continue OcuClaw setup with the ocuclaw-assist skill and I'll resume where we left off." Let OpenClaw's reload planner apply plugin/config changes, then verify. If the gateway is live but the runtime is stale, request one `openclaw gateway restart --safe`; after it, stop and verify before doing anything else. If the gateway is down, route to `GW-DOWN`; if an explicit restart reports no usable service or supervisor boundary, route to `GW-RESTART-NOSVC`. Never repeat the same restart without a new finding. On wake: re-run the state assessment, re-enter at the routed step, and don't re-ask passed checkpoints. Config mutations are serialized: never issue two `config set` commands in one parallel batch — the host's transactional write fails the second with `ConfigMutationConflictError`; run them one at a time and, on that error, re-run the failed command once, alone. A safe restart you issue mid-turn is EXPECTED to come back accepted-but-deferred — your own running turn is in-flight work the drain waits for, so deferral is this procedure's normal outcome, not an edge case. When it reports deferred ("restart deferred: … active operation(s)"), say precisely that the config change is SAVED and verified and only its runtime application is queued until the gateway drains — a deferral is not a failure; do not re-issue the restart, end the turn, and verify after it lands. A deferred restart also lands SILENTLY — the gateway posts no follow-up message into this session when it applies — so say that too when reporting the deferral: it will finish quietly in the background, nothing will announce it, and the user's next message (any message) is what lets you check. Then open your next turn, whatever prompted it, by verifying whether the deferred restart landed and reporting that outcome before any other work. The same honesty applies when no restart was requested at all: a mutation whose own output says a restart or reload is needed to apply it (e.g. "Restart the gateway to apply.") is SAVED but not yet APPLIED — name that state in the message reporting the phase, and do not treat the changed behavior as live until the reload/restart verification passes.

**Hard guardrails (never cross)**

6. **You never handle secrets — the user does.** Never ask for, generate, echo, or read a token; check presence only via the probes in controller-routing.md (`config get` on a secret leaf prints a redaction sentinel, never the value, on all supported OpenClaw builds); never read the config file.
7. **Never expose the relay publicly.** Tailscale **Serve** only, never `funnel`; use supported capability commands or `openclaw config set` for non-secret configuration. Secret values belong only in the user's supported hidden prompt or private dialog, never command arguments.
8. **Stay in bounds — improvise only in the open lane.** The skill's commands come first, and for OcuClaw setup this skill wins over web tutorials. When a step fails, read-only diagnostics beyond the skill (status/list/inspect commands, log reads, port checks, loopback `curl`) are always fine — investigate freely. A mutating fix the skill doesn't name needs: the skill's own path already failed, you say what you'd run and why, the user OKs it, every hard guardrail still holds (secrets, Serve-only, no invented config keys, restart discipline) — then one attempt, verify, and if unresolved return to the named case or ESCALATE rather than freestyling further. For OS/vendor errors consult that vendor's official docs; elevation you don't have or sandbox-blocked steps → give to the user, then verify.
9. **Never end a turn on a promise you cannot keep.** Nothing wakes you after the turn ends: no timer, no background job, no silent re-check. So never say you will check again later, watch for something, come back to it, or notify the user — "I'll re-check it automatically once that window has passed" is the same broken promise as "I'll let you know", and a live run left the user waiting 2 minutes in silence for exactly that. When a step needs a wait (the cold certificate window, a reload settling, a hot-load landing), do the wait INSIDE the same turn: one bounded `sleep` in your own terminal, or re-read the controller up to three times about 30 seconds apart, and answer only after the last read. If you genuinely must end the turn, say plainly that you have stopped and name the exact words that restart you, e.g. "say 'check the route again' in a minute". One exception: on OpenClaw, the Step 9 pairing handoff and the Step 10 tool-driven first-use test end the turn on purpose, because the relay's "[ocuclaw setup wake]" notification is the supported wake there (fresh-install.md).

Never pass relay tokens or secret values in `ocuclaw_setup` or any other tool
argument. Secret entry stays in the user's own terminal or Control UI. Never repeat
a secret or token value from command output; report presence only through
the approved probes in `{baseDir}/references/controller-routing.md`.

**Placeholder grammar.** Commands in this skill contain only these substitutable placeholders: `<agent-id>`, `<port>`, `<node>.<tailnet>.ts.net`, `<container>`, and the quoted UPPERCASE secret placeholder (e.g. `YOUR-RELAY-TOKEN`) that the *user* replaces — the whole placeholder text goes, the quotes stay. Substitute *only* those. Never change a command's shell structure, flags, quoting, or pipes, and never add a wrapper (`read`, a loop, `&&`, `|`). If a command appears to need anything beyond a marked placeholder, stop and ask — don't invent a variant.

## Router

- Setup while `ocuclaw_setup` offers `next` → **Chat setup** at the top of this file; load a reference only where it sends you.
- Setup without `next` (opening move, lane card, checklist, where to start) → load `{baseDir}/references/guided-setup.md`.
- Journey, controller lane, typed mutations or secret probes → load `{baseDir}/references/controller-routing.md`.
- Fresh install step → load `{baseDir}/references/fresh-install.md`.
- Stable update (any existing user) → load `{baseDir}/references/update.md`.
- Beta channel or rollback (beta-Discord testers only) → load `{baseDir}/references/beta.md`.
- A named failure case appears → load `{baseDir}/references/troubleshooting.md` and jump to that case.
- A card's live part is not working (a turn's "Not working" block, or a card tool's answer, names a reason for an MCP use, a Jev question or a model use) → load `{baseDir}/references/card-fixes.md` and read only the case `CARD-<PART>-<REASON>`; never while you build or change a card.
- Stuck after honest attempts on any step → load `{baseDir}/references/troubleshooting.md` and run **ESCALATE** — it includes the in-app debug-upload path that attaches real diagnostics to the report.
- An extended wrap or feedback requested after core completion → load `{baseDir}/references/wrap-feedback.md`.
- Address or command reminders → load `{baseDir}/references/quick-reference.md`.

`{baseDir}` is this skill's base directory, announced when the skill loads.
On some hosts it ROTATES between reads (the extraction is re-created at a new
temp path mid-session). A failed reference read means exactly that: re-list
the parent temp directory the load banner named, take the newest extraction,
and retry the same relative path — never search the wider filesystem for the
skill, and never conclude a reference is missing from one failed read.

Keep this file's guardrails and router, and guided-setup.md's lane card and checklist, active throughout setup.
