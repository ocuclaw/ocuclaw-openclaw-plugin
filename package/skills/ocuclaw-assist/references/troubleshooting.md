# OcuClaw troubleshooting — named cases

**Guide version:** 2026-09-14 (1.0.43)

**Reference only** — execute nothing here unless a step routed you here by its
case name. After resolving a case, return to the skill's SKILL.md and re-run
the state assessment. Step references in these cases (Step 3, Step 5, Step 7,
Step 9, …) point to `{baseDir}/references/fresh-install.md`; the state
assessment, lane card, and guardrails are in the skill's SKILL.md.

---

**ERR-RELAY-TOKEN** — gateway prints at startup:
```
OcuClaw relayToken is required.
Set the plugin config with:
  openclaw config set plugins.entries.ocuclaw.config.relayToken "your-token"
The same token must be entered in the OcuClaw app's relay server token field within Even Hub.
Allow OpenClaw to reload, then verify: openclaw plugins inspect ocuclaw --runtime
If the gateway is live but the runtime remains stale, run once: openclaw gateway restart --safe
```
Do what it says via the Step 3 user-terminal lane, then Step 5.

---

**ERR-EVENAI-TOKEN** — gateway prints at startup:
```
OcuClaw evenAiToken is required when evenAiEnabled is true.
Set the plugin config with:
  openclaw config set plugins.entries.ocuclaw.config.evenAiToken "your-token"
The same token must be entered as the password in the Even AI Agent Configure section of the Even Realities app.
To disable Even AI instead, run:
  openclaw config set plugins.entries.ocuclaw.config.evenAiEnabled false --strict-json
Allow OpenClaw to reload, then verify: openclaw plugins inspect ocuclaw --runtime
If the gateway is live but the runtime remains stale, run once: openclaw gateway restart --safe
```
The token goes in via the user-terminal lane (Step 12); the disable command you may run yourself.

---

**CASE-D** — ⚠️ Migration note: if the config has `evenAiEnabled: true` without `evenAiToken`, `openclaw plugins update ocuclaw` fails validation. Even AI requests were already silently failing in that state. Fix: the user sets `evenAiToken` (the password in the Even Realities app's Agent Configure section) in their terminal — or you run `openclaw config set plugins.entries.ocuclaw.config.evenAiEnabled false --strict-json`. Then re-run the update.

---

**MIGRATE-8443** — older setups served the relay as TCP on `:8443`. **Only migrate when setup is broken, this is a fresh install, the route points at the wrong backend, or the user asks for the modern layout — a working existing setup wins over the preferred default.** To migrate: clear it, then run the Step 7 commands.

Linux / macOS:
```bash
sudo tailscale serve --tls-terminated-tcp=8443 off
```
Windows (Administrator PowerShell):
```powershell
tailscale serve --tls-terminated-tcp=8443 off
```
(If a legacy `https=8443` route already proxies to the actual relay port — the Step 5 `wsPort`, `47800` on new installs — keep it and just add the `:8444` route. If it points at a *different* port such as the old `:9000`, re-run both Step 7 commands so each route targets the actual Step 5 port.) After migrating, the app's relay address changes to `wss://…:8444` (Step 9); the Even AI URL stays on `:8443`.

---

**TS-AUTH** — `tailscale up` requires the user to open the printed URL and log in themselves. `sudo` password prompts belong to the user. Corporate tailnets may require admin device approval.

---

**TS-PORT-CLAIMED** — "already claimed": `tailscale serve status` shows what owns the port. Old relay route → MIGRATE-8443. Anything else → walk through it with the user before turning anything off; never guess.

---

**TS-SERVE-UNSUPPORTED** — if `tailscale serve` or the `--tls-terminated-tcp` flag is rejected as unknown, the host's Tailscale is too old: update it (re-run the Step 6 install command, or the OS package manager) and retry Step 7. On **macOS**, a `tailscale: command not found` instead means the App Store build's CLI isn't on `PATH` — call it via `/Applications/Tailscale.app/Contents/MacOS/Tailscale`, or install the standalone package (Step 6). If the routes apply but `https://…ts.net` / certificate provisioning fails, enable **MagicDNS** and **HTTPS certificates** for the tailnet in the admin console (`login.tailscale.com/admin/dns`), then retry.

---

**PHONE-NO-REACH** — check in order: is the phone's Tailscale app actually connected (VPN toggle on)? Same account as this machine (the phone shows up in `tailscale status`)? Device pending approval at `login.tailscale.com/admin/machines`?

---

**APP-CONNECT-FAIL** — Fast check first, before any host-side changes: have the user open the phone's Tailscale app and confirm it shows "Connected" (VPN toggle on). If a setup that worked recently suddenly fails, phone Tailscale being offline is the most likely cause — reconnect it, retap Connect in OcuClaw, and stop here if that fixes it. Only continue below once phone VPN state is confirmed.

The relay logs every connection attempt; collect evidence before guessing. Connection evidence lives in the relay log and the typed verify's `runtime.appClientConnected` — never in session listings, which are scope-restricted (`visibility=tree`) and blind to the phone's session from this lane; a count of 0 there is not disproof. Have the user tap Connect, then read the tail of the gateway log (`openclaw logs`, or the newest `/tmp/openclaw/openclaw-*.log` on Linux/macOS):
- `[ocuclaw] relay rejected connection: invalid token …` **anywhere in the last minute** → token mismatch → re-enter it, or reset via Step 3. (Repeat rejects from the same address are collapsed into one line per 60s — a fresh tap often prints nothing new while an earlier reject line is still the live evidence.)
- `[ocuclaw] relay client connected …` at that moment → the relay WAS reached — the problem is past connectivity (version banner in the app, or app-side).
- No connect **and no reject line in the last minute** → the attempt never reached the relay → address/route problem: work the address checklist below, re-verify the Serve routes (Step 7), and on a containerized host → DOCKER-RELAY-UNREACHABLE.

Have the user **read back exactly** what's in the app's Address field (the address must be `wss://…:8444` — see Step 9 ⚠️ for the full address rules):
- starts with `wss://`
- ends in `:8444`
- machine name `<node>.<tailnet>.ts.net` spelled exactly as Step 7 printed it

Then the token (a mismatch logs the reject line above): have the user re-enter it, or reset via Step 3. Relay actually up? `openclaw plugins inspect ocuclaw` shows `Status: loaded`. Still failing on a containerized host → DOCKER-RELAY-UNREACHABLE.

---

**AGENT-TOOLS-FILTERED** — apply SKILL.md's **Capability-first controller
routing** table first. Only the table's `controller-policy-hidden` lane belongs
here; every other state follows its named standalone or version lane. Use
`openclaw sandbox explain` and `openclaw logs` (`agents/tool-policy` entries) to
identify the applicable scope. Fix only that named scope. For a root-layer
omission, run Step 4's tool-access lane (including its pre-mutation warning),
allow reload, and verify. Only if the live runtime is proven stale request one
`openclaw gateway restart --safe`; then re-apply the table and Step 10.

---

**PLUGIN-RUNTIME-STALE** — the app reports "plugin mismatch / update required" after an app + plugin update, yet the installed plugin version looks right: the running gateway is still serving the old plugin code. Prove it, refresh it once, and escalate to the environment only if it will not refresh:

1. Compare registry vs runtime:
   ```bash
   openclaw plugins inspect ocuclaw
   openclaw plugins inspect ocuclaw --runtime
   ```
   Both show the new `Version:` and `Status: loaded` → the runtime is current; the mismatch is app-side (recheck the app's installed version in Even Hub) — not this case.
2. Runtime stale → give the restart warning (rule 5), then run exactly one:
   ```bash
   openclaw gateway restart --safe
   ```
3. Re-verify: `openclaw plugins inspect ocuclaw --runtime` shows the new version, `openclaw gateway status` is healthy, then a quick Step 10 test.
4. Still stale on a VPS/Docker host — confirm the actual live gateway process restarted (a supervisor/wrapper being up is not the same thing):
   ```bash
   openclaw gateway status --deep --require-rpc
   ```
5. Only after a proven restart still leaves the runtime on the old version: restart the container/service (Docker lane: the DOCKER-RELAY-UNREACHABLE recreation rules apply — confirm persistent state is on a volume/mount first), or as a last resort a controlled host reboot, then re-run step 3's verification. A reboot is never the first move — prove the runtime didn't refresh before touching the environment.

---

**HOST-OLD** — OpenClaw below 2026.6.9 is under the plugin's minimum host version (installs and updates refuse), and builds below 2026.4.25 additionally have a known plugin-install bug. Upgrade with `openclaw update` (detects the install type, can run `openclaw doctor`, and restarts the gateway itself). If that subcommand isn't available on a very old build, fall back to `npm install -g openclaw@latest` then `openclaw gateway restart`. Give the restart warning first either way, then re-run the State Assessment.

---

If any OpenClaw command reports `Unsafe fallback OpenClaw temp dir`, stop the
OcuClaw step: OpenClaw rejected a wrong-owner, symlinked, inaccessible, or
otherwise unsafe host temp path before OcuClaw ran. Inspect the effective user,
`TMPDIR`, and parent/child ownership once. On a container or managed host,
prefer a persistent private user-owned `0700` temp directory supplied through
`TMPDIR`; on an ordinary shared Linux host, an administrator must first confirm
that `/tmp` itself was accidentally misconfigured before repairing it. Do not
repeatedly change global `/tmp` permissions. Apply one host repair, retry
`openclaw --version` once, and resume only when that succeeds; otherwise stop
and hand the host failure to its operator.

---

**GW-DOWN** — `openclaw status` (or `openclaw status --all` for the full read-only pasteable diagnosis), then `openclaw gateway status`, `openclaw gateway restart`, and `openclaw plugins doctor`. Read any errors to the user in plain words. Deeper probes when the surface checks look healthy but behavior disagrees:
- `openclaw gateway status --deep --require-rpc` — proves the live Gateway answers RPC (a wrapper/supervisor being up is not the same thing).
- `openclaw config get plugins.allow` — if it returns a list, `"ocuclaw"` must be in it (and `plugins.deny` wins over everything, including enablement).
- Validation errors naming stale plugin state → `openclaw doctor --fix`.
- Diagnostics saying `blocked plugin candidate: suspicious ownership` → `PLUGIN-BLOCKED-OWNERSHIP`.

If the failure is a relay bind/port error (`EADDRINUSE`, `WSAEACCES`, "address already in use", "forbidden by its access permissions"), it's a port conflict → `RELAY-PORT-CLAIMED`, not this entry.

---

**PLUGIN-BLOCKED-OWNERSHIP** — plugin diagnostics say `blocked plugin candidate: suspicious ownership (... uid=1000, expected uid=0 or root)` and config validation follows with `plugin present but blocked`: the plugin files are owned by a different Unix user than the process loading them (common on Docker/VPS installs). Keep the config; fix ownership. For the official Docker image (runs as `node`, uid `1000`), the host bind-mounted OpenClaw config/workspace dirs should be owned by uid `1000`:
```bash
sudo chown -R 1000:1000 /path/to/openclaw-config /path/to/openclaw-workspace
```
If OpenClaw intentionally runs as root, repair the managed plugin root to root ownership instead (`sudo chown -R root:root /path/to/openclaw-config/npm`). Then `openclaw plugins registry --refresh` (or `openclaw doctor --fix`) so the plugin registry matches the repaired files, and re-run the Step 5 VERIFY.

---

**RELAY-PORT-CLAIMED** — the gateway is up but the relay couldn't bind its loopback port (startup log shows `EADDRINUSE`, `WSAEACCES`, "address already in use", or "forbidden by its access permissions"). The chosen port is taken or, on Windows, reserved by WinNAT. Pick a free port and re-point everything at it:

1. Find a genuinely free port (read-only, per OS):
   - **Windows:** `netsh int ipv4 show excludedportrange protocol=tcp` (avoid any listed block) AND `netstat -ano | findstr :<port>` (no line = no live listener).
   - **Linux:** `ss -ltnH "sport = :<port>"` (no output = free).
   - **macOS:** `lsof -nP -iTCP:<port> -sTCP:LISTEN` (no output = free).
   Walk the ladder `47800 → 43117 → 38271` (or any port in `30000–49151`), checking each, until one is both reservation-free and not listening.
2. Set it: `openclaw config set plugins.entries.ocuclaw.config.wsPort <port> --strict-json`
3. Allow config reload, then confirm `openclaw plugins inspect ocuclaw --runtime` shows `Status: loaded`. If the live runtime is stale, give the warning and request one `openclaw gateway restart --safe`, then verify once more.
4. If Step 7 serve routes already exist, re-run both Step 7 commands with the new `<port>` so they match.

---

**DOCKER-RELAY-UNREACHABLE** — enter this lane only after the user actually taps
Connect in Step 9 and the attempt never reaches the relay. Before this lane may
widen the listener, its host inspection must confirm both halves of the
topology: OpenClaw uses a bridge or named Docker network, and Tailscale Serve /
the ingress proxy runs outside that network namespace. The runtime's container
notice does not confirm either half; container detection alone cannot
distinguish bridged Docker from host networking, a same-network-namespace
proxy, or a Sprite/microVM. When the proxy shares the relay's same network
namespace, keep loopback and return to `APP-CONNECT-FAIL` diagnostics instead.

1. Preserve the safe bind while establishing the path. In the OpenClaw terminal,
   read `openclaw config get plugins.entries.ocuclaw.config.wsBind`. `Config path
   not found` or a configured loopback address is safe. Until every crossing
   condition below is proven, restore any non-loopback value (including a stale
   `0.0.0.0`) with:
   `openclaw config set plugins.entries.ocuclaw.config.wsBind "127.0.0.1"`.

   Then, in the HOST terminal, establish the topology:
   - `docker inspect -f '{{.HostConfig.NetworkMode}}' <container>` → `host` means
     the relay and host share a namespace: keep `127.0.0.1`, publish no port, and
     return to `APP-CONNECT-FAIL`.
   - `bridge` or a named network is only the first half. Locate where Tailscale
     Serve / the ingress proxy runs. If it runs in the relay's same network
     namespace, keep loopback and return to `APP-CONNECT-FAIL`. Continue here
     only when the proxy is outside that namespace and must cross the bridge.
   - If the network mode or proxy location remains unknown, preserve loopback
     and stop for the host operator; do not guess from the container notice.

2. Make the host publish safe before widening the listener. On the host, run
   `docker ps --format '{{.Names}} {{.Ports}}'` and inspect the OpenClaw
   container's `<port>` mapping (`<port>` = Step 5 `wsPort`):
   - `127.0.0.1:<port>-><port>/tcp` → publish already safe; continue to step 3.
   - `0.0.0.0:<port>->…` → ⚠️ **publicly exposed on the host's public IP**;
     repair it below while the relay still listens only on loopback.
   - no `<port>` mapping → add the host-loopback publish below while the relay
     still listens only on loopback.

   To add or repair the publish, run `docker compose ls` (host) first:
   - **Compose-managed** (a project is listed): edit the file shown under CONFIG FILES — in the OpenClaw service's `ports:` list add or correct to `- "127.0.0.1:<port>:<port>"` (remove any stale mapping for an old relay port) — then `docker compose -f <that file> up -d`.
   - **Not compose-managed** (empty list — standalone `docker run`): the container must be RECREATED with `-p 127.0.0.1:<port>:<port>` and otherwise identical settings. Read them first — `docker inspect <name>` shows image, volumes/mounts, env, and restart policy. Confirm the state lives on a mount/volume (not the container's own filesystem) BEFORE removing anything, write out the full stop → remove → re-run sequence (`docker stop`, container removal, then the complete `docker run …` line) for the user, and check with them at each step.
   Either path restarts OpenClaw — give the restart warning (rule 5) first. If you (the agent) live inside that container, the restart also cuts THIS chat: hand the user the complete remaining command list *and* the verify steps below before they apply anything, plus a one-line resume note they can paste into a fresh session.

   VERIFY the safety condition before continuing: `docker ps` must now show
   exactly `127.0.0.1:<port>-><port>/tcp`. Do not widen `wsBind` until this passes.

3. Only after step 2 passes, widen the container listener from the OpenClaw
   terminal (non-secret):
   `openclaw config set plugins.entries.ocuclaw.config.wsBind "0.0.0.0"`.
   Allow config reload, then confirm the startup log shows
   `ws://0.0.0.0:<port>`. If the live runtime remains stale, give rule 5's
   warning and request one `openclaw gateway restart --safe` before verifying
   again.

4. VERIFY both sides:
   - **In the container:** `curl -s -i --max-time 5 http://$(hostname -i):<port>/ | head -3` returns `404` (not `connection refused`).
   - **On the host:** `docker ps` still shows only
     `127.0.0.1:<port>-><port>/tcp`, and
     `npx -y wscat -c ws://127.0.0.1:<port>` prints `Connected` then
     `Disconnected (code: 4001, reason: "invalid_token")`. That close is the
     pass signal: the relay answered and asked for auth. `error: socket hang up`
     means a dead backend; recheck the publish target port and bind. No node/npx
     on the host → fallback:
     `curl -s -i --max-time 5 http://127.0.0.1:<port>/ | head -3`; `404` is the
     weaker pass, `connection refused` is failure.

Then resume where the flow left off (usually Step 7 or Step 9).

---

**CLIENT-TOO-OLD** — the app connects to the relay but then shows a terminal version screen: the installed **app** is below the version the plugin requires (the screen names the required app version). This is the plugin's compatibility floor working as designed — the host side is DONE and correct; only the phone app needs updating. Recovery: Even Realities app → Even Hub App Store → update **OcuClaw** to the version the screen names (or newer) → reopen it → it connects with the same address and token, nothing to re-enter. **Transition window:** if the store does not yet offer the required version, the update is pending Even Hub review — usually days, not weeks. Tell the user plainly: setup on this machine is complete and verified; check Even Hub for the OcuClaw app update and everything will work the moment it lands. Do NOT downgrade the plugin to work around this (the older stable plugin has known connection-stability problems) unless the user explicitly insists; a pinned older npm install is `openclaw plugins install npm:ocuclaw@<version> --force`, and the trade-off is theirs to accept.

---

**GW-RESTART-NOSVC** — `openclaw gateway restart` reports `Gateway service disabled` / `no installed service found`, yet `openclaw gateway status` shows the gateway alive. This host runs the gateway as a foreground process (containers, microVMs, dev shells) — there is no managed service for the command to restart, and it will NOT kill the live gateway. Path: plugin and config changes usually **hot-reload** — verify directly (`openclaw plugins inspect ocuclaw --runtime` shows the expected version/config effect) instead of chasing a restart. If verification proves a real restart is needed, the **user** restarts their foreground gateway process the way they started it (or restarts the container); then verify again. Never loop the restart command hoping for a different answer.

---

**TERM-HELP** — opening a terminal on this machine: Linux — Ctrl+Alt+T or "Terminal" in the app menu · macOS — Cmd+Space, type Terminal · Windows — Start menu, type PowerShell. If they normally reach this machine remotely, they connect the same way they usually do (e.g. SSH). `command not found` usually means OpenClaw isn't on that shell's PATH or it's the wrong machine — have them confirm `openclaw --version` works there first. Mind the quotes around tokens.

---

**ESCALATE** — when stuck after honest attempts, escalate through two lanes; offer both.

**Lane 1 — in-app debug upload (preferred when the OcuClaw app is installed).** It attaches real diagnostics to the report — far better evidence than any paste block. The app can still send its client-only diagnostics while disconnected; a host bundle needs a relay connection for full-bundle handoff to the phone.

0. **Lane gate — route by plugin version, not by trial-and-error.** Read `Version:` from `openclaw plugins inspect ocuclaw`. Version below 1.3 → the upload lane does not exist in that build (the app has no working bug icon to find); go straight to **Lane 2** (optionally after a stable update via U1, which also unlocks Lane 1). Do NOT probe by running a `config set` and watching for rejection — the debug keys are accepted on old plugins too, so acceptance proves nothing.
1. Host side (non-secret — you may run both): give rule 5's warning before the first write, then allow OpenClaw to reload and verify the runtime. Only if the gateway is live but the runtime is proven stale request one `openclaw gateway restart --safe`. `externalDebugToolsEnabled` permits bounded diagnostic capture, preview, cache, and local save on the OpenClaw host. `allowDebugUpload` separately permits full-bundle handoff to the phone for user-initiated upload and defaults off. **Both keys are required for host-bundle upload**; setting only the first intentionally keeps local diagnostics available while the app's fetch is refused with `upload_not_allowed`. (If both already read `true` — e.g. enabled at install via Step 12b — skip straight to step 2, no restart needed.)
   ```bash
   openclaw config set plugins.entries.ocuclaw.config.externalDebugToolsEnabled true --strict-json
   openclaw config set plugins.entries.ocuclaw.config.allowDebugUpload true --strict-json
   ```
2. User side, in the OcuClaw app: Settings → turn on **Client Debug Enabled**. If the problem is quick to reproduce, reproduce it once now so it lands in the captured window.
3. User taps the yellow bug icon on the connection strip (top of the app) → the **Send Bug Report** popup → review what's included → **Send**.
4. On success the app shows "Sent to OcuClaw" with a ticket reference (like `OCU-XXXX-XXXX`). Have the user save it — the ticket is how the maintainer finds their diagnostics. Include it in the Lane 2 post.

If the bug icon or Send flow isn't available (very old app build, or the app was never installed), skip to Lane 2.

**Lane 2 — Discord paste block.** Assemble this paste-ready breakdown, show it to the user, confirm together it contains no secrets, and point them at the OcuClaw Discord:
```
OcuClaw setup help — guide 2026-09-14 (1.0.43)
Platform/OS:
openclaw --version:
openclaw status --all (read-only, pasteable — confirm no secrets):
Plugin Version / Status (from plugins inspect):
Config keys set (names only, never values):
tailscale status (summary):
tailscale serve status:
openclaw gateway status:
openclaw plugins doctor (ocuclaw lines):
Failing step + symptom:
Already tried:
Debug upload ticket (if sent):
```

---

**BETA-REPORT** — when a beta build misbehaves, assemble this paste-ready report, show it to the user, confirm together it contains no secrets, and have them post it in the beta-testing Discord (`https://discord.ocuclaw.com`). If the app is installed, also offer the ESCALATE Lane 1 in-app debug upload first — the ticket attaches real diagnostics to the report:
```
OcuClaw beta report — guide 2026-09-14 (1.0.43)
Installed beta version (from plugins inspect):
Platform/OS:
openclaw --version:
Plugin Status (loaded?):
Config keys set (names only, never values):
What broke (symptom):
Steps to reproduce:
Already tried:
Debug upload ticket (if sent):
```
If they'd rather drop back to stable in the meantime, that's the rollback path in `{baseDir}/references/beta.md`.

---
