# OcuClaw troubleshooting — named cases

**Guide version:** 2026-09-25 (1.0.58)

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
Do NOT do what the old message says: nobody types a credential. The plugin
creates one itself at its first load (Step 3). Read `journey`'s
`durableFacts.relayCredential.mintOnLoad` for why the load could not, apply
Step 3's named owner action (writability, malformed branch, or the typed
provisioning on an older bundle), then Step 5. The gateway log line
`[ocuclaw] relay credential not minted at load (<code>)` carries the same code.

---

**ERR-EVENAI-TOKEN** — gateway prints at startup:
```
OcuClaw evenAiToken is required when evenAiEnabled is true.
```
Never put the token in chat or a command argument. If the plugin cannot load,
explain this narrow repair and disable only the broken Even AI setting:

```bash
openclaw config set plugins.entries.ocuclaw.config.evenAiEnabled false --strict-json
```

Allow reload and verify the plugin runtime. Then use the private user-terminal
entry `openclaw ocuclaw credential even-ai`, followed by `openclaw ocuclaw even-ai
enable`; follow its observed activation result. Do not restart Cloudways.
Continue with Step 12's route, Even app and real-request checkpoints; preserving
the saved token or enabling a flag alone is not end-to-end success.

---

**CASE-D** — ⚠️ Migration note: if the config has `evenAiEnabled: true` without `evenAiToken`, the plugin update (`openclaw plugins update ocuclaw@latest`, or `update ocuclaw` on a ClawHub record) fails validation. Even AI requests were already silently failing in that state. Fix: the user sets `evenAiToken` (the password in the Even Realities app's Agent Configure section) in their terminal — or you run `openclaw config set plugins.entries.ocuclaw.config.evenAiEnabled false --strict-json`. Then re-run the update.

---

**MIGRATE-8443** — older setups served the phone relay as TCP on `:8443`.
Preserve a working baseline. Before any approved migration, prove the old route
belongs to this OpenClaw installation and identify affected phones. Foreign,
Hermes-owned or ambiguous routes stop here for owner resolution. A wrong backend
alone is not permission to remove it. Only with that evidence and migration
approval may the user remove this specific old route, then follow Step 7 for the
private phone route; never reset all Serve configuration.

Linux / macOS:
```bash
sudo tailscale serve --tls-terminated-tcp=8443 off
```
Windows (Administrator PowerShell):
```powershell
tailscale serve --tls-terminated-tcp=8443 off
```
Preserve any HTTPS route on `:8443`; it is outside core phone recovery. Repair
Even AI only when requested through Step 12 and its ownership checks. After an
approved phone migration, enter `wss://…:8444` on affected phones (Step 9), keeping
their existing credential. Verify connection before declaring recovery.

---

**TS-AUTH** — `tailscale up` requires the user to open the printed URL and log in themselves. `sudo` password prompts belong to the user. Corporate tailnets may require admin device approval.

---

**TS-PORT-CLAIMED** — "already claimed": `tailscale serve status` shows what owns the port. Old relay route → MIGRATE-8443. Anything else → walk through it with the user before turning anything off; never guess.

---

**TS-SERVE-UNSUPPORTED** — if `tailscale serve` or the `--tls-terminated-tcp` flag is rejected as unknown, the host's Tailscale is too old: update it (re-run the Step 6 install command, or the OS package manager) and retry Step 7. On **macOS**, a `tailscale: command not found` instead means the App Store build's CLI isn't on `PATH` — call it via `/Applications/Tailscale.app/Contents/MacOS/Tailscale`, or install the standalone package (Step 6). If the routes apply but `https://…ts.net` / certificate provisioning fails, enable **MagicDNS** and **HTTPS certificates** for the tailnet in the admin console (`login.tailscale.com/admin/dns`), then retry.

---

**TS-DNS-SELF** — the route applies but `journey` reports `unreachable` with
`privateRoute.evidence: front_door_unresolved`: this node cannot resolve its
own MagicDNS name. Common on containers and userspace-networking nodes, where
Tailscale never installs a resolver. Fix any one of these on the node that runs
the gateway, then re-read `journey`:
- `tailscale set --accept-dns=true` (the normal fix);
- a `nameserver 100.100.100.100` line in that node's resolver configuration;
- an `/etc/hosts` line mapping the node's tailnet IP to
  `<node>.<tailnet>.ts.net`, exactly as Step 7 printed the name.
A timeout or a refused connection is a different failure: that is certificates
or the relay, not DNS — take the Step 7 certificate wait, then the Step 5 relay
bind check.

---

**TS-CLI-ABSENT** — `journey` reports the private route `unknown` with evidence
`serve_cli_absent` on a host that is not Cloudways. The controller reads
`tailscale serve status` from the gateway process's PATH, and that command is
not there. Two causes, one rule: Tailscale must run where the gateway runs.
- **macOS App Store build** — the CLI is not on `PATH`. Expose it (symlink or
  call `/Applications/Tailscale.app/Contents/MacOS/Tailscale`), or install the
  standalone package (Step 6), then re-read `journey`.
- **Tailscale in a different container or VM than the gateway** — move one of
  them: run `tailscaled` inside the gateway's own namespace (userspace
  networking, `--tun=userspace-networking`, is fine), or move the gateway into
  the namespace that already has Tailscale. Redo Steps 6 and 7 from there. A
  bridge + outside proxy cannot pass Step 7 or Step 9 and is not a supported
  lane; never widen `wsBind` to work around it.

---

**PHONE-NO-REACH** — check in order: is the phone's Tailscale app actually connected (VPN toggle on)? Same account as this machine (the phone shows up in `tailscale status`)? Device pending approval at `login.tailscale.com/admin/machines`?

---

**APP-CONNECT-FAIL** — Fast check first, before any host-side changes: have the user open the phone's Tailscale app and confirm it shows "Connected" (VPN toggle on). If a setup that worked recently suddenly fails, phone Tailscale being offline is the most likely cause — reconnect it, retap Connect in OcuClaw, and stop here if that fixes it. Only continue below once phone VPN state is confirmed.

The relay logs every connection attempt; collect evidence before guessing. Connection evidence lives in the relay log and the typed verify's `runtime.appClientConnected` — never in session listings, which are scope-restricted (`visibility=tree`) and blind to the phone's session from this lane; a count of 0 there is not disproof. Have the user tap Connect, then read the tail of the gateway log (`openclaw logs`, or the newest `/tmp/openclaw/openclaw-*.log` on Linux/macOS):
- `[ocuclaw] relay rejected connection: invalid token …` **anywhere in the last minute** → token mismatch → have the user re-enter the credential in the app. If they cannot — they have forgotten it, or never knew it — that is the all-device reset described in the fresh-install Step 3 block "**Credential present but the user cannot enter it on the phone**": the supported route is a bundle with terminal pairing (`openclaw ocuclaw pair` delivers the credential privately); replacing the credential disconnects every phone paired to this machine and must be set up again, so name it, get an explicit OK, and go through the explicit reset procedure only — never a hand-typed value. (Repeat rejects from the same address are collapsed into one line per 60s — a fresh tap often prints nothing new while an earlier reject line is still the live evidence.)
- `[ocuclaw] relay client connected …` at that moment → the relay WAS reached — the problem is past connectivity (version banner in the app, or app-side).
- No connect **and no reject line in the last minute** → the attempt never reached the relay → address/route problem: work the address checklist below, re-verify the Serve routes (Step 7), and on a containerized host → DOCKER-RELAY-UNREACHABLE (which moves Tailscale into the gateway's namespace; it never widens the relay).

Have the user **read back exactly** what's in the app's Address field (the address must be `wss://…:8444` — see Step 9 ⚠️ for the full address rules):
- starts with `wss://`
- ends in `:8444`
- machine name `<node>.<tailnet>.ts.net` spelled exactly as Step 7 printed it

Then the token (a mismatch logs the reject line above): have the user re-enter it; if they cannot, take the all-device reset named in the bullet above — the fresh-install Step 3 block "**Credential present but the user cannot enter it on the phone**" — with its explicit OK first. Relay actually up? `openclaw plugins inspect ocuclaw` shows `Status: loaded`. Still failing on a containerized host → DOCKER-RELAY-UNREACHABLE (which moves Tailscale into the gateway's namespace; it never widens the relay).

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

**HOST-OLD** — OpenClaw below 2026.7.1 (floor 2026.7.1-2, the release Cloudways ships) is under the plugin's minimum host version (installs and updates refuse), and builds below 2026.4.25 additionally have a known plugin-install bug. Upgrade with `openclaw update` (detects the install type, can run `openclaw doctor`, and restarts the gateway itself). If that subcommand isn't available on a very old build, fall back to `npm install -g openclaw@latest` then `openclaw gateway restart`. Give the restart warning first either way, then re-run the State Assessment.

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
Connect in Step 9 and the attempt never reaches the relay.

**This lane never widens the relay listener.** The bridge + outside-proxy setup
is retired: Tailscale must run where the gateway runs, because the controller
reads `tailscale serve status` from the gateway process's PATH. A proxy outside
the gateway's network namespace cannot pass Step 7 or Step 9 however `wsBind`
is set, so the fix is to move one of them, never to open the relay. The
runtime's container notice proves nothing on its own: container detection
cannot distinguish bridged Docker from host networking, a same-namespace proxy,
or a Sprite/microVM.

1. Restore and keep the safe bind. In the OpenClaw terminal, read
   `openclaw config get plugins.entries.ocuclaw.config.wsBind`. `Config path
   not found` or a configured loopback address is safe. Restore any
   non-loopback value (including a stale `0.0.0.0` left by the retired lane)
   with:
   `openclaw config set plugins.entries.ocuclaw.config.wsBind "127.0.0.1"`.

2. Establish the topology in the HOST terminal:
   - `docker inspect -f '{{.HostConfig.NetworkMode}}' <container>` → `host` means
     the relay and host share a namespace: keep `127.0.0.1`, publish no port, and
     return to `APP-CONNECT-FAIL`.
   - `bridge` or a named network → locate where Tailscale Serve / the ingress
     proxy runs. If it runs in the relay's same network namespace, keep loopback
     and return to `APP-CONNECT-FAIL`.
   - Proxy outside that namespace → this is the retired crossing. Move
     Tailscale: run `tailscaled` inside the container or VM that runs the
     gateway (userspace networking, `--tun=userspace-networking`, is fine), or
     move the gateway into the namespace that already has Tailscale. Then redo
     Step 6 and Step 7 from inside that namespace, with the relay still on
     loopback. Do not set `wsBind` to `0.0.0.0`.
   - Network mode or proxy location unknown → preserve loopback and stop for the
     host operator; do not guess from the container notice.

3. Repair a leftover public publish. If `docker ps --format '{{.Names}} {{.Ports}}'`
   shows `0.0.0.0:<port>->…` for the OpenClaw container (`<port>` = Step 5
   `wsPort`), that is ⚠️ **publicly exposed on the host's public IP** — a
   leftover of the retired lane. Repair it to `127.0.0.1:<port>:<port>`, or drop
   the mapping entirely once Tailscale runs in the gateway's namespace. Run
   `docker compose ls` (host) first:
   - **Compose-managed** (a project is listed): edit the file shown under CONFIG FILES — in the OpenClaw service's `ports:` list correct it to `- "127.0.0.1:<port>:<port>"` (remove any stale mapping for an old relay port) — then `docker compose -f <that file> up -d`.
   - **Not compose-managed** (empty list — standalone `docker run`): the container must be RECREATED with the corrected `-p 127.0.0.1:<port>:<port>` and otherwise identical settings. Read them first — `docker inspect <name>` shows image, volumes/mounts, env, and restart policy. Confirm the state lives on a mount/volume (not the container's own filesystem) BEFORE removing anything, write out the full stop → remove → re-run sequence (`docker stop`, container removal, then the complete `docker run …` line) for the user, and check with them at each step.
   Either path restarts OpenClaw — give the restart warning (rule 5) first. If you (the agent) live inside that container, the restart also cuts THIS chat: hand the user the complete remaining command list *and* the verify steps below before they apply anything, plus a one-line resume note they can paste into a fresh session.

4. VERIFY, from inside the gateway's own namespace:
   - `tailscale serve status` runs there and shows the Step 7 route.
   - `curl -s -i --max-time 5 http://127.0.0.1:<port>/ | head -3` returns `404`
     (not `connection refused`).
   - `docker ps` shows no `0.0.0.0` mapping for `<port>`.

Then resume where the flow left off (usually Step 6 or Step 7).

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
OcuClaw setup help — guide 2026-09-25 (1.0.58)
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
OcuClaw beta report — guide 2026-09-25 (1.0.58)
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
