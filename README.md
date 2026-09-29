<p align="center">
  <img src="https://raw.githubusercontent.com/ocuclaw/ocuclaw-openclaw-plugin/main/assets/og-card.png" alt="OcuClaw: your agent lives on your glasses. The phone stays in your pocket." width="760">
</p>

# OcuClaw for OpenClaw

Your OpenClaw agent on your Even Realities G2 smart glasses.

```bash
openclaw plugins install clawhub:ocuclaw
```

Answer `y` if the install asks you to confirm. Then ask your agent to
**set up OcuClaw**. On a Cloudways managed host, run
`openclaw ocuclaw cloudways setup` instead. Install, update and uninstall
steps are in [package/README.md](package/README.md).

[Website](https://ocuclaw.com) · [Setup guide](https://ocuclaw.com/setup) · [Discord](https://discord.ocuclaw.com)

Using Hermes Agent? Use [OcuClaw for Hermes](https://github.com/ocuclaw/ocuclaw).

Stuck? Ask your agent to run the OcuClaw doctor, use **Report a bug** in the
OcuClaw app, or ask on [Discord](https://discord.ocuclaw.com).

## About this repository

This repository holds the published files for OcuClaw 2.1.2.
OcuClaw is a community package, not an official or bundled OpenClaw plugin.

- `package/` is the plugin, byte for byte as published.
- `artifact/ocuclaw-2.1.2.tgz` is the exact tarball.
- `.github/workflows/` checks that the two match before it publishes to ClawHub.

ClawHub source attribution ties each release to this repository's commit and
`package/`. A clean scan means ClawHub's scanner accepted that exact artifact;
check its current status on [ClawHub](https://clawhub.ai/ocuclaw/plugins/ocuclaw).
