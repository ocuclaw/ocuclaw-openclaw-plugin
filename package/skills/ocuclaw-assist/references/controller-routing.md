# Controller routing and checkpoint reads

**Guide version:** 2026-10-28 (1.0.60)

Read this on the phase-by-phase lane (no `next`), after a failed or missing
controller, and whenever a step sends you to the controller facts: the journey
read, the capability-first controller table, the two typed host mutations and
the secret presence probes. SKILL.md keeps the guardrails (rules 1–9) and the
router; they apply here unchanged. The opening move, checklist, lane card and
state assessment are in `{baseDir}/references/guided-setup.md`.

## Journey read

Read `overview` through the currently callable controller. If its
`capabilities.readOperations` includes `journey`, call that read-only operation
(typed `ocuclaw_setup` on the callable lane; `openclaw ocuclaw journey` on the
policy-hidden CLI lane). Explain `durableFacts`, `currentHealth`, `firstUse`, and
`nextCheckpoint.action` separately. Re-read after restart or a new turn: receipts
are observations, not inputs that can authorize skipping a checkpoint. Never reuse
a receipt from another `installation.id`; null identity means ownership is unknown.

### No shell probes on the controller lane

On some hosts (OpenClaw with the Codex harness) a shell command that is not a
plain file read can ask the user for an exec approval, and the approval also
shows on their glasses. None of these is a consent step the user
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

When `next` answers, SKILL.md's **Chat setup** covers managed hosts too: `next`
already knows the host, and cloudways.md is only for its stuck cases and the
terminal fallback. Without `next`:
the first command of any new or resumed setup is that journey read, before Step 1.
Its top-level `host` block says what kind of machine this is. When `host.managed`
is `cloudways`, read `references/cloudways.md` BEFORE Step 1 and follow it for the
whole setup. That host has no system Tailscale and cannot have one, so do not look
for a `tailscale` binary. The answer to "does Cloudways support it?" is already
no, so you don't need the user to tell you.
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
separately installed copy that OpenClaw prefers over the plugin's. OpenClaw
does this quietly and never tells the user, so the user stays on whatever guide
that copy carries until you point it out.

When `shadowed` is `true`, say so in plain words before Step 1, name both guide
versions, and hand the user the block's `nextAction` to run in their own
terminal; then re-read `journey` and continue. The removal depends on the host:
`openclaw skills remove ocuclaw-assist` where that verb exists, and where it
does not, delete the folder holding the SKILL.md that
`openclaw skills info ocuclaw-assist --json` reports as `filePath`. Check
`openclaw skills --help` before naming one. It is a named
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
failure. A `plugin.capabilityConsent.status` of `required` (finding
`plugin.capability-consent-required`, usual after an OpenClaw upgrade) means
OpenClaw wants the owner to approve OcuClaw's declared capabilities again:
give the user the one command `openclaw plugins enable ocuclaw
--accept-capabilities` and do not edit plugin config for it. Do not
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
| Current inventory omits `ocuclaw_setup`; runtime inspection says `Status: loaded`; `openclaw ocuclaw overview` works | controller-policy-hidden | Use the matching deterministic CLI: `openclaw ocuclaw overview`, `openclaw ocuclaw doctor --json`, `openclaw ocuclaw plan`, or `openclaw ocuclaw verify`. Doctor prints a plain checklist for people unless given `--json`, and exits 1 when a finding blocks setup: read the JSON either way. An older plugin that refuses `--json` already prints JSON without it. Diagnose policy only when the user wants the model-facing tool exposed. |
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
