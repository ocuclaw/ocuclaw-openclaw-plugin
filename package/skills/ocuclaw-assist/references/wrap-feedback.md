# OcuClaw wrap-up & feedback

**Guide version:** 2026-09-25 (1.0.58)

Load this only at a genuine finish — fresh install, update, rollback, or a
standalone fix completed. Never after an unresolved failure or an ESCALATE. If
you arrived here by mistake, return to the skill's SKILL.md.

---

A genuine finish delivers, **in order**, every item below — the summary, the
two addresses, the checklist self-audit, the optional security-audit offer,
the WRAP closing note, and the FEEDBACK bundle. Do not end the session with
any of them missing; if the user interjects with a question, answer it and
resume at the first undelivered item. One ordering exception, deliberately:
the WRAP note's donation line is the **very last line of the wrap message** —
it comes after the FEEDBACK ask, and nothing follows it.

**No new probes at the wrap.** Run no command that probes the host, the route
or the tailnet for any wrap item: no `tailscale`, `openclaw`, `curl` or other
network check. Take every fact from results already in this chat or from an
`ocuclaw_setup` call. A probe at the wrap can raise an exec approval, and that
approval shows on the glasses at the very end of setup. Reading this skill's
own files is fine. If an address or version was never observed, write
`unknown`. The optional security audit runs only after the user says yes to it.

Briefly tell the user what was installed and configured: the OcuClaw plugin, the relay token, the Tailscale serve routes, the phone app, and any optional integrations (Soniox, Even AI) that were completed.

Give them their two addresses and ask them to **save these somewhere**:

| What | Address |
|---|---|
| OcuClaw app relay address | `wss://<node>.<tailnet>.ts.net:8444` |
| Even AI agent URL (if set up) | `https://<node>.<tailnet>.ts.net:8443/v1/chat/completions` |

The relay address in particular — they will need it to reconnect the app on a new phone or after a reinstall.

**Self-audit — re-show the setup checklist in its final state:**

Display the setup checklist from SKILL.md in its final state, with completed,
declined, deferred or blocked states. The extended wrap is optional; tick it when
delivered, never turn it into a core requirement.

**A tick needs its evidence quoted.** Beside each ticked box, quote the result
you actually read — the Step 5 `journey` result for the tool-policy and load
boxes, and Step 10's `replyEvidence` plus `confirmationSource` for the
first-reply box. If you cannot quote the evidence for a box, mark it
`[unverified]` instead of ticking it. A plan, a command you issued, or a
remembered earlier turn is not evidence.

For an older bundle, label the
manual phone/G2 check and unavailable durable receipt truthfully. A later outage
is a recovery item, not a reason to erase or repeat completed setup.

**Optional security check:** offer to run `openclaw security audit` (read-only) — setup changed network surfaces (serve routes; on container installs, the relay bind). Read any findings to the user in plain words; fixes are their call.

Then deliver the WRAP closing note (below), once, warmly, in your own words.

---

## WRAP — closing note

Deliver this once, warmly, in your own words — only at a genuine finish: a fresh install reaching Step 13, a completed U1 or B1, or a resolved standalone fix. Never after a failure or an ESCALATE. Keep the three links exact.

- **Community** — point them at the Discord (`https://discord.ocuclaw.com`): setup help, troubleshooting, feature requests, bug reports, beta chatter, and general community. Encourage them to join and report anything that bit them.
- **Reporting future problems** — deliver this line VERBATIM (both quoted sentences exactly as written; a heading label of your own above them is fine), warmly, without permission names or flag mechanics: "For future bug reports, ask me to enable debug. OcuClaw has a comprehensive bug reporting system that will lead to quick bug fixes." If a debug upload was already sent during this session, remind them to include its ticket reference in any Discord post. (Agent reference, NOT recited at the wrap — "enable debug" means the two host permissions: `externalDebugToolsEnabled` permits bounded diagnostic capture, preview, cache, and local save; `allowDebugUpload` separately permits full-bundle handoff to the phone for user-initiated upload. Both on, then OcuClaw app → Settings → **Client Debug Enabled** → yellow bug icon → **Send Bug Report**; the user posts the returned `OCU-…` ticket reference in Discord. If they declined Step 12b, local diagnostics may still be enabled independently — check both permissions rather than assuming both are off.)
- **Feedback** — run the **FEEDBACK** bundle (below): ask how the setup assistant flow felt for them, in their own words, and name the optional feedback form at `https://ocuclaw.com/setup` — sharing it would be greatly appreciated: it's how this assistant improves for future users. The paste block itself is NOT part of the wrap message — it renders exactly once, merged, in your reply AFTER they answer (FEEDBACK step 3 below).
- **Donation line — the very last line of the wrap message, with nothing after it.** Deliver it verbatim:

  > Finally, OcuClaw is a one man project. Donations are optional but appreciated and directly funds the project: https://buymeacoffee.com/ocuclaw

---

## FEEDBACK — setup assistant flow feedback bundle

Run this at **every genuine finish** — fresh install, update, rollback, or a resolved standalone fix. Goal: the user's own words first, then a clean paste block. This is feedback for the **setup assistant flow** — how being walked through it felt — not a review of the written guide.

1. **Ask the user first:** how did the setup assistant flow feel — smooth, a few bumps, or rough? Anything confusing, surprising, or they'd change? Their words are the most valuable part.
2. **Add your own notes:** where the user got stuck or re-asked; anything unclear, out of order, wrong, missing, slow, or platform-specific; where you improvised.
3. **Render the block exactly once, in your reply AFTER they answer.** The wrap message carries the ask and the form link only — never the block itself: a placeholder render followed by a merged re-render duplicates a screenful, and a block shown before they answer pre-empts the question you just asked. When they answer (even one line), merge their words and your notes into the block below, show it that one time, and confirm together it contains **no secrets or network details** (setup-assistant experience only — no tokens, no addresses, no node name; the OpenClaw and plugin version lines are fine — versions carry no secrets). If they decline or move on without answering, the block simply never renders — it is optional. Fill the version lines yourself from evidence already recorded this session (the typed `journey` or `overview` `compatibility.hostOpenClaw` — or, with no controller lane, the state assessment's `openclaw --version` — the controller `plugin.version`, and — for the app line — `runtime.appClientVersion` from any typed verify or overview recorded while the phone was connected; Step 9's host-side confirmation already carries it) — never run new probes at the wrap for them; if one was somehow never observed, write `unknown`. Then invite them to paste it into the feedback form at `https://ocuclaw.com/setup` — sharing it would be greatly appreciated: it directly improves this assistant for future users.

**Copy-paste block for the feedback form at `https://ocuclaw.com/setup`:**
```
OcuClaw setup assistant feedback — guide 2026-09-25 (1.0.58)
Platform: <OS only, e.g. macOS / Windows 11 / Ubuntu>
OpenClaw version: <e.g. 2026.7.1>
OcuClaw plugin version: <e.g. 1.3.4>
OcuClaw app version: <e.g. 1.3.4 — the phone app's own version>
Outcome: <fully set up / set up with help / fixed / updated / stopped at step __>
Steps done: <install · update/rollback · Tailscale · app connect · Soniox · Even AI · fix: __>
How it felt (your words): <smooth / a few bumps / rough — plus anything you'd change>
Where it snagged (assistant's notes): <unclear/wrong/slow steps, or where I improvised>
Suggestions: <anything to change>
```
