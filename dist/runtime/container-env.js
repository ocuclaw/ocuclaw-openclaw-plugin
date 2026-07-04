import fs from "node:fs";

const CONTAINER_MARKER_PATHS = ["/.dockerenv", "/run/.containerenv"];

export function isLoopbackBindAddress(address) {
  const normalized = typeof address === "string" ? address.trim().toLowerCase() : "";
  if (!normalized) return false;
  return (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized.startsWith("127.")
  );
}

export function isContainerEnvironment(deps = {}) {
  const existsSync = typeof deps.existsSync === "function" ? deps.existsSync : fs.existsSync;
  const markerPaths = Array.isArray(deps.markerPaths) ? deps.markerPaths : CONTAINER_MARKER_PATHS;
  for (const markerPath of markerPaths) {
    try {
      if (existsSync(markerPath)) return true;
    } catch {

    }
  }
  return false;
}

export function composeContainerLoopbackWarning(wsBind, wsPort) {
  return (
    `[ocuclaw] relay is bound to ${wsBind} inside a container — if the OcuClaw app cannot connect, this is likely why. ` +
    `Connections from outside the container arrive via its network interface, which a loopback bind does not listen on, ` +
    `so the relay is unreachable even though it reports healthy. ` +
    `(Containers run with --network host are unaffected and can ignore this warning.) ` +
    `Fix: openclaw config set plugins.entries.ocuclaw.config.wsBind "0.0.0.0" ` +
    `and publish the relay port to the host loopback only (-p 127.0.0.1:${wsPort}:${wsPort}), then restart the gateway.`
  );
}
