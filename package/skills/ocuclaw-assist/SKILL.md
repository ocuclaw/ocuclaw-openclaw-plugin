---
name: ocuclaw-assist
description: Guide OcuClaw install, update, rollback, and troubleshooting — covering the OpenClaw plugin, the phone app, Tailscale private networking between phone and host, and optional Soniox voice-input, Even AI, and bug-report integrations. Use when the user wants OcuClaw set up, a version change, or hits setup/connection failures.
homepage: https://ocuclaw.com
metadata: {"openclaw": {"emoji": "👓"}}
---

# OcuClaw Setup Assistant

**Guide version:** 2026-09-25 (1.0.58)

Use this skill when a user asks to install, update, roll back, configure, or troubleshoot OcuClaw on this machine. Work phase by phase. Before each phase, say what you will do, why, and which commands matter. Ask for OK. Afterward, verify in plain words. Setup takes about 15 minutes; the user should keep their phone nearby.

**Resume first.** When continuing setup, retain the recorded explanation preference
and G2 availability instead of repeating calibration or hardware questions. Re-read
the owning installation using the capability routing below, explain the first
incomplete checkpoint, and enter its existing guide step. Host conversation owns
setup; the phone conversation supplies only the test message and wearer interaction.
Never run the setup controller from the phone test conversation.

**Direct pairing:** `journey.capabilities.pairing: available` names the user's
own interactive `openclaw ocuclaw pair` terminal, not a tool approval surface.
Hand off once and resume the same installation's journey afterwards. Follow
`references/fresh-install.md` Step 9 for QR/Manual, four-word comparison, refusal
and retry. Never execute/capture the ceremony or request its private contents in
chat. Preserve existing credentials and phones; approval is distinct from an
observed authenticated phone connection and from first-use/G2 proof.

**Opening move (new setup only).** If explanation preference is already established,
reuse it and proceed to the state assessment. Otherwise your FIRST reply does three
things, in this order, and NOTHING else — no checklist copy, no probe results,
no step content:

1. **Announce**, warmly: you'll walk them through setting up OcuClaw, and the
   OcuClaw Setup Assistant (name it, give the guide version) is loaded to
   guide it.
2. **Set expectations**, briefly (2–3 sentences): you'll do most of the work,
   but they'll run a few commands themselves — their passwords never pass
   through you; OpenClaw may show approval pop-ups to allow some steps, and
   the gateway may reload or restart a few times along the way; at any time
   they can ask for the current status, for help with a step, or — after any
   interruption — to continue OcuClaw setup where you left off.
3. **Ask one calibration question**: are they comfortable in a terminal, or
   would they like everything explained as you go?

For new setup without an established preference, carry all three — use this template
(fill the guide version with this file's full **Guide version** line — the
date AND the parenthesized number; adapt the CLI name if the user pinned
one, e.g. `openclaw-test`; keep it warm):

> I'll walk you through setting up OcuClaw. The **OcuClaw Setup Assistant**,
> guide version <version>, is loaded to guide it. I'll do most of the checks
> and setup myself; you'll run a few commands yourself so your passwords
> never pass through me. OpenClaw may show approval pop-ups, and the gateway
> may briefly reload or restart — if I go quiet, just say "continue OcuClaw
> setup." One question before we start: are you comfortable in a terminal,
> or would you like everything explained as we go?

New-setup output gate (preference not yet established): if your drafted first reply is missing the
announcement, the expectations, or the calibration question — or carries
anything beyond them (the setup checklist, probe output, step content) — it
is not sendable: replace it with this template alone. The checklist is
never shown this early — it appears once, at the wrap self-audit.

The calibration answer is the go signal: record it, then proceed directly
into the lane card and the first verified incomplete step — never idle on a bare
"ready when you are" waiting for another prompt.

Record the answer in the lane card's `User level` row and hold that register
for the rest of the conversation: **guided** → plain words, say what each
command does and what its output means, expand jargon on first use, smaller
steps with more reassurance; **terminal-comfortable** → keep explanations
tight and technical. Never re-ask; re-read the card. If the register is
clearly wrong mid-run (they ask what a terminal is, or they start correcting
your flags), adjust it once and note the change on the card.

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

Read `overview` through the currently callable controller. If its
`capabilities.readOperations` includes `journey`, call that read-only operation
(typed `ocuclaw_setup` on the callable lane; `openclaw ocuclaw journey` on the
policy-hidden CLI lane). Explain `durableFacts`, `currentHealth`, `firstUse`, and
`nextCheckpoint.action` separately. Re-read after restart or a new turn: receipts
are observations, not inputs that can authorize skipping a checkpoint. Never reuse
a receipt from another `installation.id`; null identity means ownership is unknown.

### No shell probes on the controller lane

On some hosts (OpenClaw 2026.7.1 with the Codex harness) every shell command
that is not a plain file read asks the user for an exec approval, and the
approval also shows on their glasses. None of these is a consent step the user
needs. So while `ocuclaw_setup` is callable, the lane card, the state
assessment, Step 10 (first use) and the wrap run **no shell probes**:

- Take every fact from typed calls. `journey` gives the OpenClaw version
  (`compatibility.hostOpenClaw`), the gateway's OS, container markers and
  systemd (`environment`), the relay, the phone, the private route and first
  use. `overview`, `doctor` and `verify` give the rest. Never run
  `openclaw ocuclaw …`, `openclaw --version`, `openclaw status`,
  `openclaw gateway status`, `tailscale …`, `command -v`, `uname` or
  `sudo -n` to re-check a fact. If the journey reports a route fact it cannot
  read (for example `serve_cli_absent`) while the phone is connected, report
  it as the journey words it and carry on; do not probe for the CLI.
- Read a file of this skill with ONE plain `sed -n '<from>,<to>p' <file>` (or
  your file-read tool) per command. Never join it to anything with `;`, `&&`,
  `|`, `printf`, `echo` or a loop: a joined read asks for approval, a plain
  one does not.
- Wait for the Step 10 test by ending your turn; the setup wake is the wait.
  In a later turn, the quick read is `first_use_wait`. Never run `sleep`.
- After an upstream model error (a failed turn of your own, a provider error,
  or `replyRunErrored` on the test reply), do not read or grep the gateway log.
  Retry the typed call once, or report the error in plain words and give its
  fix.

Commands a step hands to the user for their own terminal are not probes, and
the mutating phases of Steps 2–9 still run their own commands under rule 4.

### Managed hosts

The first command of any new or resumed setup is that journey read, before Step 1.
Its top-level `host` block says what kind of machine this is. When `host.managed`
is `cloudways`, read `references/cloudways.md` BEFORE Step 1 and follow it for the
whole setup. That host has no system Tailscale and cannot have one, so do not look
for a `tailscale` binary and do not ask the user whether Cloudways supports it.
`openclaw gateway restart` is a no-op there, so rule 5's restart path does not
apply: plugin installs and config changes hot-load, and you verify by re-reading
`journey` a few seconds later. `host.gatewayRestart` repeats that verdict
(`never-on-this-host` or `supported`), and `host.guide` names the reference to
read. When the user would rather run one command themselves than have you drive
it, `openclaw ocuclaw cloudways setup` does the whole Cloudways path in their own
terminal and ends at a paired phone. A missing `host` block, or `managed: null`,
means an ordinary host: carry on as written.

### Standalone copies of this assistant

The same journey read carries an `assistantSkill` block, and you act on it
before Step 1, exactly like the host block. It names the copy of this assistant
the host actually loaded (`activeSource`, `activeGuideVersion`), the copy the
plugin ships (`bundledGuideVersion`), and whether a separately installed copy is
shadowing the bundled one (`shadowed`).

This assistant ships only inside the plugin. `activeSource: openclaw-extra` is
the bundled copy and is the expected, healthy reading. Anything else is a
separately installed copy that OpenClaw prefers over the plugin's, silently and
with no warning, which pins the user to whatever guide that copy carries.

When `shadowed` is `true`, say so in plain words before Step 1, name both guide
versions, and hand the user the block's `nextAction` to run in their own
terminal; then re-read `journey` and continue. The removal depends on the host
version: `openclaw skills remove ocuclaw-assist` where that verb exists, and
where it does not (OpenClaw 2026.7.x has no `skills remove`) delete the folder
holding the SKILL.md that `openclaw skills info ocuclaw-assist --json` reports
as `filePath`. Check `openclaw skills --help` before naming one. It is a named
condition, never a halt and never a reason to stop or restart setup.
`shadowed: null` means the host's skill listing could not be read: carry on and
do not guess at a shadow.

`durableFacts.relayCredential` carries presence plus the routing verdict:
`disposition` (`preserve-existing`, `host-provisionable`, or
`operator-entry-required`), `dispositionReason` saying why, and the raw
`provisioning` capability. `disposition` is the only one you route on — it
already folds in every precondition. Read it instead of assuming: a credential
that is already present is preserved, never replaced, and an unreadable or
non-string one is an owner repair, never a reason to write a new one.
The block also says where the credential came from: `origin` is
`host-minted-at-load` (the plugin created it itself at its first load; plugin
releases after 2.0.6 do this, like the Hermes adapter) or `pre-existing`, and
`mintOnLoad` (`status`, `code`, value-free `detail`) says what the load-time
mint did when a credential is absent — that code is the owner action, never a
cue to type one. Nobody enters a Relay Credential; there is no manual lane.

Route `verify-plugin` to bootstrap/plugin recovery, `verify-host` to Step 1,
`configure-host` to the required configuration checks,
`verify-relay` to existing gateway recovery, and `verify-private-route` to the
private-route checks in fresh-install.md. An unknown checkpoint needs evidence;
it is not completed. When `capabilities.toolFirstUse` is `available` and the
typed tool is callable, follow fresh-install.md Step 10's tool-driven lane:
arm before the phone send, say the returned lines as your final message and end
your turn. The relay runs the test and wakes this chat with the result. When the
wake asks, ask the wearer once whether that reply appeared on their glasses.
Relay only their own explicit answer with the returned binding; never infer it
from machine health or a setup wake. The tool records
this as a host-conversation wearer report, not direct-terminal input.
For a new attempt awaiting welcome, the relay shows the fixed welcome card and
counts the double-tap itself. Resume the first incomplete milestone; preserve old
completions and keep current health separate from recorded acceptance.
On the policy-hidden lane do not weaken tool policy: use the advertised terminal
fallback. When only `capabilities.firstUse` is `direct-terminal`, follow
fresh-install.md Step 10: the user runs `openclaw ocuclaw first-use` in their own
terminal, sends a fresh phone message in the bound OpenClaw session, and explicitly
confirms that reply appeared on G2. Never execute the terminal confirmation, pass an agent
assertion as a wearer answer, or substitute socket health, host traffic or a render
call. `awaiting-reply`, `awaiting-confirmation` and `completed` are separate states.
Re-read `journey` after the handoff or any interruption; a new host conversation
resumes the same installation checkpoint. A test-input receipt is not wearer proof.
When `coreComplete` is true, use the controller's success message and stop core setup.
Report any current outage separately using `currentHealth` and `recoveryCheckpoint`;
preserve completed setup, credentials and other phones. Welcome and optional
integrations are deferred choices, never completion gates. If this capability is
unavailable, explain that the installed controller cannot record this checkpoint;
do not claim durable completion from an older controller.

On supported hosts, `journey` reads the owning runtime through OpenClaw's
authenticated gateway and observes the private Tailscale route read-only.
Discovery's unknown relay status in older operations remains unchanged. If the
live read is unsupported, unreachable or belongs to another installation, the
journey retains unknown evidence and routes to the existing checks.

Use the route-reader contract when `currentHealth.privateRoute.schemaVersion`
is `1` and its `proposal` block is present. Older journey results lack these
fields: use the existing step-level route and ownership checks for them;
their `healthy` status alone does not establish ownership.

The route-reader block is the whole `verify-private-route` verdict and
it keeps four truths apart: `relay` (health of the loopback relay),
`route.presence`/`route.target`/`route.exposure` (what is configured on
`:8444`), `reachability` (the bounded loopback and front-door probes), and
`ownership` (the bundle-scoped Managed Serve Route receipt). Route on
`privateRoute.status` only — `healthy` resumes without reconfiguration;
`missing` or `stale` carries the ONE action in
`proposal.applyCommand` only when `proposal.status` is `presented`;
`foreign`, `conflicting`, `exposed`, `unreachable`,
`offline` and `unknown` name what stands in the way in `evidence` and
withhold every command. An expected hostname or a configured port is never
readiness, and a matching shape is never ownership: `ownership.status`
`foreign-gateway`, `foreign-hermes` or `unreadable-claim` means the port is
somebody else's and you never propose over it. `teardown.command` appears
only while the receipt and the live route still agree; never derive a
removal from memory. The controller never runs the command and never renders
the node name: the phone address is `wss://<node name>:8444`, and the user
reads the node name from their own `tailscale status`.

An older controller without these capabilities stays on the existing overview,
doctor, plan, verify and step-level verification route. If the plugin is absent,
disabled, broken, or its controller fails, use the Router's bootstrap/recovery lane;
the standalone guide remains usable before installation. Preserve the exact CLI
wrapper/profile, explanation preference and answered hardware questions on that lane.

**Progressive-loading rule.** Load only the reference named by the Router for
the branch you are entering. Fresh-install entry loads
`{baseDir}/references/fresh-install.md` only. Return to the Router when the
branch changes.

For OcuClaw-specific setup, prefer this skill over web tutorials (rule 8). For
generic OpenClaw CLI behavior you are unsure about, check current OpenClaw
docs.

Soniox voice input, Even AI, and the easy-bug-reports opt-in are optional
steps inside fresh-install.md (Steps 11–12b), not a separate file.

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

**Optional phone setup:** on a matching installed bundle advertising the private
setup interface, lead with Home's Optional setup card (buttons **Set up voice**
and **Set up Even AI**) and its dedicated pages; after dismissal, re-entry is
**Settings > Voice** and **Settings > Defaults > Even AI**, and diagnostics live
at **Settings > Display > debug section > Diagnostics**. The card has no other buttons, and Settings has no
separate optional-setup row.
Native replacement, Save and apply,
activation and diagnostics confirmation controls own consent for their named
action. Do not add a shell-command approval to that phone flow. On supported
OpenClaw hot-reload hosts, Save and apply requests reload; refresh active readback
after reconnecting. Saved or reloaded is not tested. Route review remains
print-only until separately approved. The command checkpoints below apply to
advanced Desktop/CLI host actions; older bundles retain their supported fallback.
Candidate code does not establish public bundle availability.

1. **Finish core setup.** Work every required checkpoint; a truly blocked step → `[blocked: reason]`. Step 10's installation-scoped recorded completion is a successful finish: the phone-origin reply, its supported reply evidence and welcome dismissal are recorded. Keep SDK acceptance distinct from wearer confirmation. Voice, Even AI, diagnostics and Step 13's extended wrap may all be declined without invalidating core completion. An unavailable or undismissed welcome stays pending; preserve working text chat. On older bundles, report the manual message check and the absence of durable completion separately.
2. **Run commands exactly as written.** Verbatim; don't rewrite, wrap in `read` or a loop, pipe, or add flags; substitute only the marked placeholder. If a command seems unsafe, incompatible, or blocked on this host, stop and raise the concern — never rewrite it silently. *A clever "equivalent" has already broken installs.* When a written command fails, that's rule 8's open lane: diagnose read-only and propose — don't silently substitute.
3. **Never clear a configured secret.** Use the supported private-entry command or dialog. Blank/cancel preserves the existing value; invalid input or an unconfirmed save does not complete the capability. Keep working settings and retry only that private choice. Never move a token into a command argument to repair a failed save.
4. **Checkpoint each mutating phase, not each command — and never checkpoint a read-only check.** Before a phase that changes anything: say what you'll do, why, and which commands (1–2 plain sentences) — get an OK. After: verify the result in plain words. A phase is one numbered step (or one named troubleshooting case); an OK covers exactly the phase it was given for — never carry it into the next numbered step, and never ask one OK for a batch ("…then I'll continue through the next steps"). **Output gate — apply it to every pause message before sending:** a message that pauses for an OK must itself contain the fenced command(s) it is asking about, each with a one-line plain-words why; if your drafted pause message has no code block, it is malformed — discard it and send the step's CHECKPOINT content instead. **A pause message is your turn's one final message.** This holds for every message that ends your turn waiting on the person: an OK, a consent or any setup question. Everything the question covers (outcome, what changes, commands, lists, the question itself) goes in that same final reply, with the question last. Never put it in an interim, progress or commentary message before the final one, and never end with a second, shorter message that restates the question: OpenClaw 9.x's TUI shows only the turn's final message, so the person would be asked to approve something they never saw. A pause message also OPENS with a one-sentence outcome of the phase that just finished, so the user is never asked to approve a step they haven't been told about. Evidence for the command you are proposing (a probe result, a recorded read) enters only after a sentence names what it refers to — a message whose first words are a bare probe result is malformed: with no subject named, the user reads it against the step THEY just finished; discard it and re-draft in that order. Re-checkpoint at every mutating step boundary. A phase whose commands are all read-only (status, list, inspect, `serve status`, version and log reads, the probes) needs no OK: announce it in one plain outcome-language sentence — what you're checking and why in user terms, e.g. "I'm going to check OpenClaw's record of OcuClaw's install status", not tool internals — then run it and report. When the entered step defines a `Skip if` check, resolve that check **before** proposing the phase — from evidence already recorded (lane card, checklist, an earlier probe) or by running the read-only check command — and propose the step's commands only if the check fails; a passed check *is* the phase's result: report the skip and move to the next step.
5. **Warn before a change that may restart the gateway; verify reload first; one explicit restart per phase.** Restart warning: "I may go quiet for ~30s. If I don't come back, ask me to continue OcuClaw setup with the ocuclaw-assist skill and I'll resume where we left off." Let OpenClaw's reload planner apply plugin/config changes, then verify. If the gateway is live but the runtime is stale, request one `openclaw gateway restart --safe`; after it, stop and verify before doing anything else. If the gateway is down, route to `GW-DOWN`; if an explicit restart reports no usable service or supervisor boundary, route to `GW-RESTART-NOSVC`. Never repeat the same restart without a new finding. On wake: re-run the state assessment, re-enter at the routed step, and don't re-ask passed checkpoints. Config mutations are serialized: never issue two `config set` commands in one parallel batch — the host's transactional write fails the second with `ConfigMutationConflictError`; run them one at a time and, on that error, re-run the failed command once, alone. A safe restart you issue mid-turn is EXPECTED to come back accepted-but-deferred — your own running turn is in-flight work the drain waits for, so deferral is this procedure's normal outcome, not an edge case. When it reports deferred ("restart deferred: … active operation(s)"), say precisely that the config change is SAVED and verified and only its runtime application is queued until the gateway drains — a deferral is not a failure; do not re-issue the restart, end the turn, and verify after it lands. A deferred restart also lands SILENTLY — the gateway posts no follow-up message into this session when it applies — so say that too when reporting the deferral: it will finish quietly in the background, nothing will announce it, and the user's next message (any message) is what lets you check. Then open your next turn, whatever prompted it, by verifying whether the deferred restart landed and reporting that outcome before any other work. The same honesty applies when no restart was requested at all: a mutation whose own output says a restart or reload is needed to apply it (e.g. "Restart the gateway to apply.") is SAVED but not yet APPLIED — name that state in the message reporting the phase, and do not treat the changed behavior as live until the reload/restart verification passes.

**Optional activation scope:** Steps 11/12/12b use their capability commands and
observed activation results instead of the generic restart path in rule 5.
Supported hot/hybrid hosts may reload; unknown/off/restart policy remains pending
for explicit host action. Do not restart Cloudways for optional setup.

**Hard guardrails (never cross)**

6. **You never handle secrets — the user does.** Never ask for, generate, echo, or read a token; check presence only via the probes below (`config get` on a secret leaf prints a redaction sentinel, never the value, on all supported OpenClaw builds); never read the config file.
7. **Never expose the relay publicly.** Tailscale **Serve** only, never `funnel`; use supported capability commands or `openclaw config set` for non-secret configuration. Secret values belong only in the user's supported hidden prompt or private dialog, never command arguments.
8. **Stay in bounds — improvise only in the open lane.** The skill's commands come first, and for OcuClaw setup this skill wins over web tutorials. When a step fails, read-only diagnostics beyond the skill (status/list/inspect commands, log reads, port checks, loopback `curl`) are always fine — investigate freely. A mutating fix the skill doesn't name needs: the skill's own path already failed, you say what you'd run and why, the user OKs it, every hard guardrail still holds (secrets, Serve-only, no invented config keys, restart discipline) — then one attempt, verify, and if unresolved return to the named case or ESCALATE rather than freestyling further. For OS/vendor errors consult that vendor's official docs; elevation you don't have or sandbox-blocked steps → give to the user, then verify.
9. **Never end a turn on a promise you cannot keep.** Nothing wakes you after the turn ends: no timer, no background job, no silent re-check. So never say you will check again later, watch for something, come back to it, or notify the user — "I'll re-check it automatically once that window has passed" is the same broken promise as "I'll let you know", and a live run left the user waiting 2 minutes in silence for exactly that. When a step needs a wait (the cold certificate window, a reload settling, a hot-load landing), do the wait INSIDE the same turn: one bounded `sleep` in your own terminal, or re-read the controller up to three times about 30 seconds apart, and answer only after the last read. If you genuinely must end the turn, say plainly that you have stopped and name the exact words that restart you, e.g. "say 'check the route again' in a minute". One exception: on OpenClaw, the Step 9 pairing handoff and the Step 10 tool-driven first-use test end the turn on purpose, because the relay's "[ocuclaw setup wake]" notification is the supported wake there (fresh-install.md).

### Capability-first controller routing

Do this assessment before choosing a controller lane and again after a restart.
The actual current-session inventory is authoritative — check it first; it costs
no command. If this surface does not show that inventory to you, ask the user to
run `/tools verbose` in this same conversation and treat that result as the
actual current-session inventory. Skill visibility, the plugin manifest,
`plugins inspect`, and `openclaw config get tools` do **not** prove a tool is
callable in the current session — and the reverse also holds: when the inventory
contains `ocuclaw_setup`, call it instead of shelling out to re-derive what it
reports. Routing output gate — apply it to every shell command YOU choose to
run (the state assessment, skip-if resolution, ad-hoc fact-finding; a step's
own printed VERIFY block stays as written): while the inventory contains
`ocuclaw_setup`, a drafted `openclaw ocuclaw …`, `plugins list`, or
`plugins inspect` is MALFORMED — discard it and make the one typed call that
reports the fact. The two carve-outs are `plugins inspect ocuclaw --json` for
Step-2 provenance after `overview` reported `install.recorded: null`, and
gateway classification when the latest typed result reported the runtime
stopped or unknown. The deterministic CLI `openclaw ocuclaw overview` belongs
to the policy-hidden lane only — never to a lane where the typed tool is in
the inventory. Plugin builds carrying this guide expose `ocuclaw_setup` once
the plugin is enabled and loaded AND the root tool policy leaves plugin tools
exposed. A loaded plugin whose inventory omits it means the policy is hiding
it: a `deny`, a restrictive `tools.allow`, or — most often on a fresh host — a
`tools.profile` other than `full`, because OpenClaw's quickstart writes
`coding` and that profile hides plugin tools. Read `openclaw config get tools`
and follow fresh-install.md Step 4: the profile case is fixed by merging
`"ocuclaw"` into `tools.alsoAllow`, which is the quickstart default being
admitted, not a policy weakening.

State this skill's **Guide version** and the **observed plugin version** in your
first assessment. On a live controller lane the observed version comes from the
typed `overview` result (`plugin.version`); run
`openclaw plugins inspect ocuclaw --runtime` to observe it only when the
inventory omits `ocuclaw_setup`, a listed call failed, or you are classifying a
disabled, failed, or absent plugin. If inspection reports no installed plugin,
report `not installed`; if it reports disabled or an error, report that state
instead of inventing a version. Always complete this assessment before an
install, update, rollback, or other compatibility-sensitive action.

**Controller exclusivity.** On the controller-callable lane — and through
`openclaw ocuclaw` on the policy-hidden lane — the controller is the only
sanctioned source for the facts it reports: plugin version and load status,
managed-install provenance (the `plugin.install` block), runtime
running/starting/stopped state, configuration validity, host compatibility,
secret presence, relay bind scope and port, connected-phone state, and host
environment facts (`overview.environment`: OS, container markers, systemd
presence — read from inside the gateway process, which is the view that
matters for container/topology reasoning; the agent shell can sit in a
different namespace). A runtime status of `starting` (evidence
`relay-start-pending-bind`) means a relay handle exists but the bind never
completed — treat it as NOT running and go read the gateway log for the bind
failure. Do not
re-derive those facts with `plugins list`, `plugins inspect`, `gateway status`,
or bare `config get` probes while that lane is live. This extends to reference
steps: a step's read-only check command is already satisfied when a successful
controller result proves the same fact — record the controller evidence and
move on instead of re-running the command. Shell commands remain the
right tool only for what the controller does not report: managed-provenance
evidence via `openclaw plugins inspect ocuclaw --json` when `overview` reports
`plugin.install.recorded: null` (hosts that do not expose install records to
plugins) or has no `plugin.install` block at all (older controllers), Tailscale
and Serve state, the exact config value a mutation decision needs (e.g. the
literal `wsBind` string), gateway classification when `overview` reports the
runtime stopped or unknown, and every non-controller lane in the table below. An
expected-absence result from a fallback probe (`Config path not found`, a
nonzero exit) is a recorded outcome, not an error — present it as the
structured state it encodes, never as a failure.

Use this decision table exactly:

| Evidence | State | Lane |
|---|---|---|
| Actual current-session inventory contains `ocuclaw_setup`, and its call succeeds | controller-callable | Prefer typed `overview`, `doctor`, `plan`, and `verify` operations. Use the narrowest operation that answers the current question. The typed `set_relay_port` and `provision_relay_credential` mutations are available only under the bounded procedures below. |
| Current inventory omits `ocuclaw_setup`; runtime inspection says `Status: loaded`; `openclaw ocuclaw overview` works | controller-policy-hidden | Use the matching deterministic CLI: `openclaw ocuclaw overview`, `openclaw ocuclaw doctor`, `openclaw ocuclaw plan`, or `openclaw ocuclaw verify`. Diagnose policy only when the user wants the model-facing tool exposed. |
| Plugin is installed but required configuration is incomplete or invalid | plugin-unconfigured | Keep using this standalone skill. Route to the missing setup step; use the CLI doctor/plan when it is available, but never make it a prerequisite. |
| Runtime inspection or plugin listing says `Status: disabled` | plugin-disabled | Keep using this standalone skill and route to Step 4. Plugin-owned tools, CLI, and bundled skill are unavailable. |
| Runtime inspection or plugin diagnostics says `Status: error` or reports a load failure | plugin-failed | Keep using this standalone skill and route to the named troubleshooting case or `GW-DOWN`; do not depend on plugin-owned surfaces. |
| Plugin inspection reports OcuClaw not found | plugin-absent | Keep using this standalone skill and route to Step 2. Do not ask for a plugin tool or CLI. |
| Plugin is loaded but its version has no `ocuclaw_setup`/`openclaw ocuclaw` surface | controller-unavailable-version | Use the standalone guide's normal CLI bootstrap/recovery lane; offer a supported update, but do not claim policy hid a tool that this version never registered. Never invoke `ocuclaw_setup` or any `openclaw ocuclaw` command on this lane — this version never registered them. |

If a listed `ocuclaw_setup` call fails, re-run runtime inspection and classify
the state again; do not silently fall through to arbitrary shell diagnosis.
When callable, typed controller operations replace shell-style diagnosis for
every fact they report. When policy-hidden, the matching deterministic CLI
operation does the same.

`/tools verbose` is the final session-scoped outcome. If a loaded tool is
hidden, the filtering chain can include the global profile/policy, provider
or model policy, agent and agent-provider policy, sender/channel/group
policy, sandbox policy, subagent/inherited policy, and the plugin's
optional-tool gate. Use `openclaw sandbox explain` for sandbox evidence and
`openclaw logs` for `agents/tool-policy` entries naming the rule — a root
`openclaw config get tools` result is one clue, never the effective-policy
verdict. Do not change a policy until evidence identifies the applicable
scope; deny wins.

Never pass relay tokens or secret values in `ocuclaw_setup` or any other tool
argument. Secret entry stays in the user's own terminal or Control UI. Never repeat
a secret or token value from command output; report presence only through
the approved probes below.

#### Typed host mutations

When `ocuclaw_setup` is callable it exposes two bounded mutating operations:
`set_relay_port` and `provision_relay_credential`. Both are host-approved, both
report a redacted receipt, and neither is available through `openclaw ocuclaw`.
Everything else the controller offers is read-only.

#### Typed relay-port change

Use `set_relay_port` only when the state assessment proves that a relay-port
change is actually needed or the user explicitly requests one. Never migrate a
working setup merely to match the preferred fresh-install default.

1. Run typed `overview` immediately before proposing the change and take the
   current `relay.port` as `expectedCurrentPort`.
2. State the current port, proposed port, and that the gateway must restart and
   connected clients will briefly disconnect. Obtain the phase checkpoint required
   by rule 4.
3. Invoke `ocuclaw_setup` with only `operation: set_relay_port`,
   `expectedCurrentPort`, and `newPort`. Both ports must be integer values from 1
   through 65535 and must differ.
4. The host may present its own second allow-once/deny approval immediately
   before execution — that is OpenClaw's prerogative, and it has not been
   observed on every host. Never imply that the earlier conversational
   checkpoint replaces a host approval, never claim a host approval happened
   unless it visibly did, and never ask for durable trust.
5. Treat denial, timeout, cancellation, missing approval routing, stale state,
   mutation conflict, or verification failure as a stopped change. Do not retry with
   a guessed current port. Re-run `overview`, explain the result, and make a new plan.
6. Accept success only from a `status: verified` receipt for `set_relay_port` whose
   `change.newPort` matches the plan. The receipt's `followUp.requiresRestart` records
   host-owned restart intent; do not issue a second restart while OpenClaw is already
   applying it. If the host remains up and explicitly reports that a restart is still
   required, give the standard restart warning, perform one restart, and then re-run
   `verify` after the gateway returns.

This mutation is deliberately unavailable through `openclaw ocuclaw`; when the
setup tool is policy-hidden, use the existing user-approved non-secret command in
the fresh-install or troubleshooting lane. All secrets remain outside model-visible
input and are never tool arguments; the Relay Credential in particular is
host-created and is never entered by anyone.

#### Typed Relay Credential provisioning

`provision_relay_credential` lets the HOST create the Relay Credential for a
genuinely fresh installation, so nobody has to invent, copy or retype a password.
It takes no arguments: a credential can never be supplied by you or by the user
through a tool call, and no operation ever reads one back. On plugin releases
after 2.0.6 the plugin already mints its credential at its first load, so on a
loaded plugin this operation normally reads `preserved`; it remains the route
for older bundles and for a host whose load-time mint could not run.

`journey`'s `durableFacts.relayCredential.disposition` is the whole routing
rule, and it is already complete — one fact, no preconditions of your own to
re-derive: `host-provisionable` means this operation applies,
`preserve-existing` means a usable credential is already configured and nothing
is to be done, and `operator-entry-required` means this lane is unavailable
here — report the named blocker; there is no manual entry step. `dispositionReason` says why:
`pairing-unavailable` means this host CAN create a credential but nothing can
deliver it to the phone yet, because a provisioned credential is deliberately
never disclosed — not to you, not through `openclaw config get`, which redacts
it — so the phone can only receive it through the pairing exchange. Never route
on the raw `capabilities.credentialProvisioning` instead; it is a capability,
not a verdict.

1. Confirm from the current receipt that `secrets.relayToken.presence` is
   `absent`. Never propose provisioning against a `present` credential.
2. State plainly that the host will create the credential itself, that it is
   never shown to you and never printed, that any existing credential would be
   preserved, and that the gateway must restart before the relay uses it. Obtain
   the phase checkpoint required by rule 4.
3. Give rule 5's restart warning BEFORE you invoke anything — "I may go quiet
   for ~30s. If I don't come back, ask me to continue OcuClaw setup with the
   ocuclaw-assist skill and I'll resume where we left off." This write declares
   a restart intent, so the warning belongs ahead of the mutation, not after it.
4. Invoke `ocuclaw_setup` with only `operation: provision_relay_credential`.
5. The host presents its own allow-once/deny approval. Same rules as the
   relay-port change: never imply the conversational checkpoint replaces it,
   never claim it happened unless it visibly did, never ask for durable trust.
6. Accept success only from a receipt whose `status` is `provisioned` (the host
   created one) or `preserved` (one already existed and was kept). `preserved`
   is a success, not a failure, and it is the expected result of a repeat call,
   an interrupted retry, a repair or an upgrade. `credential.rotated` is always
   `false`: this operation never replaces a credential, so an already paired
   phone never loses its connection.
7. Apply the receipt's restart intent. When `followUp.requiresRestart` is
   `true`, the gateway must restart before the relay uses the credential: say so
   plainly and never call the relay usable before it happens. The host may do it
   itself right after this turn — that is normal and needs no second restart. On
   `gateway.reload.mode: off`, or if it visibly did not restart, the user runs
   one `openclaw gateway restart` at Step 5; re-run `verify` after the gateway
   returns. A `preserved` receipt can carry `requiresRestart: true` too — that
   means a credential was configured after this gateway booted, so the running
   runtime still has none.
8. Treat every other outcome as a stopped change and route by its code, never by
   retrying blindly: `read_only_host` — the configuration is externally managed,
   report the named deployment-owner action and stop; `ambiguous_existing_credential`
   or `config_unreadable` — existing state cannot be assessed, pass on the exact
   branch or file the message names, ask the owner to repair it, and never offer
   to replace it; `stale_precondition` or `config_conflict` — something changed
   mid-write, re-read `journey` first; `verification_failed` — nothing usable was
   recorded, so do not tell the user a credential is configured; `mutation_failed` —
   OpenClaw did not CONFIRM the write, so credential state is unknown in both
   directions: re-read setup state, report the host error the message carries,
   and claim neither that a credential exists nor that none was created;
   `unsupported_host` — this host lacks the mutation contract, fall back to the
   manual entry step.
9. Report presence only. Never echo, quote, guess at, or ask the user to read out
   the credential, and never claim to know its value — you cannot.

This mutation is likewise unavailable through `openclaw ocuclaw`. All-device
credential reset stays a separate explicit recovery action with its own
consequences; this operation never performs one.

### Secret presence probes

These probes are the fallback lane: when a controller lane is live, read presence from the `overview` result's `secrets` block instead of running them. A probe is one bare `config get` on the key — same command on every OS. OpenClaw redacts secret leaves in `config get` output on all supported builds, so the value never appears; you read only presence.

```
openclaw config get plugins.entries.ocuclaw.config.relayToken
openclaw config get plugins.entries.ocuclaw.config.sonioxApiKey
openclaw config get plugins.entries.ocuclaw.config.evenAiToken
openclaw config get plugins.entries.ocuclaw.config.evenAiEnabled
```

Read the output as the probe result:
- Secret leaves (relayToken, sonioxApiKey, evenAiToken): `Config path not found` + nonzero exit → probe = 0 (unset — expected, not a blocker). Any non-empty output — normally the redaction sentinel `__OPENCLAW_REDACTED__` — → probe = 1 (set). Never echo or repeat that output, whatever it looks like.
- `evenAiEnabled`: `true` → 1 · `false` → 0 · `Config path not found` → 0.

**Placeholder grammar.** Commands in this skill contain only these substitutable placeholders: `<agent-id>`, `<port>`, `<node>.<tailnet>.ts.net`, `<container>`, and the quoted UPPERCASE secret placeholder (e.g. `YOUR-RELAY-TOKEN`) that the *user* replaces — the whole placeholder text goes, the quotes stay. Substitute *only* those. Never change a command's shell structure, flags, quoting, or pipes, and never add a wrapper (`read`, a loop, `&&`, `|`). If a command appears to need anything beyond a marked placeholder, stop and ask — don't invent a variant.

## Setup checklist — track it silently, show it once at the wrap

This checklist is your working list for the whole job: track every box,
required and optional, exactly as written — do not reword, drop, merge, or
reorder boxes. Track it INTERNALLY as you work; do not display it during
setup (not in the opening move, not at the go signal, not at step
boundaries). Its one user-visible appearance is the wrap self-audit
(wrap-feedback.md): render it there **verbatim** — these exact boxes, same
wording — with the final tick states. Tick each box as you finish it. Do not tell
the user setup is complete while any REQUIRED box is unchecked. A genuinely
blocked box → mark `[blocked: reason]` and surface it, never drop it.

The optional boxes are choices after core completion. Everything inside the
checklist block below is user-visible when rendered at the wrap, so it
carries no agent instructions; these two paragraphs are not part of the
rendered block.

This is the FRESH-INSTALL checklist. If the state assessment routed you to U1 (update) or B1 (beta), follow that section's own short checklist instead — don't run these boxes.

**Required**
- [ ] Opening move — assistant announced (name + guide version), user-level question asked → lane card
- [ ] Lane established — OS, container?, shell access, elevation
- [ ] OpenClaw ≥ 2026.7.1-2 + G2 glasses paired      (Step 1)
- [ ] Plugin installed                                 (Step 2)
- [ ] Relay Credential in place — probe = 1            (Step 3)
- [ ] Plugin enabled; tool policy admits ocuclaw (profile/alsoAllow read) (Step 4)
- [ ] Relay port safe, reload/restart verified, plugin loaded; ocuclaw_setup journey answered (or `openclaw ocuclaw journey` cited on the compat lane) (Step 5)
- [ ] Tailscale up on this machine                     (Step 6)
- [ ] Owned private phone route reaches 127.0.0.1:<port> (Step 7)
- [ ] Phone on the tailnet                             (Step 8)
- [ ] OcuClaw app connected                            (Step 9)
- [ ] Fresh phone reply evidenced (wearer confirmed on G2, or the phone SDK receipt) and welcome dismissed; controller coreComplete is true (Step 10). Older manual lane: record the observed check and unavailable durable receipt separately.

**Optional (offered during setup — each is your choice)**
- [ ] Live UI demonstration                             (Step 10b)
- [ ] Extended wrap and feedback                        (Step 13)
- [ ] Voice input via Soniox                           (Step 11)
- [ ] Even AI integration                              (Step 12)
- [ ] Easy bug reports (debug upload) opt-in           (Step 12b)

At the wrap, render this checklist in its final state as the self-audit — its first and only appearance.

## First — establish your lane

This is mandatory before any install action (the checklist's first box). Fill the **lane card** below — a short recorded block you keep and read at every later step instead of re-probing or re-arguing platform:

```
LANE CARD
  OS:            Linux | macOS | Windows              (uname -s / sw_vers / $PSVersionTable)
  Container:     no | yes → network mode host|bridge|named|unknown
                 (ls /.dockerenv /run/.containerenv ;
                 docker inspect -f '{{.HostConfig.NetworkMode}}' <container>)
                 Docker markers absent but no systemd either ([ -d /run/systemd/system ] fails)
                 → microVM/other container: record "yes (no-systemd), mode unknown";
                 do not infer bridge or restart ownership
  Relay ingress: same namespace | crosses bridge (RETIRED — must be moved) | unknown
                 (where the Tailscale Serve / ingress proxy process runs;
                 Tailscale must run where the gateway runs, so a crossing
                 lane is a blocker to fix, never a lane to set up in)
  Shell access:  local | SSH | VPS console
  Elevation:     agent can sudo | user runs elevated  (sudo -n true / Admin PowerShell)
  User level:    terminal-comfortable | guided       (asked at the opening move)
  CLI entrypoint: openclaw | <the exact wrapper/profile form the user names>
  Relay wsPort:  <filled at Step 5>
  Tailscale CLI: <filled at Step 6 — matters on the macOS App Store build>
```

Fill the environment rows now; `User level` comes from the opening-move answer, never from a probe. When `ocuclaw_setup` is callable, run no probe here: fill the card from the typed journey as the "Controller lane" paragraph below says. With no controller lane, on Linux/macOS, collect every environment row with this ONE probe, exactly as written — it always exits 0, so expected absences (no container marker, no passwordless sudo) don't render as scary command failures in the user's chat, and it replaces four separate probes:

```bash
{ uname -s; [ -e /.dockerenv ] && echo container=docker; [ -e /run/.containerenv ] && echo container=podman; [ -d /run/systemd/system ] && echo systemd=yes || echo systemd=no; sudo -n true 2>/dev/null && echo elevation=agent-can-sudo || echo elevation=user-runs-elevated; }
```

Read its labeled lines straight into the card (no `container=` line → Container: no). On Windows use the per-row hints above. Never probe elevation with a bare `sudo -n true` — its nonzero exit paints an error banner in the chat for what is a normal, expected answer.

**Controller lane: fill the card from typed results, with no probe.** When `ocuclaw_setup` is callable, do not run the probe above or any half of it (see "No shell probes on the controller lane"). The journey's `environment` block (the same block `overview` reports) is authoritative for the OS/Container/systemd rows: it reads the GATEWAY process's own filesystem view. Elevation reads `user runs elevated (controller lane, not probed)`: the plugin is installed, and every elevated command left in this guide (Tailscale install, `up`, `serve`) goes to the user's own terminal. `Relay wsPort` comes from the typed relay port, and `Tailscale CLI` from the journey's route read (`serve_cli_absent` → not on the gateway's PATH).

The Elevation row otherwise has no default: with no controller lane it fills ONLY from the probe result recorded in THIS session. Lane-card output gate (rule 4's output-gate shape): the go-signal turn — the message that proceeds to Step 1 after the calibration answer — fills the card BEFORE its text goes out, from the probe or, on the controller lane, from the typed journey; a go-signal message that asks Step 1's question while an environment row is empty is malformed — fill it, then send it. Never tick "Lane established" while any environment row lacks recorded evidence from this session; a tick without it is a false report. `CLI entrypoint` defaults to `openclaw`; the moment the user names a different wrapper or profile for this install (e.g. `openclaw-test`, `openclaw --profile staging`), write that exact form in the row and use it for **every** subsequent `openclaw` command — drifting back to the bare default forces the user to re-correct you. `wsPort` and `Tailscale CLI` are appended when Steps 5 and 6 resolve them. Later steps read the card — they don't re-probe or re-ask.

## Where to start

Run this now — and again after any restart or resume. It tells you which step (or section) to enter first.

### Check table

Run each check; record the result (1 = pass, 0 = fail). Evaluate G first — it
costs no command. On a live controller lane, one `overview` call (typed, or
`openclaw ocuclaw overview` when policy-hidden; the typed `journey` carries
the same `compatibility.hostOpenClaw` for A) is the sole source for A, C,
B's provenance half (when `plugin.install.recorded` is not null), and
D's plugin/runtime half; run the listed commands only for E, F, B's provenance
when `plugin.install.recorded` is null or the block is missing, and D's
gateway classification when `overview` reports the runtime stopped or unknown.
With no controller lane live, run the listed commands as written.

| # | Check | Command |
|---|---|---|
| A | OpenClaw version ≥ 2026.7.1-2 (any 2026.7.1 build passes) | `openclaw --version` |
| B | Plugin installed with managed provenance + enabled | Controller lane: `overview` reports `plugin.install.recorded: true` (same proof). Otherwise `openclaw plugins inspect ocuclaw --json` has non-null managed install metadata · `openclaw plugins list` shows enabled |
| C | relayToken set | relayToken probe (see probes above) |
| D | Gateway up, plugin loaded | `openclaw gateway status` · `openclaw plugins inspect ocuclaw` shows `Status: loaded` |
| E | Tailscale installed + signed in | `tailscale status` |
| F | Private phone route reaches the relay's `wsPort`; ownership verified | `tailscale serve status` (compare the phone backend `127.0.0.1:<port>` to `openclaw config get plugins.entries.ocuclaw.config.wsPort`; preserve foreign or ambiguous routes). Even AI is not checked unless requested. |
| G | Required OcuClaw tool callable in this conversation | Actual current-session inventory, or `/tools verbose` in this same conversation. For controller routing, pass only when it contains `ocuclaw_setup`; classify a loaded-but-omitted tool as `controller-policy-hidden`. |

### Routing — enter at the FIRST matching row

**A working existing setup wins over the preferred default.** If the app connects and a quick Step 10 end-to-end test passes, do not migrate `wsPort` (even `9000`), Serve routes, or an old address shape just because they differ from the modern defaults — prove the setup is broken before changing ports or routes. Migrate old layouts only when setup is broken, this is a fresh install, a route points at the wrong backend, or the user explicitly asks.

| Finding | Enter |
|---|---|
| A: version below 2026.7.1, or G2 hardware unconfirmed | Step 1 |
| B: plugin not installed | Step 2 |
| C: relayToken probe = 0 | Step 3 |
| B: installed but not enabled | Step 4 |
| G: required tool is absent from the current inventory and the user wants it exposed | Capability-first table; loaded plugin → Step 4 policy diagnosis, otherwise use the matching standalone recovery lane |
| D: gateway down or plugin not `loaded` | Step 5 |
| E: Tailscale missing or not signed in | Step 6 |
| F: routes missing, old single-port scheme (`tcp://…:8443`), or present but proxying to a different local port than `wsPort` — unless the working-baseline rule above says leave it | Step 7 |
| Host green; app not yet connected (ask the user) | Step 9 |
| Everything green and the app connects — update only | Stable update → load `{baseDir}/references/update.md` (everyone). Beta channel or rollback → load `{baseDir}/references/beta.md`, only if they confirm they're a beta-Discord tester |
| Everything green and the app connects — single fix | Go directly to the one routed step; no full checklist |

## Router

- Fresh install step → load `{baseDir}/references/fresh-install.md`.
- Stable update (any existing user) → load `{baseDir}/references/update.md`.
- Beta channel or rollback (beta-Discord testers only) → load `{baseDir}/references/beta.md`.
- A named failure case appears → load `{baseDir}/references/troubleshooting.md` and jump to that case.
- Stuck after honest attempts on any step → load `{baseDir}/references/troubleshooting.md` and run **ESCALATE** — it includes the in-app debug-upload path that attaches real diagnostics to the report.
- An extended wrap or feedback requested after core completion → load `{baseDir}/references/wrap-feedback.md`.
- Address or command reminders → load `{baseDir}/references/quick-reference.md`.

`{baseDir}` is this skill's base directory, announced when the skill loads.
On some hosts it ROTATES between reads (the extraction is re-created at a new
temp path mid-session). A failed reference read means exactly that: re-list
the parent temp directory the load banner named, take the newest extraction,
and retry the same relative path — never search the wider filesystem for the
skill, and never conclude a reference is missing from one failed read.

Keep this file's guardrails, lane card, checklist, and router active throughout setup.
