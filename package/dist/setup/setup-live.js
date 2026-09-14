import { execFile } from "node:child_process";
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const JOURNEY_METHOD = "ocuclaw.setup.journey";

export function registerSetupJourneyReader(api     , controller     ) {
  if (api?.registrationMode !== "full" || typeof api.registerGatewayMethod !== "function") return;
  api.registerGatewayMethod(JOURNEY_METHOD, async ({ params, respond }     ) => {
    const result = await controller("journey");
    if (!result.installation.id || params?.installationId !== result.installation.id) {
      respond(false, undefined, { code: "INVALID_REQUEST", message: "setup installation context does not match" });
      return;
    }
    respond(true, result);
  }, { scope: "operator.read" });
}

export async function readLiveSetupJourney(local     ) {
  if (!local.installation.id) return local;
  try {

    const sdkName = "openclaw/plugin-sdk/gateway-runtime";

    const sdk = await import(sdkName).catch(() => {
      const hostRequire = createRequire(realpathSync(process.argv[1]));
      return import(pathToFileURL(hostRequire.resolve(sdkName)).href);
    });
    if (typeof sdk.callGatewayFromCli !== "function") return local;
    const result = await sdk.callGatewayFromCli(JOURNEY_METHOD,
      { timeout: "3000", json: true }, { installationId: local.installation.id },

      { scopes: ["operator.read"], progress: false, clientName: "gateway-client", mode: "backend", deviceIdentity: null });
    if (result?.operation !== "journey" || result?.installation?.id !== local.installation.id) return local;
    return result;
  } catch (_) {
    return local;
  }
}

function tailscaleJson(args     ) {
  return new Promise     ((resolve) => {
    execFile("tailscale", args, { timeout: 2000, maxBuffer: 256 * 1024, encoding: "utf8" }, (error     , stdout     ) => {
      if (error) { resolve(null); return; }
      try { resolve(JSON.parse(stdout)); } catch (_) { resolve(null); }
    });
  });
}

export async function readPrivateRoute(port     ) {
  const unavailable = { status: "unknown", evidence: "private-route-evidence-unavailable", ownership: "unknown" };
  if (!Number.isInteger(port)) return unavailable;
  const [status, node] = await Promise.all([
    tailscaleJson(["serve", "status", "--json"]), tailscaleJson(["status", "--json"]),
  ]);
  if (!status || !node) return unavailable;
  if (typeof node.BackendState !== "string" || typeof node.Self?.Online !== "boolean") return unavailable;
  if (!["Running", "Stopped", "NeedsLogin", "NeedsMachineAuth"].includes(node.BackendState)) return unavailable;
  if (node.BackendState !== "Running" || node.Self?.Online !== true) {
    return { ...unavailable, status: "failed", evidence: "private-network-offline" };
  }
  try {
    const entries = Object.entries(status.TCP || {});
    const matching = entries.filter(([listenPort, value]     ) =>
      /^\d+$/.test(listenPort) && Number(listenPort) > 0 && Number(listenPort) <= 65535 &&
      value?.TCPForward === `127.0.0.1:${port}` &&
      typeof value.TerminateTLS === "string" && value.TerminateTLS.endsWith(".ts.net") &&
      value.TerminateTLS === String(node.Self?.DNSName ?? "").replace(/\.$/, ""));
    const funnel = Object.values(status.AllowFunnel || {}).some((enabled) => enabled === true);
    return {
      status: matching.length === 1 && !funnel ? "healthy" : "failed",
      evidence: matching.length === 1 && !funnel ? "live-private-tls-route-to-owning-relay" : "private-route-missing-or-ambiguous",

      ownership: "unknown",
    };
  } catch (_) { return unavailable; }
}
