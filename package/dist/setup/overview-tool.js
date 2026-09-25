import { OCUCLAW_SETUP_OPERATIONS } from "./setup-controller.js";
import { FIRST_USE_TOOL_OPERATIONS, FIRST_USE_WAIT_MAX_MS, validateFirstUseParams } from "./first-use.js";
import {
  MAX_RELAY_PORT,
  MIN_RELAY_PORT,
  SET_RELAY_PORT_OPERATION,
  validateRelayPortMutationParams,
} from "./relay-port-mutation.js";
import {
  PROVISION_RELAY_CREDENTIAL_OPERATION,
  validateProvisionRelayCredentialParams,
} from "./relay-credential-provision.js";

export const OCUCLAW_SETUP_TOOL_OPERATIONS = Object.freeze([
  ...OCUCLAW_SETUP_OPERATIONS,
  ...FIRST_USE_TOOL_OPERATIONS,
  SET_RELAY_PORT_OPERATION,
  PROVISION_RELAY_CREDENTIAL_OPERATION,
]);

export const ocuClawSetupParametersSchema = {
  type: "object",
  properties: {
    operation: { type: "string", enum: [...OCUCLAW_SETUP_TOOL_OPERATIONS] },
    binding: { type: "string", pattern: "^[a-f0-9]{64}$" },
    answer: { type: "string", enum: ["yes", "no"] },
    timeoutMs: { type: "integer", minimum: 0, maximum: FIRST_USE_WAIT_MAX_MS },
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

export function registerOcuClawSetupTool(
  api,
  controller,
  setRelayPort,
  provisionRelayCredential,
  firstUse = null,
  onContext = null,
) {
  if (!api || typeof api.registerTool !== "function") {
    throw new Error("registerOcuClawSetupTool requires api.registerTool");
  }
  if (typeof controller !== "function") {
    throw new Error("registerOcuClawSetupTool requires the setup controller");
  }

  api.registerTool(
    (ctx) => ({
      name: "ocuclaw_setup",
      description:
        "Inspect OcuClaw setup; request approved host configuration or tool-driven first use. first_use_begin arms a relay-run test and returns lines to say: say them as your final message and end your turn; the relay wakes this chat with the result. first_use_confirm records only the wearer's explicit answer about the bound reply; never infer it from machine health or a setup notification.",
      parameters: ocuClawSetupParametersSchema,
      async execute(_toolCallId, params, signal = null) {
        if (typeof onContext === "function") {
          try { onContext(ctx ?? null); } catch (_) {  }
        }
        if (FIRST_USE_TOOL_OPERATIONS.includes(params?.operation)) {
          validateFirstUseParams(params);
          const result = typeof firstUse === "function" ? await firstUse(params, signal, ctx ?? null)
            : { status: "unavailable", reason: "unsupported-host" };
          return { content: [{ type: "text", text: JSON.stringify(result) }] };
        }
        if (params?.operation === PROVISION_RELAY_CREDENTIAL_OPERATION) {
          validateProvisionRelayCredentialParams(params);
          if (typeof provisionRelayCredential !== "function") {
            const err = new Error(
              "unsupported_host: relay-credential provisioning is unavailable",
            );
            err.code = "unsupported_host";
            throw err;
          }
          const receipt = await provisionRelayCredential(params);
          return {
            content: [{ type: "text", text: JSON.stringify(receipt) }],
          };
        }
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
    }),

    { name: "ocuclaw_setup" },
  );
}
