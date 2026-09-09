import * as fs from "node:fs";
import {
  BUILT_WITH_OPENCLAW,
  OPENCLAW_PLUGIN_API_COMPATIBILITY,
} from "../version.js";
import {
  FRESH_INSTALL_DEFAULT_WS_PORT,
  hasExplicitWsPort,
  readRelayPortMarker,
} from "../config/relay-port-default.js";
import { OPENCLAW_BUNDLE_DEFAULT_WS_PORT } from "../config/runtime-config.js";
import { taskIndexPromptInjectionStatus } from "../runtime/task-index-prompt-injection.js";

const SECRET_PRESENCE = Object.freeze({
  PRESENT: "present",
  ABSENT: "absent",
});
const SECRET_VALIDATION = Object.freeze({
  NOT_CHECKED: "not-checked",
  NOT_APPLICABLE: "not-applicable",
});

function secretState(value) {
  const present = typeof value === "string" && value.length > 0;
  return {
    presence: present ? SECRET_PRESENCE.PRESENT : SECRET_PRESENCE.ABSENT,
    validation: present
      ? SECRET_VALIDATION.NOT_CHECKED
      : SECRET_VALIDATION.NOT_APPLICABLE,
  };
}

export const OCUCLAW_SETUP_OPERATIONS = Object.freeze([
  "overview",
  "doctor",
  "plan",
  "verify",
]);

export function classifySetupRegistration(registrationMode) {
  if (registrationMode === "full") {
    return {
      pluginStatus: "loaded",
      pluginStatusEvidence: "plugin-registration",
      runtimeStatus: undefined,
    };
  }
  if (registrationMode === "tool-discovery") {
    return {
      pluginStatus: "discovered",
      pluginStatusEvidence: "tool-discovery-registration",
      runtimeStatus: "unknown",
    };
  }
  return {
    pluginStatus: "discovered",
    pluginStatusEvidence:
      registrationMode === "cli-metadata"
        ? "cli-metadata-registration"
        : "plugin-discovery-registration",
    runtimeStatus: "unknown",
  };
}

function classifyBindAddress(value) {
  const address = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!address) return "unset";
  if (
    address === "localhost" ||
    address === "::1" ||
    address.startsWith("127.")
  ) {
    return "loopback";
  }
  if (
    address === "0.0.0.0" ||
    address === "::" ||
    address === "[::]"
  ) {
    return "all-interfaces";
  }
  if (
    address.startsWith("10.") ||
    address.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(address) ||
    address.startsWith("fc") ||
    address.startsWith("fd")
  ) {
    return "private";
  }
  return "other";
}

function boundedVersion(value) {
  if (typeof value !== "string") return "unknown";
  const trimmed = value.trim();
  return /^[0-9A-Za-z][0-9A-Za-z.+-]{0,63}$/.test(trimmed)
    ? trimmed
    : "unknown";
}

const MANAGED_INSTALL_SOURCES = ["archive", "clawhub", "npm", "path", "git"];

function installProvenance(installs) {
  if (!installs || typeof installs !== "object" || Array.isArray(installs)) {
    return {
      recorded: null,
      evidence: "host-config-does-not-expose-install-records",
      source: "unknown",
      version: null,
      installedAt: null,
    };
  }
  const record = installs.ocuclaw;
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return {
      recorded: false,
      evidence: "no-install-record-in-host-config",
      source: "unknown",
      version: null,
      installedAt: null,
    };
  }
  const installedAt =
    typeof record.installedAt === "string" &&
      /^\d{4}-\d{2}-\d{2}T[0-9:.]+Z?$/.test(record.installedAt.trim()) &&
      record.installedAt.trim().length <= 40
      ? record.installedAt.trim()
      : null;
  const version = boundedVersion(record.version);
  return {
    recorded: true,
    evidence: "host-config-install-record",
    source: MANAGED_INSTALL_SOURCES.includes(record.source)
      ? record.source
      : "unknown",
    version: version === "unknown" ? null : version,
    installedAt,
  };
}

function calendarVersion(value) {
  const match = /(\d{4})\.(\d+)\.(\d+)/.exec(String(value ?? ""));
  return match ? match.slice(1, 4).map(Number) : null;
}

function compareCalendarVersion(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] > right[index]) return 1;
    if (left[index] < right[index]) return -1;
  }
  return 0;
}

function compatibilityStatus(hostVersion) {
  const numeric = calendarVersion(/^\d{4}\.\d+\.\d+/.exec(hostVersion) ? hostVersion : null);
  const tokens = String(OPENCLAW_PLUGIN_API_COMPATIBILITY).trim().split(/\s+/);
  const floorToken = tokens.find((token) => token.startsWith(">=")) ?? tokens[0];
  const floor = calendarVersion(floorToken);
  if (!numeric || !floor) return "unknown";
  if (compareCalendarVersion(numeric, floor) < 0) return "incompatible";
  const ceilingToken = tokens.find((token) => token.startsWith("<"));
  if (!ceilingToken) return "compatible";
  const ceiling = calendarVersion(ceilingToken);
  if (!ceiling) return "unknown";
  const cmp = compareCalendarVersion(numeric, ceiling);
  const inclusive = ceilingToken.startsWith("<=");
  return (inclusive ? cmp <= 0 : cmp < 0) ? "compatible" : "incompatible";
}

function configurationState(api, config) {
  const raw = api && api.pluginConfig && typeof api.pluginConfig === "object"
    ? api.pluginConfig
    : {};
  const openclawConfig =
    api && api.config && typeof api.config === "object" ? api.config : {};
  const gateway =
    openclawConfig.gateway && typeof openclawConfig.gateway === "object"
      ? openclawConfig.gateway
      : null;
  const issueIds = [];
  if (
    Object.prototype.hasOwnProperty.call(raw, "wsPort") &&
    (!Number.isInteger(raw.wsPort) || raw.wsPort < 1 || raw.wsPort > 65535)
  ) {
    issueIds.push("ws-port-invalid");
  }
  if (
    Object.prototype.hasOwnProperty.call(raw, "wsBind") &&
    (typeof raw.wsBind !== "string" || raw.wsBind.trim().length === 0)
  ) {
    issueIds.push("ws-bind-invalid");
  }
  for (const key of [
    "relayToken",
    "sonioxApiKey",
    "cartesiaApiKey",
    "evenAiToken",
  ]) {
    if (
      Object.prototype.hasOwnProperty.call(raw, key) &&
      (typeof raw[key] !== "string" ||
        (key === "relayToken" && raw[key].trim().length === 0))
    ) {
      const fieldId = key.replace(
        /[A-Z]/g,
        (letter) => `-${letter.toLowerCase()}`,
      );
      issueIds.push(`${fieldId}-invalid`);
    }
  }
  for (const key of [
    "evenAiEnabled",
    "externalDebugToolsEnabled",
    "debugAutoArm",
    "allowDebugUpload",
  ]) {
    if (
      Object.prototype.hasOwnProperty.call(raw, key) &&
      typeof raw[key] !== "boolean"
    ) {
      const fieldId = key.replace(
        /[A-Z]/g,
        (letter) => `-${letter.toLowerCase()}`,
      );
      issueIds.push(`${fieldId}-invalid`);
    }
  }
  if (raw.evenAiEnabled === true && !config.evenAiToken) {
    issueIds.push("even-ai-token-required");
  }
  if (gateway) {
    if (
      Object.prototype.hasOwnProperty.call(gateway, "mode") &&
      !["local", "remote"].includes(gateway.mode)
    ) {
      issueIds.push("gateway-mode-invalid");
    }
    if (
      Object.prototype.hasOwnProperty.call(gateway, "port") &&
      (!Number.isInteger(gateway.port) ||
        gateway.port < 1 ||
        gateway.port > 65535)
    ) {
      issueIds.push("gateway-port-invalid");
    }
    if (gateway.mode === "remote") {
      const remote =
        gateway.remote && typeof gateway.remote === "object"
          ? gateway.remote
          : null;
      if (!remote) {
        issueIds.push("gateway-remote-config-invalid");
      } else {
        const url = typeof remote.url === "string" ? remote.url.trim() : "";
        if (!/^wss?:\/\/[^\s]+$/i.test(url)) {
          issueIds.push("gateway-remote-url-invalid");
        }
        if (
          Object.prototype.hasOwnProperty.call(remote, "token") &&
          typeof remote.token !== "string"
        ) {
          issueIds.push("gateway-token-invalid");
        }
      }
    } else if (
      gateway.auth &&
      typeof gateway.auth === "object" &&
      Object.prototype.hasOwnProperty.call(gateway.auth, "token") &&
      typeof gateway.auth.token !== "string"
    ) {
      issueIds.push("gateway-token-invalid");
    }
  }
  const validationScope = "setup-required-fields";
  if (issueIds.length > 0) {
    return {
      status: "invalid",
      validationEvidence: "bounded-controller-checks",
      validationScope,
      unassessedFields: "unknown",
      issueIds,
    };
  }
  if (!config.relayToken || !config.gatewayToken) {
    return {
      status: "incomplete",
      validationEvidence: "required-presence-checks",
      validationScope,
      unassessedFields: "unknown",
      issueIds: [],
    };
  }
  const hostValidated = api && api.registrationMode === "full";
  return hostValidated
    ? {
        status: "valid",
        validationScope: "published-plugin-schema-and-setup-required-fields",
        validationEvidence: "loaded-host-registration",
        unassessedFields: "host-validated",
        issueIds: [],
      }
    : {
        status: "unknown",
        validationScope,
        validationEvidence: "host-validation-unavailable",
        unassessedFields: "unknown",
        issueIds: [],
      };
}

const FINDING_TEXT = Object.freeze({
  task_index_prompt_injection_disabled: [
    "warning",
    "OpenClaw blocks prompt-mutating plugin hooks, so the hidden per-turn LiveUI Task index is disabled and the saved Even AI custom prompt cannot reach the model: its owner text is delivered per turn through the same hook, because a resumed native thread ignores changed developer instructions.",
  ],
  "configuration.invalid": [
    "error",
    "OcuClaw configuration contains invalid bounded values.",
  ],
  "configuration.evidence-unavailable": [
    "warning",
    "Full published-schema validation evidence is unavailable in this plugin discovery context.",
  ],
  "configuration.gateway-token-absent": [
    "error",
    "The OpenClaw gateway authentication token is absent.",
  ],
  "configuration.relay-token-absent": [
    "error",
    "The OcuClaw relay token is absent.",
  ],
  "compatibility.host-incompatible": [
    "error",
    "The loaded OpenClaw host is below the plugin API compatibility floor.",
  ],
  "compatibility.evidence-unavailable": [
    "warning",
    "The OpenClaw host version is unavailable or unrecognised.",
  ],
  "runtime.not-running": [
    "info",
    "The relay runtime is not currently running in this plugin context.",
  ],
  "runtime.start-pending-bind": [
    "error",
    "The relay start has not completed: a relay handle exists but nothing is bound yet — typically another process owns the configured port (EADDRINUSE) and the relay worker is crash-looping.",
  ],
  "runtime.evidence-unavailable": [
    "info",
    "Runtime evidence is unavailable during plugin discovery.",
  ],
  "tool-policy.evidence-unavailable": [
    "info",
    "This surface has no effective model tool-policy context; callability is unknown.",
  ],
});

function finding(id, evidence) {
  const findingText = FINDING_TEXT;
  const [severity, explanation] = findingText[id];
  return { id, severity, explanation, evidence };
}

function findingsFor(state) {
  const findings = [];
  if (state.taskIndex.status === "disabled") {
    findings.push(finding(
      "task_index_prompt_injection_disabled",
      state.taskIndex.reasonCode,
    ));
  }
  if (state.configuration.status === "invalid") {
    findings.push(finding("configuration.invalid", state.configuration.issueIds));
  } else if (state.configuration.status === "unknown") {
    findings.push(
      finding(
        "configuration.evidence-unavailable",
        state.configuration.validationEvidence,
      ),
    );
  }
  if (state.secrets.gatewayToken.presence === "absent") {
    findings.push(finding("configuration.gateway-token-absent", "gateway-token-presence"));
  }
  if (state.secrets.relayToken.presence === "absent") {
    findings.push(finding("configuration.relay-token-absent", "relay-token-presence"));
  }
  if (state.compatibility.status === "incompatible") {
    findings.push(finding("compatibility.host-incompatible", "host-version-comparison"));
  } else if (state.compatibility.status === "unknown") {
    findings.push(finding("compatibility.evidence-unavailable", "host-version-unavailable"));
  }
  if (state.runtime.status === "stopped") {
    findings.push(finding("runtime.not-running", "relay-instance-absent"));
  } else if (state.runtime.status === "starting") {
    findings.push(finding("runtime.start-pending-bind", "relay-start-pending-bind"));
  } else if (state.runtime.status === "unknown") {
    findings.push(finding("runtime.evidence-unavailable", "plugin-discovery-context"));
  }
  if (state.toolPolicy.callability === "unknown") {
    findings.push(finding("tool-policy.evidence-unavailable", state.toolPolicy.evidence));
  }
  return findings;
}

const REMEDIATIONS = Object.freeze({
  task_index_prompt_injection_disabled: {
    id: "enable-task-index-prompt-injection",
    action: "Set plugins.entries.ocuclaw.hooks.allowPromptInjection to true, then restart the gateway. Until then the LiveUI Task index stays hidden and Even AI requests run without the saved Even AI custom prompt.",
    preconditions: ["Confirm the owner wants OcuClaw to add hidden per-turn prompt context."],
    risks: ["A gateway restart briefly interrupts connected clients."],
  },
  "configuration.invalid": {
    id: "correct-invalid-configuration",
    action: "Correct the reported bounded OcuClaw configuration fields through an operator-owned OpenClaw config surface.",
    preconditions: ["Review the reported issue identifiers."],
    risks: ["Changing relay bind settings can interrupt connected clients."],
  },
  "configuration.evidence-unavailable": {
    id: "validate-loaded-plugin-configuration",
    action: "Validate configuration through the loaded OpenClaw plugin host, then re-run OcuClaw verification.",
    preconditions: ["The plugin must be installed and enabled."],
    risks: [],
  },
  "configuration.gateway-token-absent": {
    id: "configure-gateway-token",
    action: "Enter a gateway authentication token through an operator-owned OpenClaw config surface.",
    preconditions: ["Choose a secret outside model-visible arguments and output."],
    risks: ["The gateway and plugin must use the same current credential."],
  },
  "configuration.relay-token-absent": {
    id: "configure-relay-token",
    action: "Enter an OcuClaw relay token through an operator-owned OpenClaw config surface.",
    preconditions: ["Choose a secret outside model-visible arguments and output."],
    risks: ["The OcuClaw app and Runtime Bundle must use the same credential."],
  },
  "compatibility.host-incompatible": {
    id: "upgrade-openclaw-host",
    action: "Upgrade OpenClaw to a release satisfying the declared plugin API floor.",
    preconditions: ["Review the installed plugin compatibility declaration."],
    risks: ["A host upgrade can require a gateway restart."],
  },
  "compatibility.evidence-unavailable": {
    id: "inspect-openclaw-host-version",
    action: "Inspect the current OpenClaw host version through an operator-owned host surface.",
    preconditions: ["Run from the host that loads the OcuClaw Runtime Bundle."],
    risks: [],
  },
  "runtime.not-running": {
    id: "start-relay-runtime",
    action: "Start or restart the OpenClaw gateway, then re-run OcuClaw verification.",
    preconditions: ["Confirm required configuration is present and valid."],
    risks: ["Restarting the gateway briefly interrupts connected clients."],
  },
  "runtime.start-pending-bind": {
    id: "resolve-relay-bind-failure",
    action: "Read the gateway log's newest [ocuclaw] relay lines for a bind failure (EADDRINUSE, address already in use, WSAEACCES, repeating relay-worker exits); free or change the conflicting port, then re-run OcuClaw verification.",
    preconditions: ["The relay start has not completed; another process may own the configured port."],
    risks: ["Changing the relay port requires updating Tailscale Serve routes and reconnecting the phone app."],
  },
  "runtime.evidence-unavailable": {
    id: "inspect-loaded-relay-runtime",
    action: "Run verification in the loaded plugin host where current relay runtime evidence is available.",
    preconditions: ["The plugin must be installed and enabled."],
    risks: [],
  },
  "tool-policy.evidence-unavailable": {
    id: "inspect-effective-tool-policy",
    action: "Inspect the effective tool inventory for the intended agent and sender context.",
    preconditions: ["Use the same agent and sender context as the intended setup call."],
    risks: [],
  },
});

function planFor(findings) {
  const remediations = REMEDIATIONS;
  return findings.flatMap((item) => {
    const remediation = remediations[item.id];
    return remediation ? [{ ...remediation, findingId: item.id }] : [];
  });
}

function verificationFor(state) {
  const status = (condition, unknown = false) =>
    unknown ? "unknown" : condition ? "passed" : "failed";
  const invariants = [
    {
      id: "task-index-prompt-injection",
      status: status(state.taskIndex.status !== "disabled"),
      evidence: state.taskIndex.reasonCode || state.taskIndex.evidence,
    },
    {
      id: "plugin-loaded",
      status: status(
        state.plugin.status === "loaded",
        state.plugin.status !== "loaded",
      ),
      evidence: state.plugin.statusEvidence,
    },
    {
      id: "configuration-valid",
      status: status(
        state.configuration.status === "valid",
        state.configuration.status === "unknown",
      ),
      evidence: state.configuration.validationEvidence,
    },
    {
      id: "host-compatible",
      status: status(
        state.compatibility.status === "compatible",
        state.compatibility.status === "unknown",
      ),
      evidence: state.compatibility.status,
    },
    {
      id: "relay-token-present",
      status: status(state.secrets.relayToken.presence === "present"),
      evidence: state.secrets.relayToken.presence,
    },
    {
      id: "gateway-token-present",
      status: status(state.secrets.gatewayToken.presence === "present"),
      evidence: state.secrets.gatewayToken.presence,
    },
    {
      id: "runtime-running",
      status: status(
        state.runtime.status === "running",
        state.runtime.status === "unknown",
      ),
      evidence: state.runtime.statusEvidence,
    },
    {
      id: "setup-tool-registered",
      status: status(
        state.toolPolicy.setupToolRegistered,
        state.plugin.status !== "loaded",
      ),
      evidence: state.toolPolicy.setupToolRegistered
        ? "registered"
        : "not-observed",
    },
    {
      id: "setup-tool-callable",
      status: status(
        state.toolPolicy.callability === "callable",
        state.toolPolicy.callability === "unknown",
      ),
      evidence: state.toolPolicy.evidence,
    },
  ];
  const overallStatus = invariants.some((item) => item.status === "failed")
    ? "failed"
    : invariants.some((item) => item.status === "unknown")
      ? "unknown"
      : "passed";
  return { invariants, overallStatus };
}

function defaultEnvironmentProbe() {
  const containerMarkers = [];
  if (fs.existsSync("/.dockerenv")) containerMarkers.push("dockerenv");
  if (fs.existsSync("/run/.containerenv")) containerMarkers.push("containerenv");
  return {
    os: process.platform,
    containerMarkers,
    systemdPresent:
      process.platform === "linux" ? fs.existsSync("/run/systemd/system") : null,
  };
}

function environmentReport(probe) {
  try {
    const report = (typeof probe === "function" ? probe : defaultEnvironmentProbe)();
    return {
      os: typeof report.os === "string" ? report.os : "unknown",
      containerMarkers: Array.isArray(report.containerMarkers)
        ? report.containerMarkers.filter((m) => typeof m === "string")
        : [],
      systemdPresent:
        typeof report.systemdPresent === "boolean" ? report.systemdPresent : null,
      evidence: "in-plugin-fs-checks",
    };
  } catch (_) {
    return {
      os: "unknown",
      containerMarkers: [],
      systemdPresent: null,
      evidence: "environment-probe-failed",
    };
  }
}

function resolveSetupStateDir(api) {
  const stateApi = api && api.runtime && api.runtime.state;
  if (!stateApi || typeof stateApi.resolveStateDir !== "function") return null;
  try {
    const dir = stateApi.resolveStateDir(
      typeof process !== "undefined" ? process.env : undefined,
    );
    return typeof dir === "string" && dir ? dir : null;
  } catch (_) {
    return null;
  }
}

function relayHandleRunning(relay) {
  return !!relay && relay.relayLifecycle !== "starting";
}

function resolveReportedPortOrigin(api, relay) {
  const view = api && api.pluginConfig;
  if (!hasExplicitWsPort(view)) return "plugin-managed-default";
  if (view.wsPort !== OPENCLAW_BUNDLE_DEFAULT_WS_PORT) return "explicit-config";
  if (readRelayPortMarker(resolveSetupStateDir(api))) return "plugin-managed-default";
  if (relayHandleRunning(relay)) return "explicit-config";
  return "unverified-pre-start";
}

function createSetupStateReader({
  api,
  service,
  isSetupToolRegistered,
  pluginStatus,
  pluginStatusEvidence,
  runtimeStatus,
  environmentProbe,
}) {
  if (
    !service ||
    (typeof service.getSetupConfig !== "function" &&
      typeof service.getRuntimeConfig !== "function")
  ) {
    throw new Error("createSetupController requires the OcuClaw relay service");
  }

  const readSetupState = function readSetupState(context = {}) {
    const config = typeof service.getSetupConfig === "function"
      ? service.getSetupConfig()
      : service.getRuntimeConfig();
    const relay =
      typeof service.getRelay === "function" ? service.getRelay() : null;
    const appClientConnected =
      typeof service.hasConnectedAppClient === "function"
        ? service.hasConnectedAppClient()
        : false;

    const appClientVersion = (() => {
      if (appClientConnected !== true) return null;
      if (typeof service.getConnectedAppClientVersion !== "function") return null;
      const bounded = boundedVersion(service.getConnectedAppClientVersion());
      return bounded === "unknown" ? null : bounded;
    })();
    const invokedAsTool = context.surface === "tool";
    const hostVersion = boundedVersion(api && api.runtime && api.runtime.version);
    const install = installProvenance(
      api && api.config && api.config.plugins && api.config.plugins.installs,
    );

    const pluginLoaded = pluginStatus === "loaded" || invokedAsTool;
    const state = {
      schemaVersion: 1,
      operation: "overview",
      plugin: {
        id: "ocuclaw",
        status: pluginLoaded ? "loaded" : "discovered",
        version: boundedVersion(api && api.version),
        source: install.source,
        install,
        statusEvidence:
          pluginStatus !== "loaded" && invokedAsTool
            ? "tool-execution-in-live-host"
            : [
                  "plugin-registration",
                  "plugin-discovery-registration",
                  "tool-discovery-registration",
                  "cli-metadata-registration",
                ].includes(pluginStatusEvidence)
              ? pluginStatusEvidence
              : "unknown",
        unavailableStatusEvidence: ["absent", "disabled", "load-failure"],
      },

      runtime:
        runtimeStatus === "unknown"
          ? {
              status: "unknown",
              statusEvidence: invokedAsTool
                ? "host-runs-plugin-tools-in-discovery-instance"
                : "runtime-evidence-unavailable-in-discovery-context",
              appClientConnected: null,
              appClientVersion: null,
            }
          : relay && relay.relayLifecycle === "starting"
            ? {

                status: "starting",
                statusEvidence: "relay-start-pending-bind",
                appClientConnected: appClientConnected === true,
                appClientVersion,
              }
            : {
                status: relay ? "running" : "stopped",
                statusEvidence: "relay-instance-check",
                appClientConnected: appClientConnected === true,
                appClientVersion,
              },
      relay: {
        bindScope: classifyBindAddress(config.wsBind),

        port:
          relay && Number.isInteger(relay.effectiveWsPort)
            ? relay.effectiveWsPort
            : Number.isInteger(config.wsPort)
              ? config.wsPort
              : null,

        portOrigin: resolveReportedPortOrigin(api, relay),
        freshInstallDefaultPort: FRESH_INSTALL_DEFAULT_WS_PORT,
      },
      configuration: configurationState(api, config),
      taskIndex: taskIndexPromptInjectionStatus(api && api.config),
      compatibility: {
        hostOpenClaw: hostVersion,
        pluginApi: OPENCLAW_PLUGIN_API_COMPATIBILITY,
        builtWithOpenClaw: BUILT_WITH_OPENCLAW,
        status: compatibilityStatus(hostVersion),
      },
      environment: environmentReport(environmentProbe),
      toolPolicy: {
        setupToolRegistered:
          typeof isSetupToolRegistered === "function" &&
          isSetupToolRegistered() === true,
        defaultExposure: invokedAsTool
          ? "exposed"
          : typeof isSetupToolRegistered === "function" &&
              isSetupToolRegistered() === true
            ? "exposed-by-default"
            : "unavailable",
        callability: invokedAsTool ? "callable" : "unknown",
        evidence: invokedAsTool
          ? "successful-tool-invocation"
          : "no-effective-policy-context",
      },
      secrets: {
        relayToken: secretState(config.relayToken),
        gatewayToken: secretState(config.gatewayToken),
        sonioxApiKey: secretState(config.sonioxApiKey),
        cartesiaApiKey: secretState(config.cartesiaApiKey),
        evenAiToken: secretState(config.evenAiToken),
      },
    };
    return state;
  };
  return readSetupState;
}

export function createSetupController(options) {
  const readState = createSetupStateReader(options);
  return function runSetupOperation(operation, context = {}) {
    const state = readState(context);
    if (operation === "overview") return state;
    return completeSetupOperation(state, operation);
  };
}

function completeSetupOperation(state, operation) {
  const findings = findingsFor({ ...state, operation });
  const health = findings.some((item) => item.severity === "error")
    ? "blocked"
    : findings.some(
      (item) =>
        item.severity === "warning" || item.id.endsWith("evidence-unavailable"),
    )
      ? "healthy-with-unknowns"
      : findings.length > 0
        ? "needs-attention"
      : "healthy";
  const operationState = { ...state, operation };
  if (operation === "doctor") return { ...operationState, health, findings };
  if (operation === "plan") {
    return {
      ...operationState,
      health,
      findings,
      steps: planFor(findings),
      mutationPerformed: false,
    };
  }
  if (operation === "verify") {
    return { ...operationState, ...verificationFor(operationState) };
  }
  const err = new Error("invalid_input: unsupported setup operation");
  err.code = "invalid_input";
  throw err;
}
