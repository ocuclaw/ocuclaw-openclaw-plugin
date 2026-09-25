# OcuClaw OpenClaw plugin 2.1.0

This public repository is the release-artifact mirror for the OcuClaw community package.
It is not an official or bundled OpenClaw plugin.

- `package/` is the source-linked, byte-identical extraction of the retained npm
  artifact.
- `artifact/ocuclaw-2.1.0.tgz` is the exact tarball validated for npm and
  ClawHub.
- `.github/workflows/clawhub-package-publish.yml` verifies those two forms agree
  before running ClawHub's commit-pinned package workflow.

ClawHub source attribution binds a release to this repository, its immutable
commit, and `package/`. A clean scan means ClawHub's scanner accepted that exact
published artifact; it does not confer official OpenClaw status. Check the
package's current moderation status on ClawHub rather than inferring it from
this repository.
