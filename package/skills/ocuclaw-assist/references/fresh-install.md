# OcuClaw fresh install — Steps 1–13

**Guide version:** 2026-07-17 (1.0.41)

Return to the skill's SKILL.md for the guardrails, lane card, checklist, and
router at any time.

**FINISH CONTRACT — this binds your final messages.** A successful Step-10
test is NOT the finish, and neither is Step 10b's push. Step 10b — the Live
UI push, the reverse-direction show-them moment — runs IMMEDIATELY after
Step 10's reply is confirmed: it is a required step, never an offer and
never deferred to another conversation. Then, in the same message as its
verify, OFFER each optional step with a one-line what-it-does and
"optional — you can also ask me to add it any time later": Step 11 voice
input via Soniox (talk to the agent from the glasses), Step 12 Even AI
integration (the glasses' wake word answered by this OpenClaw), Step 12b
easy bug reports (two diagnostic permissions so a future problem is a
two-tap report). Merely listing them as
"things you can add later" is not an offer — ask for a yes/skip on each.
Then, whatever they choose, run Step 13: load
`{baseDir}/references/wrap-feedback.md` and deliver its ordered finish
(summary → two addresses → checklist self-audit → security-audit offer →
WRAP closing note → FEEDBACK bundle). A closing message without the offers
and the wrap is an incomplete setup, not a finish.

## Setup steps

### Step 1 · Prerequisites

GOAL: confirm the hardware is ready and the host meets the minimum version requirement.

CHECK — ask this question (copy it; do not paraphrase it into the fallback
confirmation below): "Are your glasses currently paired to your Even Realities
app, and is OcuClaw installed from the Even Hub store on your phone?"
Glasses not paired → stop: finish Even Realities onboarding first. OcuClaw
client not installed yet is fine — Step 9 walks through installing it; in that
case (and only then) confirm the Even Realities app and Even Hub open on the
phone. "Does Even Hub open?" is the not-installed fallback, never the Step-1
question itself.

Set expectations: setup takes about 15 minutes; they'll need their phone, a terminal on this machine, and will create 1–2 passwords.

Controller-lane shortcut (SKILL.md controller exclusivity): if the state
assessment already returned a successful `overview` whose `compatibility`
reports `hostOpenClaw` with `status: compatible`, that satisfies this version
check — record the controller evidence and skip the command below. Run it only
when no controller lane is live or the controller call failed.

```bash
openclaw --version
```

VERIFY: version is ≥ 2026.6.9.   ·   If not → `HOST-OLD`.   ·   `openclaw: command not found` → OpenClaw itself isn't installed — installing OpenClaw is outside this skill: point the user at OpenClaw's official install docs, then re-enter here once `openclaw --version` works.   ·   `Unsafe fallback OpenClaw temp dir` → load troubleshooting and follow its exact-error host note; do not continue OcuClaw setup until this command succeeds.

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

**Stable (default):**
```bash
openclaw plugins install clawhub:ocuclaw
```

The install prints a notice like `ClawHub package "ocuclaw" is community; review
source and verification before enabling.` — that is a standard advisory for
community-channel packages (the release is security-scanned and source-linked),
**not an error**; say so and continue.

**Beta (only if the user confirmed they are a beta-Discord tester — betas ship on npm, not ClawHub):**
```bash
openclaw plugins install npm:ocuclaw@beta
```

(To install a pinned beta build instead: `openclaw plugins install npm:ocuclaw@<spec>`.)

The prefix pins the install source: `clawhub:` is the stable lane (ClawHub —
scanned, source-linked releases), `npm:` carries the beta channel and serves as
the stable fallback. If the OpenClaw build rejects the `clawhub:` prefix as an
unknown package (older hosts), install stable from npm instead:
`openclaw plugins install npm:ocuclaw`.

VERIFY: the install command exits successfully, then run:
```bash
openclaw plugins inspect ocuclaw --json
```
Pass only when the top-level `install` object is non-null and records the
ClawHub/npm source selected above. `plugins list` visibility or extracted files
without managed install metadata do not pass.

If an earlier failed attempt left discovered files with `install: null`, rerun
the selected install command once with `--force`, then inspect again. If managed
provenance is still absent → `ESCALATE`.   ·   If the install fails because the
host is too old → `HOST-OLD`; for any other failure → `ESCALATE`.

---

### Step 3 · Relay token   [REQUIRED · the user runs this, never you]

GOAL: the user creates a relay password and sets it themselves so it never passes through you. Installation is safe without it: the plugin remains unconfigured and does not open a relay listener. The token is required before Step 5 can verify a running relay.

Skip if: relayToken probe = 1 **and** the user still knows their token → go to Step 4. If probe = 1 but token forgotten → they set a new one with the same command below.

🔑 USER ACTION REQUIRED — you run this, I never see it.

Run this in your own terminal, replacing ONLY the quoted `YOUR-RELAY-TOKEN` placeholder — swap out that whole placeholder text, keeping the surrounding quotes — with the password you choose (no `read`, no pipe, no extra flags). The value must be a real, non-empty password — you will re-type it on your phone in Step 9, so make it typeable:

```
openclaw config set plugins.entries.ocuclaw.config.relayToken "YOUR-RELAY-TOKEN"
```

Then tell me "done." I will not continue until the relayToken probe returns 1.

⚠️ If the command rejects the value as empty or shorter than the minimum, no usable token was saved — STOP and have the user re-run it with a visible, non-empty value. Never set it empty, never proceed.

VERIFY: relayToken probe = 1.   ·   Still failing → `TERM-HELP`.

---

### Step 4 · Enable + agent tool access

GOAL: enable the plugin and ensure the agent can call OcuClaw's glasses-display tools.

Skip if: `openclaw plugins list` shows `ocuclaw` already enabled **and** the tool-access VERIFY below already passes → go to Step 5.

CHECKPOINT (rule 4) — **your pause message IS this checkpoint.** It must
contain, in itself, in this order: an OPENING sentence with the just-finished
phase's outcome — arriving here from Step 3 that sentence confirms the token
landed (it now reads present; you checked presence only and never saw the
value), because the user just ran that command and this message is where they
learn it worked — then one plain-words sentence of what Step 4 changes, a
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

**Verify agent tool access** (read-only — announce and run, rule 4). From
plugin 1.3.4 builds carrying this guide, OcuClaw's tools — including the
`ocuclaw_setup` controller — are exposed by default once the plugin is
enabled: no `tools.allow`/`tools.alsoAllow` entry is needed. Read the root
policy as one configuration clue; after restart, SKILL.md's **Capability-first
controller routing** table is the single authority for effective policy and
controller-lane selection:
```bash
openclaw config get tools
```
("Config path not found" is expected when no policy is set — the command exits nonzero then; record it: it means default exposure applies and there is nothing to change.)

Only a restrictive policy in that output needs action (this is the mutating
exception — checkpoint it before running anything):
- `deny` contains `"ocuclaw"` or `"group:plugins"` → STOP and ask the user — deny wins over every allow, and removing a deny entry is their call.
- `allow` exists, is non-empty, and lacks both `"ocuclaw"` and `"group:plugins"` → a restrictive allowlist is hiding the tools: merge `"ocuclaw"` into `tools.allow`, preserving all existing entries. Do NOT add an `alsoAllow` beside it — config validation rejects both set in the same scope.
- Anything else (no policy, `alsoAllow`-only lists, or an `allow` that already admits `"ocuclaw"`/`"group:plugins"`) → nothing to do.

Takes effect through the reload/restart verification in Step 5.

PRE-LOAD VERIFY: `openclaw plugins list` shows `ocuclaw` enabled. The root
policy either has no restrictive entry (default exposure applies) or admits
`"ocuclaw"`/`"group:plugins"`; this is not yet proof of effective
current-session callability. A configuration rejection usually means the token
didn't save → back to Step 3. Step 5 performs the authoritative inventory
check after load.

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
  `localhost:<port>` from the same container or microVM.
- **Container: yes (no-systemd), network mode or ingress unknown** → keep the
  loopback bind. Do not infer a bridge from a container marker, missing systemd,
  the plugin's topology notice, or the absence of a client before the user has
  actually tapped Connect. Record the unknown; a real Step 9 connection failure
  routes to `DOCKER-RELAY-UNREACHABLE` for host-side inspection.
- **Container: yes, network mode = bridge (or named network), AND the ingress
  proxy is confirmed outside this network namespace**:
  keep loopback during setup and record `possible bridge crossing` in the lane
  card. Do not widen the listener pre-emptively. Only if the user's real Step 9
  Connect attempt fails may you enter `DOCKER-RELAY-UNREACHABLE`; that lane
  makes the host publish loopback-safe before changing `wsBind`.

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
If the gateway is down → `GW-DOWN`. If the safe restart fails because OpenClaw
cannot cross the service/supervisor boundary → `GW-RESTART-NOSVC`. Never retry
the same restart without a new finding.

Then apply SKILL.md's **Capability-first controller routing** table. This step
is complete only after that table identifies the controller or standalone lane;
run its typed or deterministic `verify` only when that lane says the operation
exists. Older loaded versions without controller surfaces stay on the table's
standalone `controller-unavailable-version` lane.

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

GOAL: install Tailscale — only devices on the user's tailnet can reach the relay; the phone can reach this machine from anywhere.

**Tailscale location follows the lane card.** For a confirmed bridge +
outside-proxy lane, every `tailscale` command in Steps 6 and 7 goes to the
user's host terminal. If Tailscale Serve runs in the relay's same network
namespace (including a Sprite/microVM), run the commands there and keep the
relay on loopback. An unknown no-systemd lane does not prove either topology;
preserve a working local `tailscale status`, otherwise establish the proxy
location before changing `wsBind`.

Skip if: `tailscale status` already shows signed in → go to Step 7. Read
that status UNCAPPED — no `head -N` or other line caps, here or anywhere:
device rows hidden below a cap poison Step 8's phone enumeration. For a
compact signed-in check use `tailscale ip -4` instead.

**Install (per OS):**

> **Why root:** Tailscale's daemon manages network interfaces, so install, `tailscale up`, and `tailscale serve` need elevation on Linux — standard Tailscale practice, scoped to exactly those commands. If the lane card says "user runs elevated," every `sudo` command in Steps 6–7 goes to the user.

Linux (needs root — if your lane card says "user runs elevated," hand this to the user):
```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

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

### Step 7 · Serve routes (two doors into the relay)

GOAL: expose the relay on the tailnet. Two routes, one purpose each:

| Port | Type | Used by |
|---|---|---|
| `:8444` | direct TCP (TLS-terminated) | the OcuClaw app (Step 9) |
| `:8443` | HTTPS proxy | Even AI's agent endpoint (Step 12) |

**Resolve `<port>`** from your lane card (`Relay wsPort`). If it is blank, re-read it now: `openclaw config get plugins.entries.ocuclaw.config.wsPort`. On plugin builds carrying this guide a completed fresh install reads `47800` (the plugin wrote it at first relay start); `9000` on a pre-existing install is its preserved working baseline — the routes below then target it. If the value still looks undecided, re-run Step 5a's read and Step 5c's VERIFY first, then return here.

Skip if: `tailscale serve status` already shows both routes each proxying to `localhost:<port>` → go to Step 8. (If they proxy to a different port, re-run the commands below with the current `<port>`; if the old `tcp://…:8443` scheme appears **and the app doesn't currently connect** → `MIGRATE-8443` — if that old shape still works end-to-end, leave it: working baseline wins.)

CHECKPOINT (rule 4) — reading `tailscale serve status` needs no OK, but the
route change does: before running anything mutating below, tell the user in
plain words what Step 7 changes and why, **naming both commands with the real
`<port>` substituted** — e.g. "these two commands publish the relay on your
private tailnet: `sudo tailscale serve --bg --tls-terminated-tcp=8444
tcp://localhost:47800` (the phone app's door) and `sudo tailscale serve --bg
--https=8443 http://localhost:47800` (the optional Even AI door); nothing
becomes public — tailnet devices only." State whether routes already exist and
what each currently points at. If the lane card says the user runs elevated,
say these go to their terminal. Then get an OK. **Your pause message IS this
checkpoint** — if it pauses for an OK and shows no command blocks, it is
malformed: do not send it; send this checkpoint's content instead (rule 4's
output gate).

**Run both commands for your OS** (substitute `<port>` from the lane card in both; on the macOS App Store build, use the lane card's `Tailscale CLI` path in place of `tailscale`):

Linux / macOS:
```bash
sudo tailscale serve --bg --tls-terminated-tcp=8444 tcp://localhost:<port>
sudo tailscale serve --bg --https=8443 http://localhost:<port>
```

Windows (Administrator PowerShell):
```powershell
tailscale serve --bg --tls-terminated-tcp=8444 tcp://localhost:<port>
tailscale serve --bg --https=8443 http://localhost:<port>
```

VERIFY: `tailscale serve status` shows both blocks each proxying to `localhost:<port>`:
```
|-- tcp://<node>.<tailnet>.ts.net:8444 (TLS terminated, tailnet only)
|--> tcp://localhost:<port>

https://<node>.<tailnet>.ts.net:8443 (tailnet only)
|-- / proxy http://localhost:<port>
```
If exactly one expected route is missing or still points at the wrong local backend, re-run just that route's command once more, then check `tailscale serve status` again — a route can need a second application after a port change. Still wrong after that single retry → `TS-PORT-CLAIMED` or `TS-SERVE-UNSUPPORTED` (or ESCALATE), never further blind re-runs.

`--tls-terminated-tcp` requires **HTTPS Certificates** enabled for this tailnet at `login.tailscale.com/admin/dns`, alongside MagicDNS. Without them Tailscale accepts the route and every connection through it then fails; on the Hermes side the symptom is `probe_failed` plus `relay_verifier_protocol_error` on a route classified `ready`, and `tailscale cert --cert-file /dev/null --key-file /dev/null <node>.<tailnet>.ts.net` answers `your Tailscale account does not support getting TLS certs`. Fix is two clicks in the admin console under DNS, then re-verify.

Note the machine name `<node>.<tailnet>.ts.net` from that output — you'll use it in Step 9.   ·   Port already claimed → `TS-PORT-CLAIMED`; unknown command or flag → `TS-SERVE-UNSUPPORTED`.

---

### Step 8 · Phone joins the tailnet

GOAL: the user's phone becomes a trusted member of the same private tailnet as this machine.

Ask the user to: install Tailscale on their phone (App Store / Google Play), sign in with the **same account**, and leave the VPN toggle on. If their tailnet requires device approval, they approve it at `login.tailscale.com/admin/machines`.

VERIFY: `tailscale status` on this machine shows the phone, **and** the phone's Tailscale app shows "Connected." If several devices appear in `tailscale status`, enumerate candidates from the FULL status output — never a line-capped or otherwise truncated read, whether from this step or an earlier probe: a device below the cut silently vanishes from the candidate list; a compact read filters to phone-class rows (the OS column: iOS/Android), it never truncates. Order the candidates by the online state that output already shows: lead with the online devices, and mention an offline device only as a fallback — never present an offline device as the likely phone while an online phone-class device (iOS/Android in that output) is present. Then ask the user which is their phone — trust the phone app's own "Connected" state as the source of truth.   ·   If not → `PHONE-NO-REACH`.

---

### Step 9 · OcuClaw app

GOAL: the user installs and connects the OcuClaw phone app to the relay on this machine.

Ask the user to: open the Even Realities app → Even Hub App Store → install and open OcuClaw → go to **Relay Server** and enter:

- **Address:** `wss://<node>.<tailnet>.ts.net:8444` (use the exact machine name from Step 7)

  ⚠️ The address must start with `wss://` (not `ws://`), and use port `:8444` — not `:8443` (that is the Even AI door), and not the relay's local `wsPort` (e.g. `47800`), which is loopback-only and the phone can never reach it.

  > **Common wrong addresses — do not mix these up:**
  > OcuClaw app relay address: `wss://<node>.<tailnet>.ts.net:8444`
  > Even AI agent URL: `https://<node>.<tailnet>.ts.net:8443/v1/chat/completions`
  > Local relay backend: `localhost:<wsPort>`

- **Token:** the relay password the user created in Step 3

Tap **Connect**.

VERIFY: the app shows "Connected" and OpenClaw Status fills in (session, model). Host-side confirmation: `openclaw logs` shows `[ocuclaw] relay client connected …` from the moment they tapped Connect. Host-side connection evidence is exactly two signals: that relay connect log line, and a typed verify's `runtime.appClientConnected` — session listings are neither: they are scope-restricted (`visibility=tree`) and cannot see the phone's `ocuclaw:` session from this lane, so a session count proves nothing about the connection in either direction.   ·   The app connects but then shows a version screen saying the **app is too old** for the installed plugin → `CLIENT-TOO-OLD` (troubleshooting).   ·   Anything else → `APP-CONNECT-FAIL`.

---

### Step 10 · End-to-end check

GOAL: confirm the full chain works — message sent, reply received, glasses display it.

Ask the user to: put on their glasses, then send "hello" from the app's Send Message box and read the reply on the glasses. In the SAME ask, give the Step-10b heads-up: right after they confirm the reply, you will push a test screen to the glasses — when it appears, they should double-tap it, and you'll confirm the moment you feel it. (This primes the required Step 10b so the double-tap instruction reaches them even when your next turn opens with the render call.)

The test must originate from the phone app — never substitute your own
glasses-display tools for the user's app send; only the app-originated
message proves the full phone → OpenClaw → glasses chain. (Step 10b's push
runs right after this test passes, never instead of it.)

VERIFY: reply is visible on the glasses. Core setup is DONE — say so, warmly — **and keep going: setup is not finished at Step 10.** The FINISH CONTRACT at the top of this file binds your next messages: run Step 10b now, then offer Steps 11/12/12b, then Step 13's wrap. The finish lives at Step 13's handoff, never here.

If not:
- App reported a send failure → `APP-CONNECT-FAIL`
- Message sent but no reply → `GW-DOWN`
- Reply visible in the app but glasses are dark → wake the glasses (double-tap), reopen OcuClaw inside Even Hub, and retry

---

### Step 10b · Live UI push — show them the reverse direction   [REQUIRED]

GOAL: the landable moment — right after their phone-originated reply lands
on the glasses, you push a Live UI test screen back the other way. It runs
at this exact point in every fresh install. It is ADDITIVE: it never
replaces or stands in for Step 10's app-originated test, which must already
have passed.

Announce and run in the same turn — one sentence, then the call. This phase
changes no configuration, so no OK is needed (rule 4 read-only shape); if
the user asks to skip it, honor that as `[skipped]`.

The double-tap instruction must reach the user BEFORE the render call runs.
Preferred carrier: the Step-10 heads-up (delivered with the hello ask — check
it actually went out). If it was not delivered there, say now, before the
call: "Now the reverse direction — I'm pushing a test screen to your glasses.
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

Ask: "Would you like to set up voice input? You'll speak to me from the glasses and I'll transcribe it. It takes about 5 minutes and needs a Soniox account (free sign-up, requires a little credit for transcription). Say yes to continue or skip to move on."

If they want it:

1. Sign up at **soniox.com**, add a payment method, load a small credit balance.
2. In the Soniox dashboard, create an API key.

🔑 USER ACTION REQUIRED — you run this, I never see it.
Run this in your own terminal, replacing ONLY the quoted `YOUR-SONIOX-API-KEY` placeholder — the whole placeholder text, quotes kept — with your Soniox API key (no `read`, no pipe, no extra flags):

```
openclaw config set plugins.entries.ocuclaw.config.sonioxApiKey "YOUR-SONIOX-API-KEY"
```

Then tell me "done." I will not continue until the sonioxApiKey probe returns 1.

Once the probe returns 1, follow rule 5: allow config reload and verify the
runtime; only if the live runtime remains stale request one
`openclaw gateway restart --safe`. If the user has already said yes to Even AI
(Step 12), let its config write cover both keys before verifying.

VERIFY (after reload or the one safe restart — never test voice against stale config): the user taps the microphone / listen button on their glasses and speaks a short phrase — it transcribes and appears as their message.   ·   If voice never activates or transcription fails → `ESCALATE` (note that voice input was the failing step).

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

🔑 USER ACTION REQUIRED — you run this, I never see it. Run this in your own
terminal, replacing ONLY the quoted `YOUR-EVEN-AI-TOKEN` placeholder — the
whole placeholder text, quotes kept — with the Even AI password (no `read`, no
pipe, no extra flags):

```
openclaw config set plugins.entries.ocuclaw.config.evenAiToken "YOUR-EVEN-AI-TOKEN"
```

Then tell me "done." I will not continue until the presence-only evenAiToken
probe returns 1. Never ask the user to paste or read the value into chat.

#### Checkpoint 3 · Enable Even AI on OpenClaw

Once the probe returns 1, run:

```
openclaw config set plugins.entries.ocuclaw.config.evenAiEnabled true --strict-json
```

Follow rule 5: allow config reload and verify the runtime; only if the live
runtime remains stale request one `openclaw gateway restart --safe`.

#### Checkpoint 4 · Create and verify the private Even-AI route

Read the selected OpenClaw Runtime Bundle's settled relay port, tailnet DNS
name, and current Serve state:

```bash
openclaw config get plugins.entries.ocuclaw.config.wsPort
tailscale status --json
tailscale serve status
```

The **Even AI agent URL** is
`https://<node>.<tailnet>.ts.net:8443/v1/chat/completions`. It is separate from
the **OcuClaw app relay address** at `wss://<node>.<tailnet>.ts.net:8444`.

If `:8443` is absent, show and explain one exact command with `<port>` replaced
by the readback, then wait for explicit approval before running it:

```bash
tailscale serve --bg --https=8443 http://localhost:<port>
```

Read `tailscale serve status` again after an approved apply. An already-correct
mapping is a no-op. If `:8443` belongs to another Primary Runtime, a foreign or
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
> Local relay backend: `localhost:<wsPort>`

#### Checkpoint 6 · Exercise a real glasses request

VERIFY: the user makes a real Even AI request from the glasses (wake word or
button) and the reply comes from their OpenClaw session. Host configuration,
route shape, endpoint health, the enabled flag, or WebUI state alone is not
end-to-end success.

If not:
- `Agent Configuration` never appears in the app → the beta unlock hasn't propagated yet; re-check that hub.evenrealities.com was signed in with the correct account email, wait, force-close and reopen the Even Realities app, and try again
- Token mismatch or auth error → `ERR-EVENAI-TOKEN`
- Anything else → `ESCALATE`

---

### Step 12b · Easy bug reports   [OPTIONAL]

GOAL: pre-enable the two explicit diagnostic permissions so a future problem is a two-tap bug report with real diagnostics, instead of a fresh troubleshooting session.

**Version gate first:** this lane needs plugin ≥ 1.3 — check `Version:` from `openclaw plugins inspect ocuclaw`. Below 1.3, skip this step silently (bug reports go via the Discord paste route in troubleshooting).

Ask: "One last optional thing — want me to enable easy bug reports? External
debug access permits bounded diagnostic capture, preview, cache, and local save
on this OpenClaw host. Separate upload consent permits full-bundle handoff to
your phone, but nothing uploads until you review the report and tap **Send**.
You can ask me to turn either permission off (or on) anytime later."

If they want the complete phone-upload flow, both keys are non-secret and you
run them. `externalDebugToolsEnabled` permits capture, preview, cache, and local
save. `allowDebugUpload` permits full-bundle handoff to the phone for the
user-initiated upload and requires external debug access too:

```
openclaw config set plugins.entries.ocuclaw.config.externalDebugToolsEnabled true --strict-json
openclaw config set plugins.entries.ocuclaw.config.allowDebugUpload true --strict-json
```

Run them one at a time (rule 5): a parallel batch fails the second write with
`ConfigMutationConflictError`.

Reload handling: let one reload cover any pending Step 11/12 keys too. Follow
rule 5 and request one `openclaw gateway restart --safe` only if the live
runtime remains stale after verification.

VERIFY: both keys read back `true` via `config get`. Nothing to test in the app now — the Send flow only matters when a problem exists.

If they decline: fine — the troubleshooting ESCALATE path enables the same thing on demand later. Note the decline and move on.

---

### Step 13 · Handoff

Return to the skill's SKILL.md, then load
`{baseDir}/references/wrap-feedback.md` once every required box except the
wrap box is ticked and each optional step (Soniox, Even AI, easy bug reports)
was offered — accepted, declined, or version-gated. Delivering that file's
ordered finish is what ticks the final required wrap box; the session does not
end before it.
