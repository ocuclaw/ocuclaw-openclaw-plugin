# OcuClaw fresh install — Steps 1–13

**Guide version:** 2026-09-25 (1.0.58)

Return to the skill's SKILL.md for the guardrails, lane card, checklist, and
router at any time.

**CORE FINISH CONTRACT.** Step 10 completes core setup only after the controller
records the fresh phone-origin reply, its supported reply evidence, and the
welcome dismissal. SDK acceptance and explicit wearer confirmation are distinct
reply evidence; neither substitutes for recorded welcome completion. Use the
controller's success message. The user can stop
successfully there. Step 10b's demonstration, Steps 11/12/12b integrations and
Step 13's extended wrap are optional follow-ups; none gates core completion.

## Setup steps

### Step 1 · Prerequisites

GOAL: confirm the hardware is ready and the host meets the minimum version requirement.

CHECK — reuse an already established answer. Ask only when G2/app availability
has not been established: copy this question; do not paraphrase it into the fallback
confirmation below): "Are your glasses currently paired to your Even Realities
app, and is OcuClaw installed from the Even Hub store on your phone?"
Glasses not paired → stop: finish Even Realities onboarding first. OcuClaw
client not installed yet is fine — Step 9 walks through installing it; in that
case (and only then) confirm the Even Realities app and Even Hub open on the
phone. "Does Even Hub open?" is the not-installed fallback, never the Step-1
question itself.

Set expectations: keep the phone and a private terminal nearby. Supported terminal pairing delivers the existing or host-provisioned credential privately; older bundles may require user-owned manual credential entry.

For the new public candidate, recommend OpenClaw **2026.9.x** (2026.9.4
parity-tested; 2026.9.6 install and update lab-tested) and Node
**24.16+ within 24.x or 26.1+**. Read `node --version` as well as the host
version before an authorized host transition. Published bundle metadata permits
OpenClaw >=2026.7.1-2, and the guided journey (terminal pairing, first use,
welcome) is available on any host in that window that exposes the runtime APIs
`journey` checks; OpenClaw 2026.7.1 (managed hosts such as Cloudways, shown as
`v2026.7.1-2`) is verified. Read `capabilities.pairing` from `journey`, never the
version number, to decide. Preserve a working older installation. Do not upgrade
the host merely to recover an unrelated connection fault. Every host version
needs the `allowConversationAccess` config key set after install (Step 4):
2026.9.x install consent does not grant it (see recovery-routing.md). Read
recovery-routing.md for public package availability before choosing Step 2's
channel.

Controller-lane shortcut (SKILL.md controller exclusivity): if the state
assessment already returned a successful `journey` or `overview` whose
`compatibility` reports `hostOpenClaw` with `status: compatible`, that
satisfies this version check — record the controller evidence and skip the
command below. Run it only when no controller lane is live or the controller
call failed.

```bash
openclaw --version
```

VERIFY: version is ≥ 2026.7.1-2 (OpenClaw treats every 2026.7.1 build as the floor).   ·   If not → `HOST-OLD`.   ·   `openclaw: command not found` → OpenClaw itself isn't installed — installing OpenClaw is outside this skill: point the user at OpenClaw's official install docs, then re-enter here once `openclaw --version` works.   ·   `Unsafe fallback OpenClaw temp dir` → load troubleshooting and follow its exact-error host note; do not continue OcuClaw setup until this command succeeds.

---

### Step 2 · Install the plugin

GOAL: get the OcuClaw plugin onto this OpenClaw host.

**Step 2 owns all first-time installs, both channels. B1 is for updating or rolling back an already-installed plugin — not for first installs.**

Skip only when managed install provenance is proven → go to Step 3. Resolving
this proof is read-only (rule 4): announce it in one outcome-language sentence
("I'm going to check OpenClaw's record of OcuClaw's install status") and run
it — do not ask for an OK first. Proof, in
order: (1) a live controller lane whose `overview` reports
`plugin.install.recorded: true` (its `install.source` names the recorded
lane); (2) otherwise `openclaw plugins inspect ocuclaw --json` succeeds and
its top-level `install` object contains managed install metadata. A discovered
directory, `plugins list` visibility, or `install: null` is an incomplete
install — do not skip. `plugin.install.recorded: null` means this host does
not expose install records to plugins — it says nothing either way; use proof
(2). If the recorded source is not the ClawHub/npm lane you expected (e.g.
`archive` or `path`), it is still a managed install and the skip is proven:
report what is recorded, preserve it, and go to Step 3 — no keep/replace
menu, no beta question. Replacement happens only on the user's own
initiative, and never reinstall over recorded managed provenance without an
explicit go-ahead. If neither proof is obtainable (e.g.
inspection is unavailable on this host) while a plugin is discovered or
loaded, do not reinstall over it on your own initiative — report what you can
see and let the user decide.

Ask first (routing) — on the installing path only, never when the skip proof above passed: "Are you installing the **beta** build from the OcuClaw Discord?" Route to beta only if they confirm they're a beta-testing Discord member; otherwise install stable.

Before running an installation command, follow recovery-routing.md's
**Installation consent and recorded source** section. On OpenClaw 2026.9.x the
install needs the person's consent to OcuClaw's tools and skills. Ask it once,
inside this step's install checkpoint, using that section's consent message:
what installs and from where, the 8 tools, the 2 skills, that OpenClaw asks
its own capability approval, the exact command, then "OK to install OcuClaw
from <source> with that access?". All of it is ONE final message that ends
with the question: never put the disclosure in an interim or commentary
message, and never follow it with a shorter restatement of the question
(OpenClaw 9.x's TUI shows only the final message). Only after a clear yes,
probe `--help` and add `--accept-capabilities` when the host lists it. Never
answer for the person. If they decline, hand them the plain command with no
probe and no `--accept-capabilities` (`openclaw plugins install
clawhub:ocuclaw`, or the beta line without `"${f[@]}"`) to run in their own
terminal, and tell them OpenClaw asks its own `y/N` there, which they answer.
Hosts without the flag (2026.7.x) run the plain command.

**Stable (default source selection):**
```bash
f=(); openclaw plugins install --help 2>&1 | grep -q -- '--accept-capabilities' && f+=(--accept-capabilities)
openclaw plugins install clawhub:ocuclaw "${f[@]}"
```

Never add `--force` to the install from ClawHub.

The install prints a notice like `ClawHub package "ocuclaw" is community; review
source and verification before enabling.` — that is a standard advisory for
community-channel packages (the release is security-scanned and source-linked),
**not an error** by itself. A source or capability consent refusal (`requires
capability consent. The plugin was not installed`) is a failed installation; do
not continue until the consent procedure succeeds.

**Beta (only if the user confirmed they are a beta-Discord tester):**
```bash
f=(); openclaw plugins install --help 2>&1 | grep -q -- '--accept-capabilities' && f+=(--accept-capabilities)
openclaw plugins install npm:ocuclaw@beta --force "${f[@]}"
```

npm is outside ClawHub review, so OpenClaw 9.x refuses it without `--force`;
the same consent question covers both flags. `--force` also exists on 2026.7.x
and is harmless on a first install.

(To install a pinned beta build instead: `openclaw plugins install npm:ocuclaw@<spec> --force "${f[@]}"`.)

The prefix pins the install source; the tag picks the channel. Bare
`clawhub:ocuclaw` resolves to ClawHub's `latest` tag, which is the stable lane —
`latest` is what makes it stable, not the `clawhub:` prefix, because ClawHub has
carried a `beta` tag as well since 2.0.4. `npm:` is the lane the beta command
above uses, and it is also the stable fallback. If the OpenClaw build rejects the `clawhub:` prefix as an
unknown package (older hosts), install stable from npm instead:
`openclaw plugins install npm:ocuclaw`.

VERIFY: the install command exits successfully, then run:
```bash
openclaw plugins inspect ocuclaw --json
```
Pass only when the top-level `install` object is non-null and records the
ClawHub/npm source selected above. `plugins list` visibility or extracted files
without managed install metadata do not pass.

If an earlier failed attempt left discovered files with `install: null`, follow
the consent and failed-retry procedure in recovery-routing.md for the selected
target, then inspect again. Do not treat `--force` alone as consent. If managed
provenance is still absent → `ESCALATE`.   ·   If the install fails because the
host is too old → `HOST-OLD`; for any other failure → `ESCALATE`.

---

### Step 3 · Relay Credential   [OBSERVE ONLY — never set one]

GOAL: confirm the installation has a Relay Credential. The credential is
host-managed. The OcuClaw plugin creates one itself the first time it loads
without one (plugin releases after 2.0.6, the same way the Hermes adapter
already does), the encrypted pairing exchange in Step 9 delivers it to the
phone, and nobody — not you, not the user — ever invents, types, copies or
reads the value. Installation is safe without one: until that first load the
plugin is unconfigured and does not open a relay listener; it exposes setup
diagnostics only.

Skip if: relayToken probe = 1 → the credential is present; preserve it and go
to Step 4. Never replace a working credential to tidy setup: replacing it
disconnects every phone already paired to this machine.

**Read, do not write.** Read the live controller (typed `journey`, or
`openclaw ocuclaw journey` on the policy-hidden lane) and record
`durableFacts.relayCredential`:

- `presence: present` → done. `origin` is `host-minted-at-load` (this plugin
  created it when it loaded) or `pre-existing` (it was already configured);
  both are fine. Record it and go to Step 4.
- `presence: absent` and the plugin has not been enabled and loaded yet (a
  fresh install arriving from Step 2) → expected. Go to Step 4; the first
  load creates the credential, and Step 4's checkpoint message reports it as
  present. Do not run any credential command first.
- `presence: absent` after the plugin has loaded → `mintOnLoad` names why the
  load could not create one; report the named owner action, never work
  around it by writing a value:
  - `code: read_only_host` → the OpenClaw configuration is externally managed
    and not writable by the gateway; the deployment owner makes it writable
    (or provisions the field in the managed source). Nothing was written.
  - `code: ambiguous_existing_credential` → `plugins.entries.ocuclaw.config`
    holds a malformed branch; `detail` names the node by type only. The owner
    repairs it through an operator-owned OpenClaw surface; an existing
    credential in that branch must survive the repair.
  - `code: no-minter` or `unsupported_host`, or no `mintOnLoad` block at all
    → an older bundle or host without the load-time mint. Route on
    `disposition`: `host-provisionable` → SKILL.md's **Typed Relay Credential
    provisioning** (call `ocuclaw_setup` with only
    `operation: provision_relay_credential`; accept `provisioned` or
    `preserved`). `operator-entry-required` → this host cannot mint or
    provision and pairing cannot deliver; report it as a blocker with the
    named reason. There is no manual-entry lane: never ask the user to choose
    or type a credential.

**Older bundle without terminal pairing: credential present but the user cannot
enter it on the phone** (they have forgotten it, or never knew it) → **this is
an all-device reset, not a fresh install step.** Nobody can read the existing
credential back: `openclaw config get` redacts it, and a host-created one was
never disclosed to anyone. The supported way forward is the update lane: install
a bundle with terminal pairing (`openclaw ocuclaw pair` delivers the credential
privately, no retyping). Replacing the credential disconnects EVERY phone
already paired to this machine — each one has to be set up again. Never do
that silently, never as tidying, never to "retry" a step, and only through the
explicit reset procedure with the user's stated OK.

**Keeping the relay off on purpose:** an emptied or removed credential is not a
switch — the next plugin load creates a fresh one. The way to keep the relay
down is `openclaw plugins disable ocuclaw`.

VERIFY: relayToken probe = 1, or the plugin is not yet loaded and Step 4 will
load it.   ·   Absent after a load → the `mintOnLoad` owner action above, then
re-read `journey`; still failing → `TERM-HELP`.

---

### Step 4 · Enable + agent tool access

GOAL: enable the plugin and ensure the agent can call OcuClaw's glasses-display tools.

Skip if: `openclaw plugins list` shows `ocuclaw` already enabled **and** the tool-access VERIFY below already passes → go to Step 5.

CHECKPOINT (rule 4) — **your pause message IS this checkpoint.** It must
contain, in itself, in this order: an OPENING sentence with the just-finished
phase's outcome — arriving here from Step 3 that sentence reports the
credential's state (present, or expected to be created by this plugin at its
first load; you check presence only and never see the value) — and after the
enable and load, the re-read `journey` is where the user learns it landed
(`origin: host-minted-at-load`); then one plain-words sentence of what Step 4 changes, a
fenced command with a one-line why for EACH Step-4 command that still needs
to run, and rule 5's reload warning; then get an OK. No Step-4 probe
evidence before that opening sentence: a pause message whose first words
describe your own Step-4 checks buries the answer the user is waiting for. Resolve need from
evidence already recorded this session, before drafting the message: the
enable (`openclaw plugins enable ocuclaw`) still needs to run only when no
recorded result shows the plugin enabled — a recorded `enabled: true` /
`explicitlyEnabled: true` (typed `overview`/`verify`, `plugins inspect`)
means the enable is already satisfied: say so in one sentence instead of
naming or re-running it. The lifecycle-hook grant
(`…hooks.allowConversationAccess true` — lets the host run OcuClaw's
end-of-turn lifecycle hooks: settle pending glasses/device calls at turn end
and distill session titles from the conversation) still needs to run only
when its recorded value is not already `true`. If every Step-4 command is already satisfied
there is nothing to checkpoint — report the evidence and move on. If the
message you are about to send pauses for an OK and shows no
command blocks, it is malformed — do not send it; send this checkpoint's
content instead (rule 4's output gate).
(Tool access needs no grant on this plugin version — see the read-only
verification below; only a restrictive policy found there adds a third,
separately checkpointed command.)

Give rule 5's warning once before the first Step 4 mutation; do not repeat it
for each command.

**Enable the plugin** (only when not already enabled — see the checkpoint):
```bash
openclaw plugins enable ocuclaw
```

**Grant lifecycle hooks** (non-secret but privacy-relevant — OpenClaw only runs a plugin's conversation-lifecycle hooks with this set. For OcuClaw those hooks do end-of-turn housekeeping: settle any glasses-display, device-info, or location call still pending when a turn ends so nothing hangs; apply the Even-AI model preference; and name sessions with a short title distilled from the conversation — that last part reads conversation content, which is why the host gates it behind the user's explicit OK; tell the user that's what it's for):
```bash
openclaw config set plugins.entries.ocuclaw.hooks.allowConversationAccess true --strict-json
```

**Read the tool policy** (read-only — announce and run, rule 4). OcuClaw's
tools, including the `ocuclaw_setup` controller, are exposed by default only
when the root tool policy leaves plugin tools exposed. A `tools.profile` other
than `full` hides them, so read the policy here and act on what it says; after
the Step 5 reload, SKILL.md's **Capability-first controller routing** table is
the single authority for effective policy and controller-lane selection:
```bash
openclaw config get tools
```
("Config path not found" is expected when no policy is set — the command exits nonzero then; record it: it means the policy is unset, so default exposure applies and there is nothing to change.)

Read the result in this order (a change here is the mutating exception —
checkpoint it, rule 5, before running anything):
- `deny` contains `"ocuclaw"` or `"group:plugins"` → STOP and ask the user — deny wins over every allow, and removing a deny entry is their call.
- `allow` exists, is non-empty, and lacks both `"ocuclaw"` and `"group:plugins"` → a restrictive allowlist is hiding the tools: merge `"ocuclaw"` into `tools.allow`, preserving all existing entries. Do NOT add an `alsoAllow` beside it — config validation rejects both set in the same scope.
- `profile` is absent or `full` → default exposure; nothing to change.
- `profile` is anything else → that profile hides plugin tools, so
  `ocuclaw_setup` will not reach the inventory. OpenClaw's own quickstart
  writes `coding`, so this is the common fresh-install case, not a policy the
  user deliberately chose. Say what you will run and why, get their OK, then:
  ```bash
  openclaw config set tools.alsoAllow '["ocuclaw"]' --strict-json
  ```
  Merge `"ocuclaw"` into an existing `tools.alsoAllow` rather than replacing
  the list; if a non-empty `allow` exists, merge `"ocuclaw"` there instead and
  set no `alsoAllow` in the same scope. No restart — Step 5's reload applies it.
  Admitting the plugin's own tools under a profile default is not weakening tool
  policy: a deliberate `deny`, or an `allow` the user wrote, still stands and
  still belongs to them (SKILL.md, "On the policy-hidden lane do not weaken
  tool policy").
- Anything else (`alsoAllow`-only lists, or an `allow` that already admits `"ocuclaw"`/`"group:plugins"`) → nothing to do.

Takes effect through the reload/restart verification in Step 5.

PRE-LOAD VERIFY: `openclaw plugins list` shows `ocuclaw` enabled. The root
policy either has no restrictive entry (default exposure applies) or admits
`"ocuclaw"`/`"group:plugins"`; this is not yet proof of effective
current-session callability. After the load, re-read `journey`: the Relay
Credential now reads present (`origin: host-minted-at-load` on a fresh
install); still absent → Step 3's `mintOnLoad` owner action. Step 5 performs
the authoritative inventory check after load.

---

### Step 5 · Relay port + reload/restart verification

GOAL: bind the relay to a host-safe loopback port, then load the plugin.

If Step 5 is the first mutating step in this entry and a branch below requires
a `config set`, give rule 5's warning immediately before that command. Do not
wait until Step 5c, and do not repeat a warning already given in Step 4.

**Step 5a — resolve the relay port (the plugin manages the default — no port dance on a fresh install).**

On plugin builds carrying this guide, an unset `wsPort` is decided by the
plugin itself at first relay start: a **fresh host** (no prior OcuClaw state)
gets `47800` and the plugin writes that into config, visibly; a
**pre-existing install** keeps its working baseline `9000` (the choice is
recorded durably in `ocuclaw-relay-port.json` in the OpenClaw state dir and
never re-litigated). The controller overview reports this as
`relay.portOrigin`: `explicit-config` (a value is set in config) or
`plugin-managed-default` (the plugin decides — or already decided — at relay
start). Do not narrate port selection to the user on the fresh lane; there is
nothing for them to decide.

Read the current configured port (non-secret — announce-and-run, rule 4):
```bash
openclaw config get plugins.entries.ocuclaw.config.wsPort
```
(Hosts resolve the manifest schema default into every config view — `config
get` prints `9000` even when the key is unset, and **before the relay's first
start** the controller overview reports that same injected `9000` as
`portOrigin: explicit-config`. So on a fresh install whose relay has not yet
started, a `9000`/`explicit-config` reading is PROVISIONAL, not proof of a
choice; the plugin checks the raw config file at first relay start and
settles the real port then. A **post-start** overview reports the port the
relay is actually bound to — that one you may trust.)

Decide:
- **An explicit value** (portOrigin `explicit-config`, any number — `47800`
  from a completed fresh install, a deliberate `9000`, or anything else) →
  keep it, make no change. Go to Step 5b. Exception: on a fresh install whose
  relay has not started yet, a reading of exactly `9000` is the provisional
  case above — treat it as the fresh flow (next bullet) and let Step 5c read
  the settled port; do not write `9000` into the lane card yet.
- **`plugin-managed-default` and the relay has not started yet** (normal
  fresh flow — Step 4 just enabled the plugin) → nothing to do here; Step
  5c's VERIFY reads the decided port from the startup line (`relay service
  started on ws://…`) and the config write that follows a fresh decision.
- **A change is genuinely needed** — only when the relay is broken on its
  current port (bind errors → `RELAY-PORT-CLAIMED` at 5c), a Step 10 test
  proves the setup broken, or the user asks. Find a free port with
  troubleshooting `RELAY-PORT-CLAIMED`'s read-only per-OS checks and ladder
  (`47800 → 43117 → 38271`), then CHECKPOINT the change (rule 4 — the pause
  message carries this command filled in with the chosen port):
  ```bash
  openclaw config set plugins.entries.ocuclaw.config.wsPort <port> --strict-json
  ```
- **Older plugin without `portOrigin` in its overview** (no fresh-default
  support) → fall back to deciding by value: a working existing `9000` keeps
  `9000`; a broken or genuinely fresh port takes the ladder above.

**Whichever branch applied — write the resulting wsPort into your lane card now** (`Relay wsPort: <port>`), including when you kept an existing value; on the fresh lane, fill it at Step 5c from the verified startup port.

**Step 5b — container sub-step** (read the lane card):
Read the current bind (non-secret):
```bash
openclaw config get plugins.entries.ocuclaw.config.wsBind
```
`Config path not found` means the runtime default, `127.0.0.1`. For every
keep-loopback branch below, leave a configured loopback value (`127.0.0.1`,
`localhost`, or `::1`) alone. If the current value is non-loopback — including
`0.0.0.0` left by an earlier setup attempt — restore the safe default:
```bash
openclaw config set plugins.entries.ocuclaw.config.wsBind "127.0.0.1"
```

- **Container: no** → keep the loopback bind; apply the check above, then skip
  container inspection.
- **Container: yes, network mode = host** → keep the loopback bind; host
  networking shares the host namespace.
- **Container: yes, relay ingress = same network namespace** → keep the
  loopback bind. This includes a local Tailscale Serve process proxying to
  `127.0.0.1:<port>` from the same container or microVM.
- **Container: yes (no-systemd), network mode or ingress unknown** → keep the
  loopback bind. Do not infer a bridge from a container marker, missing systemd,
  the plugin's topology notice, or the absence of a client before the user has
  actually tapped Connect. Record the unknown; a real Step 9 connection failure
  routes to `DOCKER-RELAY-UNREACHABLE` for host-side inspection.
- **Container: yes, network mode = bridge (or named network), AND the ingress
  proxy is confirmed outside this network namespace**: this lane is retired.
  Keep loopback and move Tailscale into the gateway's own namespace instead —
  the controller reads `tailscale serve status` from the gateway process's
  PATH, so a bridge + outside proxy cannot pass Step 7 or Step 9 however the
  listener is widened. Record it in the lane card, tell the user what has to
  move, and do not widen `wsBind`.

**Step 5c — allow reload, then verify.** The warning must already have preceded
any mutation in Steps 4–5. Allow OpenClaw's reload planner to act; do not issue
a pre-emptive restart.

VERIFY (always, before leaving Step 5 — never continue to Step 6 with an unloaded relay):
```bash
openclaw gateway status
openclaw plugins inspect ocuclaw
openclaw plugins inspect ocuclaw --runtime
openclaw plugins doctor
```
Pass = gateway healthy + `plugins inspect ocuclaw` shows `Status: loaded` + `plugins inspect ocuclaw --runtime` confirms runtime loading + `plugins doctor` reports no ocuclaw issues. (Unrelated warnings about other plugins don't block — only ocuclaw-specific failures do.)

If the gateway is live but inspection proves the runtime stale, request one safe
restart and repeat the VERIFY block:
```bash
openclaw gateway restart --safe
```
On a Cloudways host (`openclaw ocuclaw cloudways detect` says `cloudways`)
that command is a no-op: follow `{baseDir}/references/cloudways.md` "Restart
and reload on this host" instead.

If the gateway is down → `GW-DOWN`. If the safe restart fails because OpenClaw
cannot cross the service/supervisor boundary → `GW-RESTART-NOSVC`. Never retry
the same restart without a new finding.

Then apply SKILL.md's **Capability-first controller routing** table. This step
is complete only after that table identifies the controller or standalone lane;
run its typed or deterministic `verify` only when that lane says the operation
exists. Older loaded versions without controller surfaces stay on the table's
standalone `controller-unavailable-version` lane.

TOOL-POLICY VERIFY (after the reload, before Step 6) — the probe is the
inventory rule from SKILL.md's **Capability-first controller routing**, nothing
else. PASS needs both halves:
1. `ocuclaw_setup` is in THIS conversation's current-session inventory. If this
   surface does not show you that inventory, ask the user to type
   `/tools verbose` in this same conversation and read their result — that is a
   user-typed step, never an agent command.
2. One typed `ocuclaw_setup` call (the `journey` operation) returns a result.

ABSENT — `ocuclaw_setup` is not in the inventory although the plugin is loaded:
go back to Step 4's `profile` branch, apply the `tools.alsoAllow` merge if it
has not been applied, and re-check the inventory. Do NOT restart the gateway
for this, and do not re-derive the answer from `plugins list`,
`plugins inspect` or `config get tools`: none of them proves current-session
callability. If the policy is already correct and the tool is still absent,
this run stays on the policy-hidden lane for the rest of the guide.

Bind-path VERIFY — read the log line, never infer it: open the gateway log
(`openclaw logs`) and find the NEWEST `[ocuclaw] relay` lines. (A typed
`verify` reporting `runtime.status: "starting"` with evidence
`relay-start-pending-bind` is the same failure told typed-side: the relay
never finished binding — go straight to the log lines below.) Step 5 passes
only when the newest startup line reads `relay service started on
ws://127.0.0.1:<port>` (or another configured loopback address) with no later
relay bind failure. Quote gate (rule 4's output-gate shape): the FIRST
message you send after this log read — however many later steps that same
message also covers — must CONTAIN this two-line shape, filled from the
log, and state in plain words that the relay is verified running on that
port:

> Relay verified — the newest startup line in the gateway log:
> `[ocuclaw] relay service started on ws://127.0.0.1:<port>`

A message that does not contain that filled shape is malformed — do not
send it; so is a message that moves on to Steps 6–7 while never reporting
Step 5's outcome at all. If the newest relay lines instead show `EADDRINUSE`,
"address already in use", `WSAEACCES`, "forbidden by its access permissions",
or a repeating `relay worker exited`, the relay is NOT running — another
process owns the port — no matter what `gateway status`, `plugins doctor`, or
a typed `verify` report (a crash-looping relay worker can leave every one of
those views green) → `RELAY-PORT-CLAIMED`. On the fresh
lane this startup line is where you read the plugin-decided port (`47800` on a
fresh host); record it in the lane card, and expect
`openclaw config get plugins.entries.ocuclaw.config.wsPort` to return it now —
the plugin writes its fresh decision into config at first start. A later
`DOCKER-RELAY-UNREACHABLE` recovery is the only lane that may change this to
`ws://0.0.0.0:<port>`, after its host-publish safety check. The container
topology notice is informational: it neither fails verification nor proves that
ingress crosses a bridge.

If the startup log shows a bind/port error (`EADDRINUSE`, `WSAEACCES`, "address already in use", "forbidden by its access permissions") → `RELAY-PORT-CLAIMED`. If the log shows the relayToken error verbatim → `ERR-RELAY-TOKEN`. Any other gateway failure → `GW-DOWN`.

---

### Step 6 · Tailscale on this machine

Run `openclaw ocuclaw cloudways detect --json` first. If it reports
`cloudways` (or the user confirms a `likely`), load
`{baseDir}/references/cloudways.md` and follow it in place of Steps 6 and 7,
then rejoin here at Step 8. Otherwise continue below.

GOAL: install Tailscale — only devices on the user's tailnet can reach the relay; the phone can reach this machine from anywhere.

**Tailscale must run where the gateway runs:** the controller reads
`tailscale serve status` from the gateway process's PATH. Container/VM: run
tailscaled inside the same namespace (userspace networking is fine). macOS App
Store build: expose the CLI (troubleshooting.md `TS-SERVE-UNSUPPORTED` /
`TS-CLI-ABSENT`). A bridge + outside proxy cannot pass Step 7 or Step 9; do not
enter it. If Tailscale Serve runs in the relay's same network
namespace (including a Sprite/microVM), run the commands there and keep the
relay on loopback.

Skip if: `tailscale status` already shows signed in → go to Step 7. Read
that status UNCAPPED — no `head -N` or other line caps, here or anywhere:
device rows hidden below a cap poison Step 8's phone enumeration. For a
compact signed-in check use `tailscale ip -4` instead.

**Install (per OS):**

> **Why root:** Tailscale's daemon manages network interfaces, so install, `tailscale up`, and `tailscale serve` need elevation on Linux — standard Tailscale practice, scoped to exactly those commands. If the lane card says "user runs elevated," every `sudo` command in Steps 6–7 goes to the user.

Linux (needs root — if your lane card says "user runs elevated," hand this to the user):
follow Tailscale's own Linux instructions at
[tailscale.com/download/linux](https://tailscale.com/download/linux). The page
asks for the distribution and then prints the package steps for it: add the
Tailscale package repository, then install the `tailscale` package with the
system package manager. Read those steps with the user and let the user run
them. Do not pipe a downloaded script into a shell.

macOS: install the **standalone package** from `tailscale.com/download` — it puts `tailscale` on PATH. If the user has the Mac **App Store** build instead, its CLI lives at `/Applications/Tailscale.app/Contents/MacOS/Tailscale`. **Write that full path into the lane card's `Tailscale CLI` row if the App Store build is used** — you'll need it in Step 7.

Windows: run the installer from `tailscale.com/download/windows`.

**Sign in (per OS):**

| OS | Sign in |
|---|---|
| Linux | `sudo tailscale up` — user opens the printed URL and logs in |
| macOS | Open the Tailscale app and sign in |
| Windows | Sign in from the tray app |

VERIFY: `tailscale ip -4` prints a `100.x.y.z` address.   ·   If not → `TS-AUTH`.

---

### Step 7 · Private phone route

GOAL: connect the phone privately through `:8444`. Configure only this route
during core setup. Step 12 owns the optional `:8443` route and runs only on
explicit Even AI intent. Preserve any existing optional route.

| Port | Type | Used by |
|---|---|---|
| `:8444` | direct TCP (TLS-terminated) | the OcuClaw app (Step 9) |
| `:8443` | HTTPS proxy | Even AI's agent endpoint (Step 12) |

**Resolve `<port>`** from your lane card (`Relay wsPort`). If it is blank, re-read it now: `openclaw config get plugins.entries.ocuclaw.config.wsPort`. On plugin builds carrying this guide a completed fresh install reads `47800` (the plugin wrote it at first relay start); `9000` on a pre-existing install is its preserved working baseline — the routes below then target it. If the value still looks undecided, re-run Step 5a's read and Step 5c's VERIFY first, then return here.

**Controller lane for the `:8444` door.** When `journey` is callable and its
`currentHealth.privateRoute` has `schemaVersion: 1` and a `proposal` block, that
block decides the `:8444` route and replaces the `tailscale serve status`
read for it — do not re-derive the verdict from the raw status output:

- `status: healthy` → the `:8444` door is verified, owned and reachable; skip
  its command and go to Step 8.
- `status: missing` or `stale` with `proposal.status: presented` → the
  phase's ONLY `:8444` command is `proposal.applyCommand`, verbatim (prefix
  `sudo` / use an Administrator shell exactly as the lane card says; on the
  macOS App Store build swap the `tailscale` word for the lane card's CLI
  path). Never build it from the template below, never run it yourself, and
  after the user runs it re-read `journey`: only a fresh `healthy`
  observation of the applied route completes the checkpoint.
- `status: missing` or `stale` with `proposal.status: withheld` → read
  `proposal.reason`. `node_dns_identity_unknown` routes to Step 6 (Tailscale
  is up but has no MagicDNS name yet). `route_receipt_not_written_route_not_
  fully_identified` or `route_receipt_unavailable` means the controller could
  not record ownership on this host (no installation identity, or
  `~/.evenclaw/state` is not writable). Explain the ownership failure and
  have the installation owner resolve it, then re-read `journey`. For a
  receipt-lock failure, inspect the lock and its owner; never remove it while
  that owner is active. Keep
  this checkpoint blocked until ownership and reachability are verified;
  do not substitute the standalone template for a withheld command.
  Any `route_receipt_owned_by_…` reason is a `conflicting` port: see the next
  bullet.
- `status: foreign` / `conflicting` / `exposed` / `unreachable` / `offline` /
  `unknown` → read `nextCheckpoint.action` and `privateRoute.evidence`, tell
  the user what occupies or blocks the port, and do NOT propose the template
  command over it: `foreign`/`conflicting` means another service, gateway or
  Runtime Bundle holds `:8444` (or a web handler does), `exposed` means
  Funnel publishes it, `offline` routes to Step 6.
  A withheld command is never an invitation to improvise one.
- `unreachable`: read `privateRoute.evidence`. `front_door_unresolved` = this
  node cannot resolve its own MagicDNS name (containers, userspace nodes):
  `tailscale set --accept-dns=true`, or a `nameserver 100.100.100.100` line in
  the node's resolver, or an `/etc/hosts` line for `<node>.<tailnet>.ts.net`,
  then re-read `journey`. A timeout or a refused connection instead means
  certificates or the relay: take the HTTPS certificate wait below, then the
  Step 5 relay bind.
- `unknown` with evidence `serve_cli_absent` on a non-Cloudways host: the
  `tailscale` CLI is not on the gateway process's PATH (macOS App Store build:
  expose the CLI), or Tailscale runs in a different container/VM than the
  gateway; move one of them. See `TS-CLI-ABSENT`. Any other `unknown` routes to
  Step 6 or `TS-SERVE-UNSUPPORTED`.
- `teardown.command` (only ever `tailscale serve --tls-terminated-tcp=8444
  off`) is shown by the controller only while its receipt and the live route
  agree; it belongs to the uninstall/move journey, never to setup.

After a route is applied for the first time, allow up to a minute for
Tailscale to issue its TLS certificate before treating a timeout as a fault.
Measured live on a Cloudways host: the first handshake took 31 seconds, with
`unreachable`/`front_door_timeout` until the certificate existed; handshakes
after that were 36 to 66 ms. Re-read the route after that wait; only a repeat
timeout past it is a real problem.

The remaining commands apply only to older bundles without the route-reader
contract. A withheld controller proposal never falls through to this lane.

Skip if: the existing phone route is verified as this installation's working
baseline → Step 8. Read `tailscale serve status`; a matching target alone does
not prove ownership. If absent, propose the single command below. If occupied,
stale, foreign, public through Funnel or ambiguously owned, preserve it and ask
the owner to resolve the specific route. Never overwrite it or reset Serve.
An older working `tcp://…:8443` phone route is preserved; if broken, route to
`MIGRATE-8443` with ownership evidence.

CHECKPOINT (rule 4) — reading `tailscale serve status` needs no OK, but the
route change does: before running anything mutating below, tell the user in
plain words what Step 7 changes and why, naming the single phone-route command
with the real `<port>` substituted. State that it permits private tailnet phone
connections and does not enable Even AI or Funnel. State the ownership evidence.
If the lane card says the user runs elevated,
say these go to their terminal. Then get an OK. **Your pause message IS this
checkpoint** — if it pauses for an OK and shows no command blocks, it is
malformed: do not send it; send this checkpoint's content instead (rule 4's
output gate).

**Run the phone command for your OS** (substitute `<port>` from the lane card; on the macOS App Store build, use the lane card's `Tailscale CLI` path in place of `tailscale`):

Linux / macOS:
```bash
sudo tailscale serve --bg --tls-terminated-tcp=8444 tcp://127.0.0.1:<port>
```

Windows (Administrator PowerShell):
```powershell
tailscale serve --bg --tls-terminated-tcp=8444 tcp://127.0.0.1:<port>
```

VERIFY: `tailscale serve status` shows the private phone route to `127.0.0.1:<port>`:
```
|-- tcp://<node>.<tailnet>.ts.net:8444 (TLS terminated, tailnet only)
|--> tcp://127.0.0.1:<port>

```
If the phone route is still absent, recheck ownership before one retry. A wrong
backend is an owner-recovery case, not permission to overwrite. Still missing
after that retry → `TS-PORT-CLAIMED` or `TS-SERVE-UNSUPPORTED`; no blind reruns.

`--tls-terminated-tcp` requires **HTTPS Certificates** enabled for this tailnet at `login.tailscale.com/admin/dns`, alongside MagicDNS. Without them Tailscale accepts the route and every connection through it then fails; on the Hermes side the symptom is `probe_failed` plus `relay_verifier_protocol_error` on a route classified `ready`, and `tailscale cert --cert-file /dev/null --key-file /dev/null <node>.<tailnet>.ts.net` answers `your Tailscale account does not support getting TLS certs`. Fix is two clicks in the admin console under DNS, then re-verify.

Note the machine name `<node>.<tailnet>.ts.net` from that output — you'll use it in Step 9.   ·   Port already claimed → `TS-PORT-CLAIMED`; unknown command or flag → `TS-SERVE-UNSUPPORTED`.

---

### Step 8 · Phone joins the tailnet

GOAL: the user's phone becomes a trusted member of the same private tailnet as this machine.

Ask the user to: install Tailscale on their phone (App Store / Google Play), sign in with the **same account**, and leave the VPN toggle on. If their tailnet requires device approval, they approve it at `login.tailscale.com/admin/machines`.

VERIFY: `tailscale status` on this machine shows the phone, **and** the phone's Tailscale app shows "Connected." If several devices appear in `tailscale status`, enumerate candidates from the FULL status output — never a line-capped or otherwise truncated read, whether from this step or an earlier probe: a device below the cut silently vanishes from the candidate list; a compact read filters to phone-class rows (the OS column: iOS/Android), it never truncates. Report the online phone-class devices (iOS/Android in that output) in one line, for example "Tailscale sees `<device>` online." Do not ask which one is their phone: pairing proves which phone connects, and the name only feeds the lane card. If no phone-class device is online, ask the user to open Tailscale on the phone they will pair and turn it on, then re-check; trust the phone app's own "Connected" state as the source of truth.   ·   If not → `PHONE-NO-REACH`.

---

### Step 9 · OcuClaw app

GOAL: the user installs and connects the OcuClaw phone app to the relay on this machine.

**Production terminal lane (recommended candidate: OpenClaw 2026.9.x, Node
24.16+ within 24.x or 26.1+):** read `journey` first. When
`capabilities.pairing` is `available`, hand off once to the user's own interactive
terminal: `openclaw ocuclaw pair`. The command rechecks this installation,
credential and owned reachable private route. On the phone, the user opens
OcuClaw in Even Hub, taps **Pair with your computer**, then
**Take a photo of the QR code**; if the camera cannot read it, they tap
**Enter the pairing code instead** and type the short-lived address and code
the terminal shows. Both
start the same encrypted exchange. The user compares all four words in order on
both devices and types `approve` (any letter case; `yes` also works) only when they match; `refuse` or `no` refuses,
`cancel` or Ctrl-C stops, a typo or a bare Enter is asked again, and expiry requires a fresh attempt.

Never run or capture this command through an agent terminal, a pipe, screenshots,
or ordinary logs. Never ask the user to paste the QR, code, safety words, or
credential into chat. Browser and conversation surfaces hand off to this same
terminal ceremony; they cannot approve it. `--light-terminal` adjusts QR contrast.

VERIFY: approval alone is not connection. The terminal separately reports
encrypted credential delivery and this phone's observed authenticated connection.
If delivery is uncertain, check the phone before retrying. An existing connected
phone does not prove the new attempt succeeded. Refusal, expiry, an active competing
attempt or an unavailable route requires the named recovery and a fresh attempt;
preserve the credential and other phones throughout. Pairing does not record first use
or establish a G2 reply.

After you hand over the command, end your turn. When pairing finishes and the
phone connects, the relay wakes this setup chat with a plugin notification. It
starts "[ocuclaw setup wake] Automatic message from the OcuClaw relay." It is
never the wearer speaking, and it says the phone finished pairing and is
connected. On that wake, re-read `journey` on the
same host and continue at Step 10 without waiting for the person to type. If the
wake says the phone has not connected yet, ask them to open OcuClaw on the phone.
Only a chat that already called `ocuclaw_setup` is woken. If no wake comes, the
person can still say they are done; then re-read `journey` and continue at Step 10.

**Older bundle without terminal capability:** use the existing manual connection
instructions below only when the user already holds their credential. A
host-provisioned credential cannot be copied; install the supported pairing
candidate through the approved update lane instead of resetting it.

Ask the user to: open the Even Realities app → Even Hub App Store → install and open OcuClaw → go to **Relay Server** and enter:

- **Address:** `wss://<node>.<tailnet>.ts.net:8444` (use the exact machine name from Step 7)

  ⚠️ The address must start with `wss://` (not `ws://`), and use port `:8444` — not `:8443` (that is the Even AI door), and not the relay's local `wsPort` (e.g. `47800`), which is loopback-only and the phone can never reach it.

  > **Common wrong addresses — do not mix these up:**
  > OcuClaw app relay address: `wss://<node>.<tailnet>.ts.net:8444`
  > Even AI agent URL: `https://<node>.<tailnet>.ts.net:8443/v1/chat/completions`
  > Local relay backend: `127.0.0.1:<wsPort>`

- **Token:** the Relay Credential. The host created it (Step 3) and nobody can read it back, so it reaches the phone only through the pairing exchange, never by retyping. Fill this field by hand only when the user already holds a credential they chose on an older install; otherwise a bundle without terminal pairing is a blocker to report (install the supported pairing candidate through the approved update lane), not something to work around by resetting the credential.

Tap **Connect**.

VERIFY: the app shows "Connected" and OpenClaw Status fills in (session, model). Host-side confirmation: `openclaw logs` shows `[ocuclaw] relay client connected …` from the moment they tapped Connect. Host-side connection evidence is exactly two signals: that relay connect log line, and a typed verify's `runtime.appClientConnected` — session listings are neither: they are scope-restricted (`visibility=tree`) and cannot see the phone's `ocuclaw:` session from this lane, so a session count proves nothing about the connection in either direction.   ·   The app connects but then shows a version screen saying the **app is too old** for the installed plugin → `CLIENT-TOO-OLD` (troubleshooting).   ·   Anything else → `APP-CONNECT-FAIL`.

---

### Step 10 · End-to-end check

GOAL: confirm the full chain works — message sent, reply received, glasses display it.

Read `journey` from the host setup conversation. If `coreComplete` is already
true, preserve it and report any current outage separately. No new attempt,
pairing or wearer confirmation is needed.

**Tool-driven lane:** use only when `capabilities.toolFirstUse: available` and
`ocuclaw_setup` is callable. Keep setup in this host conversation. On this lane
the relay runs the test and wakes this chat when it ends, so "this chat
continues by itself" is true here. It is true for this lane only.

1. Call `ocuclaw_setup` with `{"operation":"first_use_begin"}` **before** inviting
   a fresh message (`{"operation":"first_use_retry"}` for a fresh attempt).
   The owning runtime selects the authenticated phone session;
   an ambiguous/disconnected phone or changed saved session needs recovery,
   never a guessed session or a silent retry.
2. The call answers at once. It returns `say` lines and an `action`. Say the
   `say` lines as your FINAL message, then END YOUR TURN. Do not call
   `first_use_wait` or `first_use_welcome`. Do not write the instruction
   before the tool call: the OpenClaw TUI does not draw text written before a
   tool call, and final text always shows. The lines ask for any phone message
   ("hello" is fine) and explain the double-tap before the card appears. Never
   ask for "I sent it" or "I double-tapped". Do not send the test message from
   the host conversation or through remote control. Ending the turn IS the
   wait: never run `sleep` or any shell command to wait for the test. In a
   later turn (the user asks for status), the quick read is `first_use_wait`.
3. The relay then runs the test by itself. It waits for the phone message and
   its reply. It reads the phone's SDK receipt for that reply. It shows the
   fixed OpenClaw × OcuClaw welcome card on the glasses (with Cloudways added
   on a Cloudways managed host) and counts the double-tap. A late tap still
   counts within the card's window of about 5 minutes. If something else takes
   the card away, the relay draws it again by itself; that does not use up a
   try. Never assemble a separate render command. A generic close, render
   acknowledgment, timeout, cancellation or failure does not establish
   dismissal.
4. Every ending wakes this chat with a plugin notification that starts
   "[ocuclaw setup wake] Automatic message from the OcuClaw relay." and
   carries the result. It is never the wearer speaking. Some hosts show it in
   the chat (the OpenClaw 2026.9 TUI does), so it is short and neutral; others
   show only your reply. Unless it is a pass whose lines are already shown,
   open your reply by saying what happened.
   A busy turn is fine: the gateway queues the wake and runs it right after.
   Follow the notification's instructions:
   - **passed**: setup is complete. The completion lines are the `say` lines
     of the completing result: "OcuClaw setup is complete. Optional
     integrations can wait.", the evidence line, then the three Optional setup
     handoff lines. In a local chat the relay has usually already shown them
     in this chat at the double-tap; the notification says so. Then do not
     repeat them: go straight to the wrap. Otherwise start your reply with
     them at once, word for word, one per line, before any tool call or file
     read. Then continue
     with wrap_feedback (references/wrap-feedback.md). The completing result's
     `nextOperations` is `["wrap_feedback"]`. That means go to the wrap; it is
     not an `ocuclaw_setup` operation.
   - **timed-out** at the reply stage: no phone message was answered in time.
     Ask the person to open OcuClaw on the phone, and offer `first_use_retry`
     when they are ready. At the welcome stage: the reply reached the glasses,
     but the card was not double-tapped in time. Offer one retry with
     `first_use_welcome_retry` and the binding the notification gives. That
     call also answers at once: say its lines and end the turn.
   - **errored**: the model failed this attempt. Follow step 5.
   - **needs-wearer-check**: the phone could not report the receipt. Follow
     step 6.
   - **phone-changed**: the phone's session changed during the test. Ask the
     person to open OcuClaw in the conversation they want, then start a fresh
     attempt with `first_use_retry`.
   - **tries-exhausted**: the card was shown twice without a double-tap. Do not
     show it again. Report the welcome as pending, as the notification says.
   - **welcome-unavailable**: the card could not be shown. If something else
     is open on the glasses, ask the person to close it, then offer
     `first_use_welcome_retry`. Otherwise report the welcome as pending.
   Never treat a wake as the wearer's answer. `first_use_confirm` is refused
   in a turn a setup wake started (reason `setup-confirm-refused-after-wake`),
   so never call it in the same turn as the wake. Outside this lane, do not
   promise a later notification, a later re-check, or any other future action:
   nothing else wakes you after the turn ends.
5. On an errored wake, and whenever you read `firstUse.replyRunErrored` (the
   journey) or `replyRunErrored` (a tool result): it is `{code, class}`
   whenever the model failed this attempt, whether the error text reached the
   glasses (`firstUse.replyWasProviderError: true`) or the run died before any
   reply existed (the record still reads `awaiting-reply`). Either way, ask NO
   glasses question: there is nothing for the wearer to judge, and
   a provider-error reply never proves setup. Report it plainly — the chain
   works, the model is unreachable; OcuClaw is installed, setup is not
   complete — then give the ONE fix for its `class`:
   - `auth` (sign-in rejected): sign in to the model again
     (`openclaw models auth add`).
   - `quota` (out of quota): check the plan or billing for this model.
   - `rate_limit` (rate limited): wait for the limit to reset or choose
     another model.
   - `overloaded` (provider busy) or `model_error` (model error): try again in
     a minute, or check the model itself (`openclaw models status --probe`).
   Then offer `first_use_retry` and a fresh phone message. The journey says
   the same thing at checkpoint `phone-origin-proof`, reason
   `reply-run-errored`: "The chain works; the model is unreachable. Fix the
   provider, then offer first_use_retry; do not ask whether the reply
   appeared." Run outcomes are held in memory, the last 64 runs only, so after
   a gateway restart a pre-reply error is unknowable and a reply's class falls
   back to `model_error` (or `rate_limit`): say the outcome can no longer be
   read and ask for a fresh attempt. Never invent it. Do not read or grep the
   gateway log for the error: the `class` is the whole diagnosis. The same
   holds when your own turn fails upstream: retry the typed call once, or
   report the error in plain words.

6. On a needs-wearer-check wake (or `awaiting-confirmation` found on resume),
   retain the opaque `binding` and ask once in this host setup conversation:
   **“Did that reply appear on your glasses? Type yes or no.”** Ask it
   open-ended: no answer choices, so nothing is preselected or marked
   recommended. Then end the turn. Only the person's OWN next message can be
   recorded. An explicit yes permits
   `{"operation":"first_use_confirm","binding":"<returned binding>","answer":"yes"}`.
   An explicit no may be recorded with `answer: "no"` and leaves setup unfinished.
   Missing, ambiguous or unrelated answers do not permit confirmation. For a
   vague answer, ask once more the same way; if it is still not a clear yes,
   diagnose. A question-tool timeout reply is no answer, never yes. A tool
   result, socket health, a render call or a setup wake cannot supply the
   wearer's answer. After a yes, the relay shows the welcome by itself: say the
   returned lines and end the turn again. When the phone did report the
   receipt (`replyEvidence: client_sdk_receipt`), the relay skips the question
   and goes straight to the welcome; never present that receipt as the
   wearer's own answer.
7. The welcome needs `capabilities.welcome: available`. Preserve the confirmed
   phone reply. An exhausted retry stays incomplete; never loop welcome
   renders. If the phone binding changed, follow the required fresh-attempt
   recovery instead.
8. Re-read `journey`; only `coreComplete: true` finishes core setup. Report
   `confirmationSource: host-setup-conversation` honestly as a wearer report
   relayed by the agent. Test-input records never establish wearer acceptance.
   Keep reply confirmation and welcome dismissal distinct. The bounded native
   acceptance check must also confirm return to the intended conversation
   page; a dismissal event alone does not prove its exact destination.

Give the user only their next action and the observed outcome. Opaque bindings,
session identifiers, capability disagreements and private operation names stay
inside the tool flow. A current host whose renderer is unavailable keeps its
welcome milestone pending. An older controller without the welcome capability
can retain its older completion policy, but never call that welcome proof.

If the reply never appeared, repair the path and explain the fresh attempt
before calling `{"operation":"first_use_retry"}`. Retry binds the currently
selected unambiguous phone session and invalidates unfinished reply bindings;
completed wearer records are preserved. On interruption, restart or a new host
conversation, read journey and resume its first incomplete milestone. When
reply confirmation is saved, resume welcome without another phone message.
Restart never replays a saved welcome surface or accepts an old gesture.
`first_use_wait` no longer waits: it is a quick read that also picks a stalled
relay run back up after a restart. After a previously unanswered question, use
it to recover the binding and ask for the outstanding observation; never invent
an earlier answer.

The capable-host happy path needs neither first-use terminal command. Secure
terminal pairing in Step 9 remains unchanged. An unavailable result routes to
owner/runtime/session recovery; do not erase the record or claim completion.

**Compatibility / policy-hidden lane:** with `capabilities.firstUse:
direct-terminal`, hand off ONCE: the user opens the intended OpenClaw conversation
on the phone and runs `openclaw ocuclaw first-use` in their own terminal. **One
command, one run.** The command binds that session, reports `awaiting-reply`,
prints "In the paired conversation on your phone, send hello." and "Waiting for
the reply on your glasses...", and then waits for that reply itself and
continues on its own. Nobody runs the command a second time to collect the
answer. An explicit `--session
<key>` can bind a known phone session; normal resume never replaces the saved
session. Keep setup in the host conversation, not the phone test chat.

The journey says the same thing and never claims a live process: "A
first-message check is armed for this phone session. Run openclaw ocuclaw
first-use in your own terminal; it waits for your phone message and continues
on its own."

How long it waits: `--first-use-wait <seconds>`, default 600. The tool-driven
lane above uses the relay's own windows instead: 10 minutes for the phone
message and its reply, about 5 minutes for the welcome double-tap. The flag
does not change them, and nothing in that lane blocks a tool call.

Ask them to send "hello" from the app's Send Message box and read its reply on G2.
Only an authenticated app send followed by that run's completed reply can advance
to `awaiting-confirmation`; old replies, another backend/installation/session,
host-generated traffic, connection health and render dispatch do not qualify.

In the same run, the command names the saved session
and reply time and asks for `SEEN ON G2` only if that reply appeared on their glasses.
Enter, cancellation and interruption leave confirmation pending. The assistant
must not run the ceremony, type the answer, or call its private gateway operation.
Automated exercises use `--test-input`; their receipts cannot establish wearer proof.
If the phone already reported that exact reply reaching the display, the command
says so, asks nothing, and hands straight over to the welcome card, which the
wearer still dismisses themselves.

Three endings that are not a reply, and none of them is a failure of OcuClaw:
- **Timeout** (exit 1) is neutral: "No reply was recorded for a phone message
  in this conversation within N s." Check the phone is connected and the right
  conversation is open, then run the command again.
- **Cancelled before any reply**: "No phone message was received. Run
  `openclaw ocuclaw first-use` again when ready." Nothing was recorded, and
  confirmation is not pending.
- **The model returned an error instead of an answer**: the command prints the
  provider-error verdict — "Your message reached your agent and its reply
  reached your glasses, but the model returned an error instead of an answer.
  OcuClaw is installed; setup is not complete." followed by one line that
  names the failure and its fix — a rejected sign-in (sign in again with
  `openclaw models auth add`), out of quota or billing, rate limited, or a
  busy/failing provider (check with `openclaw models status --probe`) — each
  ending "then run openclaw ocuclaw first-use --retry" — and exits 1. It
  never asks for `SEEN ON G2`. Run outcomes are
  held in memory, the last 64 runs only: after a gateway restart with no prior
  wait the error is unknowable, so ask for a fresh attempt rather than guessing
  what happened.

The local manual guide uses this same terminal path. On a capable installed host,
`first-use` runs the welcome and prints recorded completion after its dismissal.
If it reports that the host cannot show the welcome, preserve working text chat
and report **welcome pending**; a zero process exit is not welcome proof. Resume
the saved journey in the Setup Assistant for the supported capability/recovery
handoff. Check the installed command/capability surface before recommending it;
source in a candidate does not establish availability in a published bundle.

If the recorded reply never appeared, fix the connection and run
`openclaw ocuclaw first-use --retry` before a fresh phone send. This rearms only
unfinished setup and invalidates the old reply/confirmation attempt. Add `--session
<key>` to explicitly select a different intended phone session during retry.
Completed wearer-confirmed setup is never reset by retry.

Re-read `journey` after the handoff. `coreComplete: true` is the completion criterion.
Say the same completion lines as the tool-driven lane, word for word, one per
line: "OcuClaw setup is complete. Optional integrations can wait.", the evidence
line, then "Optional: on your phone, the Optional setup card on Home offers voice
and Even AI." "You can also reach them later under Settings > Voice and
Settings > Defaults > Even AI." "Choose what you want, or leave it for later."
The Home card and dedicated pages require a matching installed bundle; verify
the advertised interface before offering this path. The card's two buttons are
**Set up voice** and **Set up Even AI**. The card has no other buttons, and Settings
has no separate optional-setup row. Use the names above and nothing else.
Dismissing the card hides
only that runtime installation's Home invitation. Voice and Even AI skips stay
separate, and Settings > Voice and Settings > Defaults > Even AI always provide
re-entry. An older bundle keeps its
supported private-entry flow; candidate source is not a public availability claim.
Keep the recorded reply evidence label: SDK acceptance and wearer confirmation
are distinct. The user can stop here. If they return after a
restart, reconnect or new host conversation, resume the saved checkpoint. A later
outage is current health; use `recoveryCheckpoint` without erasing completion or
repeating pairing. An unreadable/foreign record needs installation-owner recovery,
never deletion or guessed success. Older controllers without this capability cannot
record durable core completion; report that limitation.

If not:
- App reported a send failure → `APP-CONNECT-FAIL`
- Message sent but no reply → `GW-DOWN`
- Reply visible in the app but glasses are dark → wake the glasses (double-tap), reopen OcuClaw inside Even Hub, and retry

---

### Step 10b · Live UI demonstration   [OPTIONAL — deferred from core setup]

Run this demonstration only if the user requests it after core completion. It
does not record first-use success and its dismissal is never a completion gate.

Announce the requested demonstration and run in the same turn. If the user skips,
stop successfully; their core setup stays complete.

The double-tap instruction must reach the user BEFORE the render call runs.
Say before the call: "I'm pushing the requested test screen to your glasses.
When you see it, double-tap to dismiss it and I'll confirm the moment I feel
it." A render call made when the user was never told to double-tap is
malformed — the tactile moment only lands if they know to tap. Then:

- Call `render_glasses_ui` THIS TURN: kind `text_surface`, a short title,
  a two-line body such as "Live UI test — double-tap to dismiss.", and
  `timeoutMs: 60000`. The call now WAITS for their double-tap — that wait
  is the point: the dismissal travels glasses → phone → relay → you, and
  your reaction to it is the tactile proof the loop runs in both
  directions.
- Availability is guaranteed by construction: the glasses tools register
  the moment the plugin loads with the relay token set (that reload
  happened back at Steps 3–4), and the host recompiles your tool inventory
  every turn — on any install that has passed Step 10, the renderer IS
  callable now. NEVER tell the user this tool is unavailable in this
  session, and NEVER suggest starting a new conversation or session for
  this test; a claim of unavailability is valid only with an
  actually-rejected call from THIS turn, quoted exactly.
- Connection-state claims follow the same rule. Any belief that the
  display is disconnected must be proven THIS TURN: a typed `ocuclaw_setup`
  verify whose `runtime.appClientConnected` is `false`, or the call's own
  rejection (`glasses_not_connected`) — never a remembered warning from an
  earlier turn (runtime connection notices are turn-scoped and withdrawn on
  reconnect). A `null` verify means the host gave no runtime view — treat
  as unknown, make the call, and judge by its result.

VERIFY, by the call's result:
- Result `back` / `dismissed` / any wearer-gesture outcome → the loop is
  proven end-to-end BOTH ways. Say so with the tactile link, e.g.: "I saw
  the screen arrive and I felt your double-tap come back — the connection
  works in both directions." Tick the box.
- Result `window_expired` or `timeout` (60 s passed with no gesture) → the
  surface is still live on the glasses; fall back to eyes: ask "did the
  test screen appear on your glasses?" Seen → tick the box (the push
  itself worked), tell them they can double-tap to dismiss it, and note in
  your wrap assistant-notes that the dismiss gesture was not felt within
  the window (worth a bug report if they say they DID double-tap). Nothing
  appeared → mark the box `[blocked: no paint]`.
- Call rejected / errored → mark the box `[blocked: <exact error>]`,
  surface it plainly, and continue to the optionals — a blocked push never
  parks the finish, and the fallback is a bug report at the wrap, never a
  new session.

---

### Step 11 · Voice input via Soniox   [OPTIONAL — recommended]

GOAL: let the user talk to the agent from the glasses instead of typing.

**Offer this step; let them skip to Step 12 if they prefer.**

Ask: "Would you like to set up voice input? Soniox shows words as you speak.
It needs a separate Soniox account, project and API key. You can skip it and
return through OcuClaw > Settings > Voice."

If they want it:

1. Open **https://console.soniox.com**, sign in and choose the project.
2. Open **API Keys** and create a key with real-time speech-to-text, temporary
   API keys and model listing enabled. Follow the console's current account
   and billing requirements. Model-provider sign-in does not provide Soniox access.

**Primary phone path, when advertised:** tap **Set up voice** on Home's **Optional setup** card (later: **Settings > Voice**),
choose Soniox, then enter the key in the masked private field on the Save step.
An existing key requires explicit replacement confirmation before new entry.
On supported hot-reload OpenClaw hosts, **Save and apply** discloses that it
saves the key and requests a reload. Reconnect and refresh active state; a save
does not prove that reload completed or that speech works. Unsupported host
activation remains pending with its supported host handoff. Never restart
Cloudways to finish optional setup. Cancellation preserves existing settings.

<details><summary>Advanced: private terminal entry or an older bundle</summary>

🔑 USER ACTION REQUIRED — use your own terminal on the selected Primary Runtime.
Check that this installed bundle advertises the command before directing the
user to it. The command opens hidden private entry; no secret belongs in an
argument, shell history, chat, screenshot or log:

```
openclaw ocuclaw credential soniox
```

An existing credential is preserved. Only a deliberate replacement uses
`--replace`. Blank input or cancellation keeps the current setting. A failed
save stays failed or unknown; preserve text chat and retry only this capability.
If the command is unavailable, explain the installed-bundle limit and use its
supported private setup entry; never fall back to putting a secret in a command.

Follow the command's activation result. A supported hot/hybrid host may apply
the saved change through a safe plugin reload. Off/restart/unknown reload policy
leaves it pending for explicit host action; do not guess from a version number,
restart Cloudways, or report a saved key as active. The candidate supports this
reload path only on inspected OpenClaw 2026.5.3-1, 2026.7.1, 2026.7.1-2 and
2026.9.4 with observed hot/hybrid policy.

</details>

VERIFY: after activation, return to **Settings > Voice** and
start the spoken test for the selected session/provider. The user speaks a short
phrase; a matching final transcription from that capture is the speech proof.
Key presence, auth success, old transcripts and typed chat are not speech proof.
A reconnect or changed configuration requires a fresh test. An unavailable
provider or failed test leaves text chat and other optional choices intact.

---

### Step 12 · Even AI integration   [OPTIONAL — recommended]

GOAL: the Even AI wake word on the glasses gets answered by this OpenClaw session, not Even's default AI.

**Offer this step; let them skip to Step 12b if they prefer.**

Ask: "Would you like to wire up Even AI so your glasses' wake word goes to your OpenClaw? Saying yes routes all Even AI requests here. Say yes to continue or skip to move on."

If they want it, follow these six checkpoints in order.

#### Checkpoint 1 · Unlock Agent Configuration

Sign in at `https://hub.evenrealities.com/hub` with the **same email** as the
Even account paired to the glasses. In the Even Realities app, open Even AI and
unlock `Agent Configuration`. If it does not appear yet, wait a minute, then
fully force-close and reopen the app.

#### Checkpoint 2 · Store the private Even AI secret

**ORDER MATTERS: set the token first, then enable.** Config validation rejects
enabling Even AI without its token already set. Create a strong private value
to use as the Even AI token; it will also be entered in the app in Checkpoint 5.

**Primary phone path, when advertised:** tap **Set up Even AI** on Home's **Optional setup** card (later: **Settings > Defaults > Even AI**), then **Connect** >
Connect** and its masked private secret field. Keep the same user-chosen secret
for the Even app. Confirm an existing-secret replacement separately. On supported
OpenClaw hot-reload hosts, **Save and apply** requests reload; refresh the host
readback after reconnecting. Continue to the route review and real request check.

<details><summary>Advanced: private terminal entry or an older bundle</summary>

🔑 USER ACTION REQUIRED — use your own terminal's hidden prompt:

```
openclaw ocuclaw credential even-ai
```

Check command availability first. Existing values are kept unless the user
deliberately adds `--replace`; blank/cancel preserves them. Never ask the user
to paste or read the token into chat. Keep the same private token for the Even
app later. The saved `evenAiToken` is not activation or a real request receipt.

#### Checkpoint 3 · Enable Even AI on OpenClaw

Once the private save is confirmed, run the supported capability command:

```
openclaw ocuclaw even-ai enable
openclaw ocuclaw even-ai status
```

`enable` changes only the Even AI enabled setting after token presence. Follow
its observed host-policy result: safe hot reload on supported hot/hybrid hosts,
or saved/pending with explicit host action. Preserve an unsupported, stale or
offline observation; do not restart Cloudways or label it active from config alone.

</details>

#### Checkpoint 4 · Create and verify the private Even-AI route

Read the selected Primary Runtime's live route proposal:

The phone's **Review private route** is a review handoff only. It does not apply
a Serve change. Keep the separate explicit approval below; private input or a
successful save is not approval to expose a route.

```bash
openclaw ocuclaw even-ai route
```

The **Even AI agent URL** is
`https://<node>.<tailnet>.ts.net:8443/v1/chat/completions`. It is separate from
the **OcuClaw app relay address** at `wss://<node>.<tailnet>.ts.net:8444`.

If `:8443` is absent, show the exact returned `--https=8443` command, including
the observed Tailscale binary/socket and bound relay target. Explain that it
permits tailnet access, then wait for explicit approval before applying it.
Never construct the command from a remembered port. Run `even-ai route` again
after an approved apply, then `openclaw ocuclaw even-ai verify` for fresh readback.
An already-correct mapping is a no-op. If `:8443` belongs to another Primary Runtime, a foreign or
ambiguous service, a non-proxy web handler, or Funnel, stop rather than replace
it. Never use Funnel, widen the loopback bind, publish a public address, or run
a host-wide Serve reset.

#### Checkpoint 5 · Configure the Even Realities app

Even Realities app → Settings → Even AI settings → Agent Configuration (at the bottom) → Add Agent:

- **URL:** `https://<node>.<tailnet>.ts.net:8443/v1/chat/completions`
- **Token:** the Even AI password set in Checkpoint 2

⚠️ This is the OTHER door — the `https://…:8443/v1/chat/completions` URL, NOT the `wss://…:8444` relay address. Do not mix them up.

> **Common wrong addresses — do not mix these up:**
> OcuClaw app relay address: `wss://<node>.<tailnet>.ts.net:8444`
> Even AI agent URL: `https://<node>.<tailnet>.ts.net:8443/v1/chat/completions`
> Local relay backend: `127.0.0.1:<wsPort>`

#### Checkpoint 6 · Exercise a real glasses request

VERIFY: `even-ai verify` only establishes that the current route and activation
are available to test. Then the user selects the configured agent in the Even
app and makes a real Even AI request from the glasses (wake word or
button) and the reply comes from their OpenClaw session. Host configuration,
route shape, endpoint health, the enabled flag, or WebUI state alone is not
end-to-end success.

If not:
- `Agent Configuration` never appears in the app → the beta unlock hasn't propagated yet; re-check that hub.evenrealities.com was signed in with the correct account email, wait, force-close and reopen the Even Realities app, and try again
- Token mismatch or auth error → `ERR-EVENAI-TOKEN`
- Anything else → `ESCALATE`

---

### Step 12b · Easy bug reports   [OPTIONAL]

GOAL: let the user choose diagnostic access and phone handoff independently,
without changing working text chat or other integrations.

**Primary phone path, when advertised:** open **Settings > Display > debug section > Diagnostics**.
Choose Allow or Decline for one permission, review the named change, then confirm
**Apply this permission**. Cancellation changes nothing. Saved choice and Active
readback remain separate; reconnect and refresh after a supported reload. Report
review and its explicit Send action remain separate from both permissions.

**Advanced capability gate:** inspect `openclaw ocuclaw diagnostics status` only
when this installed bundle advertises the command. Unknown/offline is not
enabled. If unsupported, leave the controls unavailable and preserve the
ordinary support path; do not silently infer support from a version floor.

Explain the two choices separately in **Settings > Display > debug section > Diagnostics**:
diagnostic access (`externalDebugToolsEnabled`) permits capture/control, preview,
cache and local save on this host; phone handoff (`allowDebugUpload`) permits the
full bundle to reach the phone for review.
Handoff is not upload consent. The user still reviews the report and taps
**Send** for each upload. Each permission can be changed or revoked later.

<details><summary>Advanced: diagnostics commands</summary>

Run only the capability the user chose. These non-secret commands each change
one permission; `deny` revokes that permission:

```
openclaw ocuclaw diagnostics access allow
openclaw ocuclaw diagnostics handoff allow
openclaw ocuclaw diagnostics status
```

Follow the activation result and read status again. Both permissions are needed
for full-bundle phone fetch; one does not imply the other. Saved config alone
does not establish active access or a successful report upload. Host status is
configured readback with activation unknown; reconnect the phone and use the
fresh **Active: Allowed/Denied** rows for live relay permission evidence. On unknown host
policy, preserve pending state and the explicit host action. If they skip, record
the choice and stop; they can return to the same entry later without rerunning core setup.

</details>

---

### Step 13 · Extended handoff [OPTIONAL]

Only if the user requests an extended wrap or feedback after core completion,
return to SKILL.md and load `{baseDir}/references/wrap-feedback.md`. Record
optional choices as accepted, declined or deferred. This handoff is not a required
box and does not delay the successful Step 10 finish.
