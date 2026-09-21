import {
  classifyConfiguredRelayCredential,
  describeRelayCredentialAmbiguity,
  PROVISION_RELAY_CREDENTIAL_OPERATION,
} from "./relay-credential-provision.js";

export const MINT_ON_LOAD_AFTER_WRITE = Object.freeze({
  mode: "none",
  reason: "OcuClaw relay credential minted at plugin load and adopted in-process",
});

export const RELAY_CREDENTIAL_ORIGIN = Object.freeze({
  PRE_EXISTING: "pre-existing",
  HOST_MINTED_AT_LOAD: "host-minted-at-load",
});

export const MINT_ON_LOAD_STATUS = Object.freeze({
  MINTED: "minted",
  ADOPTED_EXISTING: "adopted-existing",
  SKIPPED: "skipped",
  FAILED: "failed",
});

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function readLiveRelayCredential(api) {
  const runtimeConfig = api?.runtime?.config;
  if (!runtimeConfig || typeof runtimeConfig.current !== "function") return null;
  let live;
  try {
    live = runtimeConfig.current();
  } catch (_) {
    return null;
  }
  if (classifyConfiguredRelayCredential(live) !== "present") return null;
  return live.plugins.entries.ocuclaw.config.relayToken;
}

function outcome(status, fields = {}) {
  return {
    status,
    origin: null,
    code: null,
    detail: null,
    ...fields,
  };
}

export function mintOnLoadSupported(api) {
  const runtimeConfig = api?.runtime?.config;
  return !!runtimeConfig &&
    typeof runtimeConfig.current === "function" &&
    typeof runtimeConfig.mutateConfigFile === "function";
}

export function createRelayCredentialMintOnLoad(api, deps = {}) {
  const provision = isRecord(deps) && typeof deps.provision === "function" ? deps.provision : null;
  return async function mintRelayCredentialAtLoad() {
    if (!mintOnLoadSupported(api) || !provision) {
      return outcome(MINT_ON_LOAD_STATUS.SKIPPED, {
        code: "unsupported_host",
        detail:
          "this OpenClaw host does not expose the config mutation contract the plugin needs to mint a relay credential at load",
      });
    }
    let live;
    try {
      live = api.runtime.config.current();
    } catch (_) {
      return outcome(MINT_ON_LOAD_STATUS.SKIPPED, {
        code: "config_unreadable",
        detail:
          "OpenClaw could not read its current configuration, so the relay credential state could not be verified; nothing was written",
      });
    }
    const classified = classifyConfiguredRelayCredential(live);
    if (classified === "present") {

      return outcome(MINT_ON_LOAD_STATUS.ADOPTED_EXISTING, {
        origin: RELAY_CREDENTIAL_ORIGIN.PRE_EXISTING,
        code: "credential-configured-since-boot",
        credential: live.plugins.entries.ocuclaw.config.relayToken,
      });
    }
    if (classified === "ambiguous") {

      return outcome(MINT_ON_LOAD_STATUS.SKIPPED, {
        code: "ambiguous_existing_credential",
        detail:
          `the OcuClaw configuration branch cannot be assessed: ${
            describeRelayCredentialAmbiguity(live) ??
            "the shape of the OcuClaw configuration branch could not be assessed"
          }; repair it through an operator-owned OpenClaw surface. Nothing was written and no credential was replaced.`,
      });
    }

    let receipt;
    try {
      receipt = await provision({ operation: PROVISION_RELAY_CREDENTIAL_OPERATION });
    } catch (err) {
      const code = typeof err?.code === "string" ? err.code : "mint_failed";
      if (code === "stale_precondition") {

        const raced = readLiveRelayCredential(api);
        if (raced) {
          return outcome(MINT_ON_LOAD_STATUS.ADOPTED_EXISTING, {
            origin: RELAY_CREDENTIAL_ORIGIN.PRE_EXISTING,
            code: "credential-minted-by-concurrent-load",
            credential: raced,
          });
        }
      }

      return outcome(MINT_ON_LOAD_STATUS.FAILED, {
        code,
        detail: typeof err?.message === "string" ? err.message : String(err),
      });
    }
    if (receipt && receipt.status === "preserved") {
      const present = readLiveRelayCredential(api);
      if (present) {
        return outcome(MINT_ON_LOAD_STATUS.ADOPTED_EXISTING, {
          origin: RELAY_CREDENTIAL_ORIGIN.PRE_EXISTING,
          code: "credential-configured-since-boot",
          credential: present,
        });
      }
    }

    const minted = readLiveRelayCredential(api);
    if (!minted) {
      return outcome(MINT_ON_LOAD_STATUS.FAILED, {
        code: "verification_failed",
        detail:
          "the relay credential was reported written but the live OpenClaw configuration does not read it back; re-read setup state before assuming one is configured",
      });
    }
    return outcome(MINT_ON_LOAD_STATUS.MINTED, {
      origin: RELAY_CREDENTIAL_ORIGIN.HOST_MINTED_AT_LOAD,
      code: "minted-at-load",
      credential: minted,
    });
  };
}
