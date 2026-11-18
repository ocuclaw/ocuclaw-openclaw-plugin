# Guided setup without `next`

**Guide version:** 2026-10-28 (1.0.60)

Read this when `ocuclaw_setup` does not offer `next` (an older plugin, a
policy-hidden tool, or a plugin that is not loaded yet), or when **Chat setup**
in SKILL.md sends you here. It holds the opening move, the setup checklist, the
lane card and the state assessment for the phase-by-phase lane. SKILL.md keeps
the guardrails (rules 1–9) and the router; they apply here unchanged. The
controller facts these steps read (journey, the capability-first table, typed
mutations, secret probes) are in `{baseDir}/references/controller-routing.md`.

## Resume, direct pairing and the opening move

**Resume first.** When continuing setup, retain the recorded explanation preference
and G2 availability instead of repeating calibration or hardware questions. Re-read
the owning installation using the capability routing in controller-routing.md, explain the first
incomplete checkpoint, and enter its existing guide step. Host conversation owns
setup; the phone conversation supplies only the test message and wearer interaction.
Never run the setup controller from the phone test conversation.

**Direct pairing:** `journey.capabilities.pairing: available` names the user's
own interactive `openclaw ocuclaw pair` terminal, not a tool approval surface.
Hand off once and resume the same installation's journey afterwards. Follow
`references/fresh-install.md` Step 9 for the phone code, manual pairing, four-word comparison, refusal
and retry. Never execute/capture the ceremony or request its private contents in
chat. Preserve existing credentials and phones; approval is distinct from an
observed authenticated phone connection and from first-use/G2 proof.

**Opening move (new setup only).** Skip it when `next` answers: SKILL.md's **Chat setup**
has its own one-line start. If explanation preference is already established,
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

## Optional phone setup and activation scope

**Optional phone setup:** on a matching installed bundle advertising the private
setup interface, lead with Home's Optional setup card (buttons **Set up voice**,
**Set up Even AI** and **Set up Jev**) and its dedicated pages; after dismissal, re-entry is
**Settings > Voice**, **Settings > Even AI** and Help > Optional setup > **Jev**, and diagnostics live
at **Settings > Display > debug section > Diagnostics**. The card has no other buttons, and Settings has no
separate optional-setup row.
Native replacement, **Save & continue**,
activation and diagnostics confirmation controls own consent for their named
action. Do not add a shell-command approval to that phone flow. On supported
OpenClaw hot-reload hosts, **Save & continue** requests reload; refresh active readback
after reconnecting. Saved or reloaded is not tested. Route review remains
print-only until separately approved. The command checkpoints below apply to
advanced Desktop/CLI host actions; older bundles retain their supported fallback.
Candidate code does not establish public bundle availability.

**Optional activation scope:** Steps 11/12/12b use their capability commands and
observed activation results instead of the generic restart path in rule 5.
Supported hot/hybrid hosts may reload; unknown/off/restart policy remains pending
for explicit host action. Do not restart Cloudways for optional setup.

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
- [ ] OpenClaw ≥ 2026.9.5 + G2 glasses paired        (Step 1)
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
- [ ] Voice input: told it works on the phone          (Step 11)
- [ ] Even AI integration                              (Step 12)
- [ ] Jev, a faster, smarter OcuClaw                   (Step 12a)
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

Read its labeled lines straight into the card (no `container=` line → Container: no). On Windows use the per-row hints above. The probe's elevation check changes nothing: it runs the no-op `true` to check for passwordless sudo, and fails at once instead of prompting for a password. `agent can sudo` does not skip any checkpoint: each elevated command still waits for the user's OK on its phase (rule 4). Never probe elevation with a bare `sudo -n true` — its nonzero exit paints an error banner in the chat for what is a normal, expected answer.

**Controller lane: fill the card from typed results, with no probe.** When `ocuclaw_setup` is callable, do not run the probe above or any half of it (see "No shell probes on the controller lane" in controller-routing.md). The journey's `environment` block (the same block `overview` reports) is the source of truth for three rows (OS, Container, systemd): it reads the GATEWAY process's own filesystem view. Elevation reads `user runs elevated (controller lane, not probed)`: the plugin is installed, and every elevated command left in this guide (Tailscale install, `up`, `serve`) goes to the user's own terminal. `Relay wsPort` comes from the typed relay port, and `Tailscale CLI` from the journey's route read (`serve_cli_absent` → not on the gateway's PATH).

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
| A | OpenClaw version ≥ 2026.9.5 | `openclaw --version` |
| B | Plugin installed with managed provenance + enabled | Controller lane: `overview` reports `plugin.install.recorded: true` (same proof). Otherwise `openclaw plugins inspect ocuclaw --json` has non-null managed install metadata · `openclaw plugins list` shows enabled |
| C | relayToken set | relayToken probe (see the probes in controller-routing.md) |
| D | Gateway up, plugin loaded | `openclaw gateway status` · `openclaw plugins inspect ocuclaw` shows `Status: loaded` |
| E | Tailscale installed + signed in | `tailscale status` |
| F | Private phone route reaches the relay's `wsPort`; ownership verified | `tailscale serve status` (compare the phone backend `127.0.0.1:<port>` to `openclaw config get plugins.entries.ocuclaw.config.wsPort`; preserve foreign or ambiguous routes). Even AI is not checked unless requested. |
| G | Required OcuClaw tool callable in this conversation | Actual current-session inventory, or `/tools verbose` in this same conversation. For controller routing, pass only when it contains `ocuclaw_setup`; classify a loaded-but-omitted tool as `controller-policy-hidden`. |

### Routing — enter at the FIRST matching row

**A working existing setup wins over the preferred default.** If the app connects and a quick Step 10 end-to-end test passes, do not migrate `wsPort` (even `9000`), Serve routes, or an old address shape just because they differ from the modern defaults — prove the setup is broken before changing ports or routes. Migrate old layouts only when setup is broken, this is a fresh install, a route points at the wrong backend, or the user explicitly asks.

| Finding | Enter |
|---|---|
| A: version below 2026.9.5, or G2 hardware unconfirmed | Step 1 |
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
