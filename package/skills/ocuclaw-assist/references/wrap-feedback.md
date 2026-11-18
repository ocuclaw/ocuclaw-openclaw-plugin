# OcuClaw wrap-up & feedback

**Guide version:** 2026-10-28 (1.0.60)

Load this only at a genuine finish — fresh install, update, rollback, or a
standalone fix completed. Never after an unresolved failure or an ESCALATE. If
you arrived here by mistake, return to the skill's SKILL.md.

---

A genuine finish delivers, **in order**, every item below — the summary, the
two addresses, the checklist self-audit, the optional security-audit offer,
and the WRAP closing note. Do not end the session with
any of them missing; if the user interjects with a question, answer it and
resume at the first undelivered item. One ordering exception, deliberately:
the WRAP note's donation line is the **very last line of the wrap message** —
it comes after the feedback line, and nothing follows it.

**No new probes at the wrap.** Run no command that probes the host, the route
or the tailnet for any wrap item: no `tailscale`, `openclaw`, `curl` or other
network check. Take every fact from results already in this chat or from an
`ocuclaw_setup` call. A probe at the wrap can raise an exec approval, and that
approval shows on the glasses at the very end of setup. Reading this skill's
own files is fine. If you name versions, take OpenClaw's from the typed `journey`
or `overview` `compatibility.hostOpenClaw` and the plugin's from the controller
`plugin.version`. If an address or version was never observed, write
`unknown`. The optional security audit runs only after the user says yes to it.

**Read `journey` first.** Before the summary, call `ocuclaw_setup` with
`{"operation":"journey"}` once. It is a typed read, not a probe. Quote its
`coreComplete`, `replyEvidence` and `confirmationSource` for the checklist
below. Only when the typed tool is not callable here, use the latest `journey`
result already in this chat. Never mark a box `[unverified]` for evidence this
one read would have given.

Briefly tell the user what was installed and configured: the OcuClaw plugin, the relay token, the Tailscale serve routes, the phone app, and any optional integrations (Even AI, or Soniox if they asked for it) that were completed.

Give them their two addresses and ask them to **save these somewhere**:

| What | Address |
|---|---|
| OcuClaw app relay address | `wss://<node>.<tailnet>.ts.net:8444` |
| Even AI agent URL (if set up) | `https://<node>.<tailnet>.ts.net:8443/v1/chat/completions` |

The relay address in particular — they will need it to reconnect the app on a new phone or after a reinstall.

**Self-audit — re-show the setup checklist in its final state:**

Display the setup checklist from guided-setup.md in its final state, with completed,
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

Deliver this once, warmly, in your own words — only at a genuine finish: a fresh install reaching Step 13, a completed U1 or B1, or a resolved standalone fix. Never after a failure or an ESCALATE. Keep the two links exact.

- **Community** — point them at the Discord (`https://discord.ocuclaw.com`): setup help, troubleshooting, feature requests, bug reports, beta chatter, and general community. Encourage them to join and report anything that bit them.
- **Reporting future problems** — deliver this line VERBATIM (both quoted sentences exactly as written; a heading label of your own above them is fine), warmly, without permission names or flag mechanics: "For future bug reports, ask me to enable debug. OcuClaw has a comprehensive bug reporting system that will lead to quick bug fixes." If a debug upload was already sent during this session, remind them to include its ticket reference in any Discord post. (Agent reference, NOT recited at the wrap — "enable debug" means the two host permissions: `externalDebugToolsEnabled` permits bounded diagnostic capture, preview, cache, and local save; `allowDebugUpload` separately permits full-bundle handoff to the phone for user-initiated upload. Both on, then OcuClaw app → Settings → **Client Debug Enabled** → yellow bug icon → **Send Bug Report**; the user posts the returned `OCU-…` ticket reference in Discord. If they declined Step 12b, local diagnostics may still be enabled independently — check both permissions rather than assuming both are off.)
- **Feedback** — tell them the team reads every note sent with **Submit feedback** in the OcuClaw app's ⋯ menu: ideas, anything confusing, translation errors, or how this setup felt. Replies come back in the app. Sharing how setup went there would be greatly appreciated: it's how this assistant improves for future users. No paste block and no website form; do not draft the note for them.
- **Donation line — the very last line of the wrap message, with nothing after it.** Deliver it verbatim:

  > Finally, OcuClaw is a one man project. Donations are optional but appreciated and directly funds the project: https://buymeacoffee.com/ocuclaw
