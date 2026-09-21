import { classifyConfiguredRelayCredential } from "./relay-credential-provision.js";
import { readPrivateRoute } from "./setup-live.js";
import { runPairingTerminal } from "./pairing-terminal.js";
import { compatibilityStatus } from "./setup-controller.js";

import process from "node:process";

export const TERMINAL_PAIRING_HOST_REQUIREMENT =
  "an OpenClaw host inside the plugin's declared compatibility window (2026.6.9 or newer) with Node 20+; the recommended candidate is OpenClaw 2026.9.4 with Node 24.16+ within 24.x or 26.1+";

export function terminalPairingCapability(api     ) {

  if (api?.registrationMode === "cli-metadata") return "unavailable";
  const supported = compatibilityStatus(api?.runtime?.version ?? "") === "compatible";
  return supported && typeof api?.registerCli === "function" &&
    typeof api?.runtime?.config?.current === "function" &&
    typeof api?.runtime?.state?.resolveStateDir === "function"
    ? "available" : "unavailable";
}

export function createTerminalPairingCommand(api     , controller     , deps      = {}) {
  return async function pair(options      = {}, io      = {}) {
    const input = io.input ?? process.stdin;
    const output = io.output ?? process.stdout;
    const error = io.error ?? process.stderr;
    const refuse = (reason        ) => {
      error.write(`${reason}\nRun openclaw ocuclaw journey to resolve the missing checkpoint, then retry openclaw ocuclaw pair. Existing credentials and phones were preserved.\n`);
      return { exitCode: 2, outcome: "preflight-refused" };
    };
    if (!input.isTTY || !output.isTTY) return refuse("Pairing requires your own interactive terminal; piped input/output cannot approve.");
    if (terminalPairingCapability(api) !== "available") return refuse(`This host cannot run the terminal pairing lane. It needs ${TERMINAL_PAIRING_HOST_REQUIREMENT}.`);
    let credential                    ;
    try {
      const journey = await controller("journey", { surface: "cli" });
      if (!journey?.installation?.id || journey.capabilities?.pairing !== "available") return refuse("The owning installation and pairing capability could not be verified.");
      const required = ["verify-plugin", "verify-host", "configure-host", "verify-relay", "verify-private-route"];
      if (required.some((id) => !journey.checkpoints?.some((c     ) => c.id === id && c.status === "complete"))) return refuse("The owning gateway has an incomplete prerequisite.");
      const live = api.runtime.config.current();
      const classified = classifyConfiguredRelayCredential(live);

      if (classified === "absent" || classified === "empty") return refuse("OcuClaw is installed but your agent has not loaded it yet, so there is nothing for a phone to pair with. Make sure it is enabled (openclaw plugins enable ocuclaw) and the gateway has started it, then run openclaw ocuclaw doctor.");
      if (classified !== "present") return refuse("The current credential is unreadable or ambiguous. Repair plugins.entries.ocuclaw.config.relayToken through an operator-owned OpenClaw surface; nothing was changed.");
      credential = live.plugins.entries.ocuclaw.config.relayToken;
      const port = journey.currentHealth?.privateRoute?.relay?.port;
      let phoneAddress                    ;
      const route = await (deps.readPrivateRoute ?? readPrivateRoute)(port, {
        installation: journey.installation,
        onVerifiedAddress: (address        ) => { phoneAddress = address; },
      });
      if (route?.status !== "healthy" || route?.ownership?.status !== "owned" || !phoneAddress) return refuse("The private phone route is not freshly verified and owned by this installation.");
      return await (deps.runTerminal ?? runPairingTerminal)({
        port, relayCredential: credential, phoneAddress,
        installationId: journey.installation.id, lightTerminal: options.lightTerminal === true,
      }, { ...io, input, output, error });
    } catch (_) {

      return refuse("Pairing could not verify or contact this installation safely.");
    } finally {
      credential = undefined;
    }
  };
}
