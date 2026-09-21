import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createPrivateRouteReader } from "./private-route.js";
import { daemonSummary } from "./cloudways.js";

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

      { timeout: "12000", json: true }, { installationId: local.installation.id },

      { scopes: ["operator.read"], progress: false, clientName: "gateway-client", mode: "backend", deviceIdentity: null });
    if (result?.operation !== "journey" || result?.installation?.id !== local.installation.id) return local;
    return result;
  } catch (_) {
    return local;
  }
}

export const readPrivateRoute = createPrivateRouteReader();

export async function readTailnetDaemon() {
  try {
    return await daemonSummary();
  } catch (_) {
    return null;
  }
}
