<p align="center">
  <img src="https://raw.githubusercontent.com/ocuclaw/ocuclaw-openclaw-plugin/main/assets/og-card.png" alt="OcuClaw: your agent lives on your glasses. The phone stays in your pocket." width="760">
</p>

# OcuClaw

Your OpenClaw agent on your Even Realities G2 smart glasses.

[Website](https://ocuclaw.com) · [Setup guide](https://ocuclaw.com/setup) · [Discord](https://discord.ocuclaw.com)

Using Hermes Agent? Use [OcuClaw for Hermes](https://github.com/ocuclaw/ocuclaw).

## Requirements

- Even Realities G2 smart glasses and the OcuClaw app from Even Hub.
- OpenClaw 2026.7.1-2 or newer.
- Tailscale on your phone and on the OpenClaw host. On Cloudways, setup
  installs the host part for you.

## Install

```bash
openclaw plugins install clawhub:ocuclaw
```

On OpenClaw 2026.9 and later the install asks you to confirm (`y/N`).
OcuClaw lets your agent draw on the glasses display, read glasses and device
state, read your phone's location when you turn it on in the app, and run
setup. Answer `y` to install. ClawHub may ask twice.

Then ask your agent to **set up OcuClaw**. It pairs your phone and checks each
step. On a Cloudways managed host, run `openclaw ocuclaw cloudways setup`
instead.

Installing again after an uninstall? OpenClaw 2026.9 may keep OcuClaw
switched off. If a command says `plugins.entries.ocuclaw.enabled=false`, run
`openclaw plugins enable ocuclaw`, then try again.

## Update

```bash
openclaw plugins update ocuclaw
```

Installed from npm, or without the `clawhub:` prefix? Use
`openclaw plugins update ocuclaw@latest`. Not sure?
`openclaw plugins inspect ocuclaw --json` shows `install.source`.

## Uninstall

On Cloudways, run `openclaw ocuclaw cloudways rollback --yes` first. Then:

```bash
openclaw plugins uninstall ocuclaw
openclaw config unset plugins.entries.ocuclaw
```

The second line clears the switched-off entry OpenClaw 2026.9 leaves behind,
so a later install starts switched on. On older OpenClaw it says
`Config path not found`. That is fine: there was nothing to clear.

On other hosts, also turn off the Tailscale routes setup made for OcuClaw
(use `sudo` on Linux and macOS). Check `tailscale serve status` and skip any
route you did not make for OcuClaw:

```bash
tailscale serve --tls-terminated-tcp=8444 off
tailscale serve --https=8443 off   # only if you set up Even AI
```

## Help

Stuck? Ask your agent to run the OcuClaw doctor, use **Report a bug** in the
OcuClaw app, or ask on [Discord](https://discord.ocuclaw.com).

Settings, voice keys, Even AI and diagnostics are in the
[configuration reference](https://github.com/ocuclaw/ocuclaw-openclaw-plugin/blob/main/package/CONFIGURATION.md).

## About this package

On your host, OcuClaw runs a private relay for the phone, protected by a
credential it generates. Optional voice and Even AI keys are stored on this
host. Cloudways setup downloads Tailscale into `~/bin` with your consent and
keeps the relay on your private Tailscale network.

OcuClaw is a community package, not an official or bundled OpenClaw plugin.
ClawHub releases carry source attribution to
[ocuclaw/ocuclaw-openclaw-plugin](https://github.com/ocuclaw/ocuclaw-openclaw-plugin).
Check the clean scan status on [ClawHub](https://clawhub.ai/ocuclaw/plugins/ocuclaw).
