# Cloudways managed OpenClaw: userspace Tailscale kept alive by the plugin itself

**Guide version:** 2026-10-28 (1.0.60)

Use this branch in place of fresh-install Steps 6 and 7 when the host is a
Cloudways **Managed AI Agents** container running OpenClaw 2026.9.5 (hostname
ends `.cloudwaysagents.com`). OcuClaw needs 2026.9.5 or newer, so Step 1's
version check passes there. Everything else in the fresh-install guide stays
as written: rejoin it at Step 8 once C5 below is green. The setup receipt's
`journey` keeps driving; this branch adds one sub-check.

## Chat setup comes first

When `ocuclaw_setup` offers `next`, setup on Cloudways is SKILL.md's **Chat
setup**: call `next` and relay its lines. The user stays in their OpenClaw
chat. `next` starts Tailscale, gets the approval link, opens the private route
behind an approval card and pairs the phone from a code typed in chat. Nobody
opens a terminal or SSH on that path, and nothing on this page is run by hand.

Read the rest of this page only for:

- a `stuck` result, to understand what `next` checked;
- an older plugin with no `next`;
- a user who asks to run setup in their own terminal instead.

Never restart the gateway on this host, by any means (see **Restart and reload
on this host** below). `next` never asks for one here.

## Terminal fallback: one command

```bash
openclaw ocuclaw cloudways setup
```

On a Cloudways managed host this runs the whole path below in the user's own
terminal and ends at a first message whose reply the user confirmed on the
display: host check, conversation access, a check that OcuClaw is loaded,
Tailscale install
and daemon, tailnet authorization, the private route, the pairing ceremony, then
the first message and the welcome card. Eight steps, a progress line each. It
reads state before every step and skips what is already done, so re-running
after a dropped session resumes instead of redoing.

It asks twice, each time saying in plain words what changes and defaulting to
no: the conversation-access grant, which takes `y` or `yes`, and the tailnet
route, which takes the whole word `yes` and says so (ADR-0026 bought that one
exception to the plugin's print-only boundary on the strength of the user typing
the word itself). Each question is short by default: two or three lines, plus —
for the route — the exact command that will run, which ADR-0026 requires above
the fold. `--details` adds the technical restatement behind each question: the
config key the grant writes, and the longer description of what publishing the
relay on the tailnet means. Nothing that ADR-0026 binds moves behind the flag:
the exact argv, "tailnet only, never Funnel", "anything but yes changes
nothing" and the literal word `yes` are printed either way.
`--yes` answers both (use it
only for automation), `--no-pair` stops before pairing, `--no-first-use` stops
after pairing, `--wait <seconds>` sets how long it waits for the node to be
approved (default 600), `--first-use-wait <seconds>` sets how long it waits for
the first phone reply (default 600), and `--light-terminal` is kept so older
commands still run; it does nothing.

**A model comes first, from the Cloudways panel.** Right after the host check,
setup reads whether a model is signed in (`openclaw models status --json`). It
never signs in itself. With no model it says to sign in to OpenAI in the
Cloudways panel (**LLM & Channels → OAuth → OpenAI → Connect**) and stops, with
`--yes` too. That Connect restarts the container, and the gateway can take
several minutes to come back, so never start it while setup runs and never tell
the user to skip the model. Once the agent is back, run the same setup command
again: it reads the model as signed in and carries on. A status setup cannot
read never stops it.

**ChatGPT needs device code sign-in turned on first.** That Connect signs in to
ChatGPT with a link and a one-time code, and ChatGPT refuses it until the
account's **Enable device code sign-in for Codex, Excel, PowerPoint, and Word**
switch is on (ChatGPT **Settings → Security and login → App security**,
https://chatgpt.com/settings/security). While it is off, the sign-in can loop
through account picking and security checks before ChatGPT says why. If the
user says the OpenAI sign-in is refused or keeps looping, tell them to turn that
switch on and click Connect again. On a ChatGPT Business, Enterprise or Edu
workspace, an admin may have to allow it.

**It now looks for the phone itself.** Step 5 asks the user to install
Tailscale on the phone and approve the authorization link there, so the phone
lands on the same tailnet account by construction; any device already signed in
still works, and the step says so. Step 7 then opens with a read-only look for
a phone on the tailnet before the pairing ceremony runs. See **The step 7 phone
check** below for every ending. Fresh install Step 8 is no longer something you
have to finish before you offer this command; doing it first simply means step
7 finds the phone and says one line.

Step 8 arms the same first-use checkpoint `openclaw ocuclaw first-use` uses, asks
the user to send `hello` from the paired phone conversation, waits in that
terminal for the reply, then hands over to the first-use ceremony and its own
yes/no prompt ("Did the reply appear on your Even G2? [yes/no]"). `--yes` never answers that prompt and neither does this
command: the wearer types `yes` themselves. When the phone has already reported
that exact reply reaching the display, the ceremony says so and asks nothing. When the
phone was the Even simulator, it says "This was the simulator, so setup can't check the glasses
itself." before it asks. An answer of `no` records nothing and exits 1.

Setup opens with "If your terminal drops, run the same command again." A rerun resumes at the
first unfinished step.

**Step 8 finishes the welcome card too.** When the saved record stands at
`awaiting-welcome`, the command says `A welcome image is coming to your glasses.
Double-tap it to return to your conversation.`, sends the card through the
gateway, waits for the double-tap, and prints `OcuClaw Setup Completion is
recorded: OcuClaw on OpenClaw is set up.` Nobody is sent to `openclaw tui` for
it any more. Ctrl-C cancels the wait and takes the card off the display. If the
phone is not connected the command says so and the same command run again picks
up at the card. On the agent-led path the relay shows the card by itself too
(fresh-install Step 10); you arm the test, end your turn and wait for the wake.

**A model error is not a first reply.** When the run that should have produced
the first reply ends on an error, step 8 names that instead of asking whether
the reply appeared: the model returned an error (it names a rate limit when the
error is one), OcuClaw itself is installed, and the same command picks up here
once the model is fixed. Do not read that ending as a failed install.

Offer this when the user would rather type one command than have you drive the
steps. C1-C5 below stay the agent-led path and the manual fallback, and they are
what you follow when the one command stops part way.

## The step 7 phone check

Step 7 looks for a phone on the tailnet immediately before the pairing ceremony
runs. It does not look at all when a phone is already paired with this
installation, or when `--no-pair` skipped the pairing, because then there is
nothing the answer could change. The look is read-only: `tailscale status
--json`, the same read the route
checks already use. A peer counts as a phone when it reports an `iOS` or
`android` OS, compared case-insensitively, and says it is online. A tablet
reports the same, which is harmless: the pairing itself is what proves the
link.

The endings, and the line the user sees:

| Ending | What the terminal says | What happens |
|---|---|---|
| A phone is there | `Found a phone on your private network.` | carries straight on to the ceremony |
| None, on a real terminal | the walkthrough below, then it waits | carries on by itself when a phone appears (`A phone appeared on your private network.`) |
| None, user presses Enter | `Carrying on without a phone on your private network.` | carries on to the ceremony |
| None, ten minutes passed | `No phone appeared on your private network. Switch on Tailscale on your phone, then run the same command again; it picks up here.` | stops, exit 2, nothing changed, a rerun resumes here |
| None, no terminal | `No phone is on your private network yet. Carrying on, because this is not an interactive terminal.` | carries on at once, no wait |
| The status cannot be read | nothing at all | carries on to the ceremony |

The walkthrough, printed exactly as written:

```
Phone not found on your tailnet.
Open Tailscale, sign in with the same account, and switch it on.
Waiting for your phone to appear. Press Enter to carry on anyway.
```

It re-reads the tailnet every 3 seconds and gives up after 600. Nothing
shortens that wait but Enter: `--yes` does not, and `--no-pair` skips the
pairing and the check with it. A poll that cannot be read mid-wait is transient
and does not end the wait; only an unreadable opening read skips the check.
Input that arrives within 150 ms of the Enter watch being armed is ignored, so
a stray newline typed during step 5's long wait cannot skip the walkthrough.

Expiry follows the exchange phase, not tailnet presence: no phone joined,
waiting for approval, or approval sent but the phone connection not confirmed.
An unknown phase says the attempt did not finish. Refusal and cancellation do
not imply a missing phone and do not offer another code automatically.

## The pairing code waits for the user

Step 7 prints `Open Even > OcuClaw on your phone.` and goes straight to the
phone-code prompt. Nothing is minted until the user types the code OcuClaw
shows, so there is no Enter step first.

A manual code lasts five minutes, and it used to be burned while the user was
still finding their phone. So when phone codes are off or not working, on a
real terminal step 7 prints, before minting anything:

```
In OcuClaw tap Pair with your agent > Pair manually, then press Enter to show the code.
The next pairing code expires in 5 minutes.
```

and waits for Enter, for up to ten minutes. `--yes` and a non-interactive run
skip that gate, and so does typing `m` at the phone-code prompt.

A code that runs out no longer ends the command. It prints
`Press Enter for a new code, or type stop:`
and mints a fresh one in place, up to three times. Typing `stop` finishes with
the ordinary failed-pair ending, and a non-interactive run keeps exiting as it
always did.

The terminal asks for the phone code. On the phone the control is **Pair with
your agent** (older apps: **Pair with your computer**): OcuClaw shows a phone
code, and the user types it at the pair prompt. For manual pairing the user
types `m` at the pair prompt, then in OcuClaw taps **Pair with your agent >
Pair manually** and types the address and pairing code the terminal shows. Use
these exact control names. The four-word comparison
appears only after the phone joins: type `approve`, `refuse`, or `cancel`.
Case does not matter; a typo never approves. Approval waits for the phone's
authenticated connection before reporting that it is paired.

`--details` also explains settings that are already applied. It leaves them
as they are and does not re-ask the consent already given for them. Private-route consent still shows the
exact command and requires the literal word `yes`.

## What is different on this host

Tell the user once when entering this branch: OcuClaw is partnered with
Cloudways. Cloudways staff are available in the Cloudways channel in the
[OcuClaw Discord](https://discord.ocuclaw.com/).

OpenClaw runs as a non-root user inside a container: no `sudo`, no `python3`,
no `/dev/net/tun`, no systemd, no crontab. `node`, `npm`, `curl` and `tar` are
present. The gateway process `openclaw-gateway` is a child of PID 1
(`bash /entrypoint.sh`), which respawns it. `openclaw gateway restart` (or any
container bounce) restarts the whole container. Files under the home directory
survive that; background processes do not.

There is no script cron on this host, so there is no watchdog cron job. The
supervisor is the OcuClaw plugin itself: whenever the gateway starts (fresh
boot or PID 1's respawn), the plugin's relay service checks the host receipt
and the Cloudways state, starts the userspace `tailscaled` if it is not
already running, and re-checks every 60 seconds after that. Nothing is started
by hand and nothing kills `tailscaled` on gateway stop.

Cloudways has approved exactly one thing for OcuClaw here: a user-owned
userspace-networking `tailscaled` (binaries in `~/bin`, state in
`~/.tailscale`), supervised by the plugin. `openclaw ocuclaw cloudways ...`
implements that path as idempotent verbs the agent runs from its terminal
tool: `detect`, `install`, `enroll`, `status`, `retry`, `enable`, `disable`,
`rollback`, plus `setup`, which runs the whole sequence in the user's own
terminal (see "Terminal fallback" above). Every verb except `setup` takes `--json`. `status` takes `--wait <seconds>`.
`enroll` and `retry` take `--hostname <name>`. `rollback` needs `--yes` and
takes `--purge-identity`. The only manual work is Tailscale authorization (a
link the user opens) and the phone.

Do not attempt a generic Tailscale install on this host. No `sudo`, no script
installer, no systemd unit, no package manager. There is no
root and no TUN device on this container, so those paths cannot work and must
not be tried. Also never, on this host: Tailscale Funnel, ACL or tailnet
policy edits, `tailscale serve reset`, or starting `tailscaled` by hand.

Host-configuration facts for this box:

- `plugins.allow` on this host has been a non-empty allowlist. When it is a
  list, `"ocuclaw"` must be in it or the plugin never loads:
  ```bash
  openclaw config get plugins.allow
  ```
  Merge `"ocuclaw"` into the list if it is missing, preserving all existing
  entries.
- Install consent (`--accept-capabilities`) does not grant conversation
  access. Fresh-install Step 2 sets it just before the install, so the consent
  screen reads "allowed" and the hooks work from the first load. OcuClaw also
  sets it itself at first load, and `cloudways setup` step 2 checks it, so
  this is only for a box where it is still not `true`:
  ```bash
  openclaw config set plugins.entries.ocuclaw.hooks.allowConversationAccess true --strict-json
  ```
  Fresh-install Step 4 covers this grant; if this branch is reached from
  outside a fresh install, check it here.
- Any scripted or SSH install here (`install <tgz>`, `install --force <tgz>`,
  `update`) still runs the `--help` probe from recovery-routing.md's
  **Installation consent and recorded source**. On 2026.9.5 the probe adds
  `--accept-capabilities`, an archive needs `--force` too, and both need the
  person's yes first.
- Every `openclaw` command on this box, `openclaw plugins install` included,
  prints OpenClaw's own "Config warnings" about
  `channels.whatsapp.allowFrom` twice before its first line: a plain list while
  the CLI loads, then the same warnings boxed. That is OpenClaw reading the
  host's WhatsApp channel config, not OcuClaw: it prints before any OcuClaw
  code runs, and `openclaw ocuclaw cloudways setup` cannot suppress it
  (#3808). On OpenClaw 2026.9.x the setup's step 2 grant prints the same
  warnings once more, on one line, because OpenClaw validates the whole config
  on every config write. Tell the user it is harmless for OcuClaw and leave the
  WhatsApp settings alone unless they ask to change them.

A fresh plugin install needs no restart on this host. Do not restart on your
own: `openclaw ocuclaw cloudways setup` step 3 checks the running gateway and
asks for the one restart only when it is needed (for example, an upgrade over
an existing install). Step 1 says nothing about restarts. What to expect on
OpenClaw 2026.9.5:

- No restart, but a slower check. The install prints no
  restart hint; it ends with "Applied in Gateway generation N." The step 2
  grant makes the gateway reload OcuClaw, and for about a minute the gateway
  does not answer whether OcuClaw is loaded. Newer OpenClaw restarts can take
  about 7 minutes. Step 3 waits up to 8 minutes and says "Still checking. This
  can take up to 8 minutes." while it does, then how long it has been about
  once a minute (#3889, #6377). Tell the user to let it finish. If step 3 still prints the gateway kill
  command, relay it as printed.
- No gateway process running (for example after the gateway ran out of
  memory and the respawned one exited): the kill command would end nothing,
  so step 3 prints "Restart the agent from your Cloudways dashboard, then run
  openclaw ocuclaw cloudways setup again." instead. Relay that.

## C1 · Detect

```bash
openclaw ocuclaw cloudways detect --json
```

- `cloudways`: continue with C2.
- `likely`: ask the user one yes/no question, "Is this OpenClaw running on
  Cloudways Managed AI Agents?" Continue only on yes. `likely` is not
  decisive: mark neither answer "(Recommended)" and do not order the options
  to favour yes.
- `no`: leave this branch; use fresh-install Steps 6 and 7 with the system
  Tailscale.

## C2 · Install (idempotent)

Before running the command, tell the user in plain words: this installs the
approved user-owned Tailscale daemon in the home directory (verified binaries,
protected local state) and hands its supervision to the OcuClaw plugin, which
starts it whenever the gateway starts and checks it every 60 seconds after
that. Re-running it is safe. Get an OK, then run:

```bash
openclaw ocuclaw cloudways install --json
```

One run does all of: download the pinned Tailscale `1.102.4` amd64 tarball,
verify its SHA-256 against both the pinned value and the publisher's `.sha256`
file (existing binaries are adopted when they already print that version),
extract `tailscale` and `tailscaled` into `~/bin` (mode 700), create
`~/.tailscale` (mode 700), write the host receipt
`~/.evenclaw/state/ocuclaw.tailscale-cli.json`, record the plugin's own
install receipt, and start the daemon. Re-running reports `adopted` / `kept`
and changes nothing.

## C3 · Wait for the daemon

```bash
openclaw ocuclaw cloudways status --wait 45 --json
```

This polls until the daemon is running or needs authorization, or the
deadline passes. Read the first line:

- `daemon running`: an existing identity was adopted. Skip to C5.
- `daemon needs-authorization`: a fresh identity. Continue with C4.
- `daemon stopped` after the wait: run the same command once more with
  `--wait 90`. If still stopped, report the tail of
  `~/.tailscale/log/tailscaled.log` to the user.

## C4 · Enroll (the one manual step)

```bash
openclaw ocuclaw cloudways enroll --json
```

Before the call, tell the user registration can take up to 90 seconds and
that you are waiting for its authorization link. This runs `tailscale up`
once, bounded, and returns the `https://login.tailscale.com/...` link. A
pending result is not a failed registration. `retry` observes the same
enrollment and recovers a link that arrived late; neither `enroll` nor `retry`
logs out. Make at most one bounded `retry`. If it still has no link,
explain the pending state and offer to retry later or cancel setup. Do not
print daemon logs or secrets to the wearer.

Put the returned URL to the user: ask them to open it on any device signed
in to their tailnet, approve the node, then confirm. Never ask for their
identity-provider password. Then run
`openclaw ocuclaw cloudways status --wait 45 --json` until it reports `daemon
running`. To recover a delayed link or resume observation:

```bash
openclaw ocuclaw cloudways retry --json
```

`status` prints the node's key expiry. Tell the user once: disable key
expiry for this node in the Tailscale admin console, or the node will need
this authorization again when the key expires.

## C5 · Serve the phone route

The daemon runs userspace networking with a loopback SOCKS5 proxy on
`127.0.0.1:1055`. Because of that, this host has no kernel route to its own
tailnet name; OcuClaw's own route probes dial through that proxy
automatically once the receipt exists.

Run fresh-install Step 7 exactly as written. Once the receipt exists, the
apply command the controller prints for the `:8444` route already carries the
full binary path and socket flag for this host:

```bash
/home/<user>/bin/tailscale --socket=/home/<user>/.tailscale/run/tailscaled.sock serve --bg --tls-terminated-tcp=8444 tcp://127.0.0.1:<port>
```

Run that exact line only after Step 7's checkpoint OK, exactly as printed:
applying the route stays the operator's explicit action, same as the normal
flow. Re-read the controller after it runs; only a fresh `healthy` observation
completes the checkpoint.

**The cold certificate window.** After the route is applied for the first
time, the node has no TLS certificate yet. Tailscale issues it on the first
connection, not before. Measured live: the first handshake took 31 seconds,
and the route read `unreachable` with `front_door_timeout` until the
certificate existed. After that, handshakes were 36 to 66 ms. So the first
secure connection after applying the route can take up to a minute; that is
the certificate being issued, not a fault. Re-read the controller after 60
seconds before suspecting MagicDNS, HTTPS Certificates in the admin console,
or the relay. Only a repeat timeout after that wait points at a real problem.

**Do that wait inside the same turn.** Run one bounded wait in your own
terminal (`sleep 60`), or re-read journey up to three times about 30 seconds
apart, and answer the user only after the last read. Do not promise the user
a later re-check of the route and then end your turn: nothing wakes you, so
the user sits waiting for a message that never arrives. That happened on a
live run and cost the user two minutes of silence. If you genuinely must end
the turn, say so plainly and ask them to say "check the route again" in a
minute.

A human running a bare `tailscale` command on this host must use
`~/bin/tailscale --socket="$HOME/.tailscale/run/tailscaled.sock"` in place of
`tailscale`, including Step 8's `tailscale status --json`.

Then continue at fresh-install **Step 8**.

## Journey and health surfaces

The setup receipt's `journey` gains `tailnetDaemon.state` at the private-route
checkpoint (`running`, `needs-authorization`, `stopped`, `starting`, `absent`)
and `subCheck: "tailnet-daemon"` when it is not `running`. Fix the daemon (C3/
C4) before the route.

## Restart and reload on this host

**Never restart the gateway yourself here.** That includes OpenClaw's own
gateway tool (a restart action such as `gateway.restart.safe`): in #6339 it
restarted the whole container and cut the Tailscale link mid-setup. Changes
hot-load; verify by reading again instead.

`openclaw gateway restart` is a no-op here. It prints "Gateway service
disabled" plus systemd hints, and the gateway PID does not change. Do not run
it as a fix, and do not tell the user it restarted anything.

The CLI still prints its generic restart advice on this host. "Restart the
gateway to load plugins." and "Restart the gateway to apply." are wrong here:
those changes hot-load. Ignore both lines, do not repeat them to the user as a
next step, and verify instead by re-reading `openclaw ocuclaw journey` a few
seconds later. The CLI does not know what kind of host it is on; the journey's
`host` block does.

One more surface quirk: the host approval modal for a plugin command opens with
the cursor on **Deny**, not on Allow. Tell the user to move the selection to
**Allow once** before pressing Enter. A user who presses Enter on the modal as
it appears denies the command and sees a refusal that looks like a plugin bug.

Killing the gateway process restarts the whole container. PID 1 respawns it.
SSH drops for about 2 seconds and comes back in about 20. The home directory
persists; background processes do not. The plugin's supervisor restores
`tailscaled` on the way back up. Reconnect with the same Cloudways SSH
command; nothing is lost.

The sanctioned restart on this host is the Cloudways dashboard restart.
Ending the gateway process is acceptable only if the user accepts the SSH
drop first.

These all hot-reload with no restart: a fresh `openclaw plugins install
<tgz>`, `openclaw config set ...`, and plugin uninstall. On 2026.9.5 a
reload takes about a minute before OcuClaw answers again (see above). The one
case that needs a container restart is an upgrade over an existing install
(`openclaw plugins install --force <tgz>`): the old code stays live until the
container restarts.

After any restart (dashboard or forced), run
`openclaw ocuclaw cloudways status --wait 120 --json` before probing the
route.

## Disable, enable, rollback

- `openclaw ocuclaw cloudways disable --json`: flip the supervisor's enabled
  flag off and stop the daemon. The node goes offline; nothing is removed.
- `openclaw ocuclaw cloudways enable --json`: flip the flag back on.
- `openclaw ocuclaw cloudways rollback --yes --json`: remove only what this
  install created (daemon, binaries, receipt, OcuClaw's Serve route). The
  Tailscale identity in `~/.tailscale` is kept unless `--purge-identity` is
  added, so a later `install` comes back `running` without a new
  authorization. Without `--yes` it refuses. Rollback is a checkpoint; never
  run it unasked.
- Removing the plugin too, after rollback: `openclaw plugins uninstall
  ocuclaw --force`, then `openclaw config unset plugins.entries.ocuclaw`
  (rollback prints both). OpenClaw 2026.9's uninstall leaves
  `plugins.entries.ocuclaw.enabled=false`; without the unset a later install
  stays off and `openclaw ocuclaw cloudways setup` fails at once with
  OpenClaw's own message (troubleshooting case PLUGIN-OFF-AFTER-REINSTALL).
