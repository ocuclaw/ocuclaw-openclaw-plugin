import { OCUCLAW_SETUP_OPERATIONS } from "./setup-controller.js";
import {
  MAX_RELAY_PORT,
  MIN_RELAY_PORT,
  SET_RELAY_PORT_OPERATION,
  validateRelayPortMutationParams,
} from "./relay-port-mutation.js";

export const OCUCLAW_SETUP_TOOL_OPERATIONS = Object.freeze([
  ...OCUCLAW_SETUP_OPERATIONS,
  SET_RELAY_PORT_OPERATION,
]);

export const ocuClawSetupParametersSchema = {
  type: "object",
  properties: {
    operation: { type: "string", enum: [...OCUCLAW_SETUP_TOOL_OPERATIONS] },
    expectedCurrentPort: {
      type: "integer",
      minimum: MIN_RELAY_PORT,
      maximum: MAX_RELAY_PORT,
    },
    newPort: {
      type: "integer",
      minimum: MIN_RELAY_PORT,
      maximum: MAX_RELAY_PORT,
    },
  },
  required: ["operation"],
  additionalProperties: false,
};

const OPERATIONS = new Set(OCUCLAW_SETUP_OPERATIONS);

export function registerOcuClawSetupTool(api, controller, setRelayPort) {
  if (!api || typeof api.registerTool !== "function") {
    throw new Error("registerOcuClawSetupTool requires api.registerTool");
  }
  if (typeof controller !== "function") {
    throw new Error("registerOcuClawSetupTool requires the setup controller");
  }

  api.registerTool(
    {
      name: "ocuclaw_setup",
      description:
        "Inspect redacted OcuClaw setup state or request one approved, bounded relay-port change.",
      parameters: ocuClawSetupParametersSchema,
      async execute(_toolCallId, params) {
        if (params?.operation === SET_RELAY_PORT_OPERATION) {
          validateRelayPortMutationParams(params);
          if (typeof setRelayPort !== "function") {
            const err = new Error("unsupported_host: relay-port mutation is unavailable");
            err.code = "unsupported_host";
            throw err;
          }
          const receipt = await setRelayPort(params);
          return {
            content: [{ type: "text", text: JSON.stringify(receipt) }],
          };
        }
        if (
          !params ||
          typeof params !== "object" ||
          Array.isArray(params) ||
          !OPERATIONS.has(params.operation) ||
          Object.keys(params).some((key) => key !== "operation")
        ) {
          const err = new Error(
            `invalid_input: operation must be one of ${OCUCLAW_SETUP_TOOL_OPERATIONS.join(", ")}`,
          );
          err.code = "invalid_input";
          throw err;
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(await controller(params.operation, { surface: "tool" })),
            },
          ],
        };
      },
    },

  );
}
