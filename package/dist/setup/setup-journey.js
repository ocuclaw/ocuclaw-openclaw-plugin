import { createHash } from "node:crypto";
import { hostname } from "node:os";
import { resolve } from "node:path";

export function setupInstallation(stateDir) {
  return {
    backend: "openclaw",
    id: stateDir
      ? createHash("sha256")
          .update(JSON.stringify([hostname(), process.getuid?.() ?? null, resolve(stateDir)]))
          .digest("hex")
      : null,
    evidence: stateDir ? "host-state-namespace" : "unknown",
  };
}

export function setupJourney(state, installation, route = null) {
  const configured = state.configuration.issueIds.length === 0 &&
    state.secrets.relayToken.presence === "present" &&
    state.secrets.gatewayToken.presence === "present";
  const unavailableEvidence = { status: "unknown", evidence: "not-observable-by-controller" };
  const checkpoints = [
    {
      id: "verify-plugin", status: state.plugin.enabled === false ? "disabled"
        : state.plugin.status === "loaded" ? "complete" : "unknown",
      reason: state.plugin.enabled === false ? "plugin-disabled" : "plugin-load-unverified",
      action: "Use the existing bootstrap or plugin recovery checks to verify OcuClaw is enabled and loaded in this host.",
    },
    {
      id: "verify-host", status: state.compatibility.status === "compatible" ? "complete" : state.compatibility.status,
      reason: "host-compatibility-unverified",
      action: "Verify the supported OpenClaw host version before continuing.",
    },
    {
      id: "configure-host", status: configured ? "complete" : "incomplete",
      reason: state.configuration.status === "invalid" ? "invalid-required-configuration" : "missing-required-configuration",
      action: "Use the existing setup or recovery guide to resolve required configuration; preserve existing credentials.",
    },
    {
      id: "verify-relay", status: state.runtime.status === "running" ? "complete" : state.runtime.status,
      reason: `relay-${state.runtime.status}`,
      action: state.runtime.status === "starting"
        ? "Inspect the gateway log for the pending relay bind before requesting another restart."
        : "Verify the relay in the owning gateway; use the existing gateway recovery path if it is unavailable.",
    },
    {
      id: "verify-private-route", status: route?.status === "healthy" ? "complete" : route?.status ?? "unknown", reason: route?.evidence ?? "private-route-evidence-unavailable",
      action: "Use the existing private-route checks to resolve the exact live route; inspect ownership before proposing any change.",
    },
    {
      id: "pair-phone", status: "unavailable", reason: "pairing-operation-unavailable",
      action: "Controller pairing is not implemented; use the existing pairing guide and retain its human approval gate.",
    },
    {
      id: "phone-origin-proof", status: "unavailable", reason: "first-use-operation-unavailable",
      action: "First-use recording is not implemented; a connected phone is not a wearer-confirmed G2 reply.",
    },
    {
      id: "welcome", status: "unavailable", reason: "welcome-operation-unavailable",
      action: "Welcome completion cannot be recorded by this controller yet.",
    },
  ];
  const next = checkpoints.find((checkpoint) => checkpoint.status !== "complete");
  return {
    schemaVersion: 1,
    operation: "journey",
    observedAt: new Date().toISOString(),
    installation,
    capabilities: state.capabilities,
    durableFacts: {
      requiredConfiguration: {
        status: configured ? "complete" : "incomplete",
        evidence: "current-owning-host-configuration",
        validation: state.configuration,
      },
      installation: state.plugin.install,
      relayCredential: state.secrets.relayToken,
      securePairing: unavailableEvidence,
    },
    currentHealth: {
      relay: state.runtime.status,
      relayEvidence: state.runtime.statusEvidence,
      phone: state.runtime.appClientConnected === null ? "unknown"
        : state.runtime.appClientConnected ? "connected" : "disconnected",
      privateRoute: route ?? unavailableEvidence,
    },
    firstUse: {
      status: "unknown", evidence: "first-use-receipts-not-implemented",
      phoneOriginRoundTrip: "unknown", wearerConfirmedG2Reply: "unknown", welcome: "unknown",
    },
    checkpoints,
    nextCheckpoint: next,
    outcome: "incomplete",
    failureReason: next?.reason ?? "checkpoint-evidence-unavailable",
    coreComplete: false,
    mutationPerformed: false,
    receiptPolicy: "observation-only-recheck-owning-host-on-every-call",
  };
}
