import { parseOptionalTrimmedString } from "./downstream-parse-optional.js";
import { GLASSES_ACTIONS } from "./downstream-remote-control-glasses.js";
import { SESSION_ACTIONS } from "./downstream-remote-control-sessions.js";
import { SETTINGS_ACTIONS } from "./downstream-remote-control-settings.js";
import { AGENT_ACTIONS } from "./downstream-remote-control-agents.js";
import { HERMES_ACTIONS } from "./downstream-remote-control-hermes.js";
import { SILENT_INPUT_ACTIONS } from "./downstream-remote-control-silent-input.js";
import { SYSTEM_ACTIONS } from "./downstream-remote-control-system.js";
import { PAIRING_ACTIONS } from "./downstream-remote-control-pairing.js";

const ACTION_TABLES = [
  GLASSES_ACTIONS,
  SESSION_ACTIONS,
  SETTINGS_ACTIONS,
  AGENT_ACTIONS,
  HERMES_ACTIONS,
  SILENT_INPUT_ACTIONS,
  SYSTEM_ACTIONS,
  PAIRING_ACTIONS,
];

const ACTION_PARSERS = new Map                                   ();
for (const table of ACTION_TABLES) {
  for (const [name, parse] of Object.entries(table)) {
    if (!ACTION_PARSERS.has(name)) ACTION_PARSERS.set(name, parse);
  }
}

function parseRemoteControl(msg) {
  if (!msg || typeof msg !== "object") {
    throw new Error("remote-control payload must be an object");
  }
  const actionRaw = parseOptionalTrimmedString(msg.action);
  if (!actionRaw) {
    throw new Error("remote-control action is required");
  }

  const action = actionRaw.toLowerCase();
  const payload = {
    action,
    requestId: parseOptionalTrimmedString(msg.requestId) || null,
  };

  const parse = ACTION_PARSERS.get(action);
  if (parse) return parse(msg, payload, action);

  throw new Error(`unsupported remote-control action: ${actionRaw}`);
}

export { parseRemoteControl };
