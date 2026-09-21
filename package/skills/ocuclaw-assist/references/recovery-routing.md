# Availability and focused recovery

**Guide version:** 2026-09-19 (1.0.56)

Read on fresh installation, missing/failed controller, version mismatch or recovery.
Use SKILL.md's capability-first controller routing and existing step procedures.
Keep the same OpenClaw profile/wrapper, installation, backend and phone session.

## Public packages versus prepared instructions

Read-only registry snapshot, September 15, 2026:

| Surface | Public identity | What it establishes |
|---|---|---|
| npm `latest` / ClawHub `latest` | 1.3.7 | Default installation; manual connection, not the new terminal journey. |
| npm `beta` / ClawHub `beta` | 2.0.6 | Opt-in beta; bundled guide 1.0.43, journey diagnosis, no production terminal pairing or durable first-use completion. |
| Retired standalone ClawHub assistant | 1.0.6, final pointer 1.0.7 | Withdrawn. Anyone still carrying it is pinned to a July guide that no plugin release can fix. |
| This canonical/bundled candidate | guide 1.0.48 | Prepared instructions; not evidence of publication. |

Refresh the selected channel with `npm view ocuclaw dist-tags --json` and
`clawhub package inspect ocuclaw --json`. The assistant has no channel of its
own: it ships inside the plugin and moves with it, so an assistant version is
never a separate thing to refresh or reinstall.

A separately installed copy of this assistant still wins over the plugin's,
silently. `openclaw skills info ocuclaw-assist --json` reports the active copy
with its `source`; `openclaw-extra` is the bundled one. Any other source is a
shadow: name it, have the user clear it, and continue. The removal is
host-version dependent. `openclaw skills remove ocuclaw-assist` works where that
verb exists; OpenClaw 2026.7.x has no `skills remove`, so there the user deletes
the folder holding the `filePath` the listing reported. Check
`openclaw skills --help` before naming one. The journey read's `assistantSkill`
block reports the same condition with its own `nextAction`.

The recommended candidate host is OpenClaw **2026.9.4**, whose npm metadata
requires Node **>=24.16.0 <25 || >=26.1.0**. The published bundle host floor
remains **>=2026.6.9**, with package Node metadata **>=20**; the host's stricter
Node requirement still applies. These are separate facts. This guide does not
raise manifests or authorize a live host upgrade.

Terminal `pair` and `first-use` exist in prepared source following the pairing
and first-use merges. Neither public channel above supplies them. Use them only
when the installed controller advertises `pairing: available` and
`firstUse: direct-terminal`, respectively. No candidate package version/channel
is selected here. Use only an explicitly approved, obtainable compatible
artifact; do not tell default-package users to run unavailable commands.

The source client is 2.0.6 and requires bundle >=2.0.2; public beta 2.0.6
requires client >=2.0.2, while stable 1.3.7 requires client >=1.3.4.
Check BOTH actual component floors and the user's Even Hub access before a
transition. A GitHub draft release, source tag or EHPK handoff does not prove
Even Hub availability. If no compatible pair can be obtained, stop the affected
transition and preserve the working baseline. The 1.3.7 migration and obtainable
rollback/forward-recovery proof are separate release work, not established here.

## Installation consent and recorded source

Read this section before any fresh install, source change, archive replacement or
rollback. Keep the owning profile and inspect the recorded install source first.
Choose an approved obtainable target; for a local archive, record its SHA-256.
Review that target's source and requested capabilities with the user. Consent
applies to that target only, not future packages or changed capabilities.

Check the selected host's command contract:

```bash
openclaw plugins install --help
```

On OpenClaw 2026.9.4, after source and capability consent, use this form; replace
`<approved-source>` with the selected `clawhub:ocuclaw@<version>`,
`npm:ocuclaw@<version>` or approved local archive path:

```bash
openclaw plugins install <approved-source> --force --accept-capabilities
```

`--force` alone does not grant capability consent; `--allow-unsafe` is not a
consent substitute. A source advisory can be informational, but a consent refusal
is a failed install: do not continue to enable or claim installation succeeded.
Older hosts without `--accept-capabilities` use their documented installation
contract; do not add an unsupported flag or treat that fallback as proof of the
declared host floor. Do not add installation flags to `plugins update`: inspect
`openclaw plugins update --help` if its recorded-source update is refused.

A prepublication archive replacement is a local test equivalent, not a published
channel update. Keep its exact hash and recorded `archive` source in the receipt;
do not replace the public artifact or claim that users can obtain the candidate.

## Interrupted upgrade, retry and compatible recovery

Before changing either component, record both versions and compatibility floors,
the installed source and the recoverable compatible pair. Keep a private recovery
checkpoint. Compare credentials and connection settings without printing their
values; preserve backend/session affinity, unrelated configuration and the other
Runtime Bundle.

If installation fails or the process stops between client and bundle changes,
inspect the actual installed version, managed source and live runtime again.
Resume only the deficient component using the approved target and consent above.
Do not assume a failed command left the old files intact, uninstall as a generic
retry, reset credentials or send an established user through fresh-user setup.
A short interruption is possible; do not promise uninterrupted service or lower
compatibility floors to restore connectivity.

Technical rollback requires a compatible client/bundle pair. Retained compiled
bytes or a client rebuilt from a source tag can test that pair, but do not prove
the user can obtain or install that phone version. If the older phone client is
unavailable, preserve the existing configuration and recover forward to an
approved obtainable compatible pair. A local candidate proves only candidate
recovery until public availability is independently established.

Finish only after both floors pass, runtime inspection matches the intended
bundle, the existing phone connection resumes and its reply stays in the intended
backend/session. Compare the preserved settings and other Runtime Bundle with
the checkpoint. A version string or successful installer exit alone is not enough.

## Route the failed component

| Observed state | Next action | Preserve / completion criterion |
|---|---|---|
| Fresh, plugin absent | Standalone Step 1 prerequisites, then Step 2 approved source install; inspect managed provenance | Do not invoke plugin tools or CLI before installation/load. Then assess, rather than replaying the whole checklist. |
| Installed, disabled | Step 4 enable only under the applicable approval | Keep install record, credentials and other phones; verify runtime load. |
| Failed load / unconfigured | Runtime inspection plus the named diagnostic; missing credential → Step 3, gateway down → Step 5 / GW-DOWN | Repair the named field or component; never uninstall/reinstall over recorded provenance as generic recovery. Managed/read-only config goes to its owner. |
| Controller call fails | Reclassify via public runtime inspection; do not repeatedly invoke the failing controller | A loaded older version without the surface uses standalone step checks; a known load error uses its named fix. Do not loosen tool policy to invent a missing capability. |
| Completed setup, healthy | `journey.coreComplete: true` → use its success message and finish | No pairing, first-use retry, welcome or optional integration required. |
| Completed setup, currently disconnected | Follow `recoveryCheckpoint` / current health; Step 8 phone VPN, Step 9 reconnect, or the named host/route failure | Keep durable completion. Reconnection does not require credential replacement or repeating installation. |
| Private route unhealthy | Step 7 route-reader proposal and ownership verdict | Withheld/foreign/ambiguous/exposed routes require owner action; never substitute a command, Funnel or Serve reset. |
| Pairing interrupted / refused / expired | Check whether the phone already connected; if not, user reruns `openclaw ocuclaw pair` | No `pair --retry` flag. Busy means let the other exchange's owner finish/cancel. Preserve credential and other phones. |
| First use interrupted | Read journey; when `toolFirstUse: available` and the tool is callable, use `first_use_begin` / `first_use_wait`; otherwise the advertised terminal fallback | Resume the saved installation/session checkpoint. Tool confirmation needs the returned binding and an explicit wearer answer in the host conversation. Only explicit retry rearms unfinished proof after repair; terminal fallback is `openclaw ocuclaw first-use`, with `--retry` and optional `--session <key>` for an explicit new attempt. |
| Older bundle lacks pairing/first-use | Steps 9–10 manual address/credential entry and phone-origin reply check | User enters a known credential privately. Report observed manual success without claiming a durable controller receipt. Never demand new-user proof for an already working existing connection. |
| Version mismatch | Read actual installed/runtime versions and both floors; enter update.md or approved beta lane for the deficient component | Latest stable can still be incompatible with a new client. Do not lower gates, switch backends or promise a phone rollback that is unavailable. |
| Reply confirmed, welcome incomplete | Follow the returned welcome operation or bounded retry | Preserve the phone reply. A changed phone binding needs an explicit fresh attempt; never replay a stale surface. |
| All optional choices declined | Finish at core completion | Voice, Even AI and diagnostics stay optional. New capable-host attempts require the bound welcome dismissal; historical completions stay complete. `:8443` is not a core requirement. |

The supported candidate sequence is prerequisites and compatible bundle → owned
private phone route → direct terminal pairing → fresh phone-origin reply → explicit
wearer confirmation → core complete. The host conversation guides setup; the phone
conversation remains the selected OpenClaw test session. Do not change Hermes,
other Runtime Bundles, session affinity or unrelated host configuration.

## Private human actions and credential reset

The user runs pairing in their own terminal; `--light-terminal` only changes QR
contrast. Compare four safety words and type `approve` (any letter case) only for the intended
exchange. A typo is asked again and never approves; mismatch, timeout and cancellation do not approve. Never capture
QR, code, safety words or credential values in agent tools, transcripts or logs.

First-use confirmation is the user's exact `SEEN ON G2` in their terminal after
seeing that reply on the glasses. Never issue it for them. `--test-input` is
automation-only and cannot establish a wearer verdict or real core completion.

An additional phone normally receives the existing credential through pairing.
For an older manual-only bundle whose credential the user cannot enter, first
explain the obtainable supported pairing upgrade, if any. If the user instead
requests credential replacement, name it an **all-device reset** and obtain
separate explicit approval: **every phone already paired to this machine will
disconnect and must be set up again with the new credential**. Then follow Step
3's user-owned entry procedure and presence-only verification. Never reset as a
generic retry, disclose a stored secret, or treat unreadable state as empty.
