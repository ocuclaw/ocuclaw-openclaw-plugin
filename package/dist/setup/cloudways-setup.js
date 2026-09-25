import { runCloudwaysVerb } from "./cloudways-command.js";
import { terminalText } from "./terminal-text.js";

import { spawn } from "node:child_process";
import {
  cliArgv,
  defaultRunCommand,
  DETECT_CLOUDWAYS,
  resolveLayout,
  STALE_ENROLLMENT_MESSAGE,
  STATE_NEEDS_AUTH,
  STATE_RUNNING,
} from "./cloudways.js";
import { localeAllowsUnicode } from "./pairing-terminal.js";
import { renderQrTextToTerminal } from "../domain/pairing/qr-terminal.js";
import { PLUGIN_VERSION } from "../version.js";
import {
  applyCommand,
  defaultRunTailscale,
  LOOPBACK,
  readNodeState,
  readPhonePresence,
  ROUTE_STATUS_HEALTHY,
  servePort,
} from "./private-route.js";
import {
  ISSUANCE_AVAILABLE,
  ISSUANCE_UNAVAILABLE,
  ISSUANCE_UNKNOWN,
  startCertificateIssuance,
} from "./certificate-issuance.js";
import { readPrivateRoute } from "./setup-live.js";
import { setupInstallation } from "./setup-journey.js";
import { resolveSetupStateDir } from "./setup-controller.js";
import { createRelayCredentialProvision, PROVISION_RELAY_CREDENTIAL_OPERATION } from "./relay-credential-provision.js";
import { createFirstUseCommand, runSetupWelcome, setupFirstUseRequest } from "./first-use-command.js";
import {
  awaitFirstUseReply,
  FIRST_USE_SEND_TEXT as FIRST_USE_SEND_TEXT_VALUE,
  FIRST_USE_ALREADY_COMPLETE_MESSAGE as FIRST_USE_ALREADY_COMPLETE_VALUE,
  FIRST_USE_REPLY_MESSAGE as FIRST_USE_REPLY_VALUE,
} from "./first-use-wait.js";
import { createRuntimeConfigOverview } from "../config/runtime-config.js";

import process from "node:process";

export const SETUP_STEP_COUNT = 8;

export const SETUP_EXIT_OK = 0;
export const SETUP_EXIT_PROBLEM = 1;
export const SETUP_EXIT_STOPPED = 2;

export const CONSENT_ANSWER = "yes";
export const CONSENT_QUESTION = `Allow access? Type ${CONSENT_ANSWER} or y; anything else stops: `;

export const CONSENT_ANSWERS = Object.freeze([CONSENT_ANSWER, "y"]);

export const CONSENT_QUESTION_STRICT = `Apply route? Type the full word ${CONSENT_ANSWER}; anything else stops: `;

export function consentGiven(answer, strict = false) {
  const typed = String(answer).trim().toLowerCase();
  return strict === true ? typed === CONSENT_ANSWER : CONSENT_ANSWERS.indexOf(typed) !== -1;
}

export const CONVERSATION_ACCESS_KEY = "plugins.entries.ocuclaw.hooks.allowConversationAccess";

export const NOT_CLOUDWAYS_MESSAGE =
  "This command is for Cloudways Managed AI Agents.\nUse the ordinary OcuClaw setup for this machine.";

export const TTY_REQUIRED_MESSAGE =
  "Run this command in an interactive terminal.\nFor automation, --yes approves setup changes; it cannot approve pairing or confirm a glasses reply.";

export const RESUME_MESSAGE =
  "Stopped. Earlier changes are kept. Run the same setup command to resume.";

export const COLD_CERTIFICATE_MESSAGE =
  "Waiting for the certificate. This usually takes a minute or two.";

export function certificateProgressMessage(elapsedS) {
  return `Still waiting for the certificate (${waitedFor(elapsedS)} so far).`;
}

export function waitedFor(elapsedS) {
  const total = Math.max(0, Math.floor(Number(elapsedS) || 0));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const parts = [];
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  if (seconds > 0 || minutes === 0) parts.push(`${seconds} seconds`);
  return parts.join(" ");
}

export const CERTIFICATE_TIMEOUT_MESSAGE =
  "The certificate is not ready yet. Run the same command again; setup picks up here.";

export const PAIR_RETRY_NO_ANSWER_MESSAGE =
  "No answer, so setup stopped here. Run the same command again to get a new code.";

export const STUCK_HELP_MESSAGE = "Stuck? Ask us on Discord: https://discord.ocuclaw.com";

export const NO_GATEWAY_RESTART_MESSAGE =
  "No gateway restart is needed on Cloudways.";

export const IGNORE_HOST_RESTART_HINT_MESSAGE =
  "OpenClaw's install printed its own restart hint; ignore it here.";

export const OCUCLAW_LOADED_MESSAGE = "OcuClaw is loaded and ready.";

export const OCUCLAW_NOT_LOADED_MESSAGE =
  "OcuClaw is installed but your agent has not loaded it yet.";

export function ocuclawOldVersionMessage(loaded, installed) {
  return `Your agent is still running OcuClaw ${loaded}. OcuClaw ${installed} is installed.`;
}

export const CLOUDWAYS_RESTART_COMMAND = "pkill -f openclaw-gateway";
export const CLOUDWAYS_RESTART_WARNING_LINES = [
  "This restarts the whole container. SSH will disconnect; reconnect in about a minute.",
  "Your phone reconnects in 1–5 minutes. Active replies are stopped, not finished.",
];
export const SETUP_COMMAND = "openclaw ocuclaw cloudways setup";

export const OCUCLAW_NOT_LOADED_HELP_LINES = [
  "  This host normally loads the plugin without a restart.",
  "  If OcuClaw stays unloaded, run openclaw ocuclaw doctor.",
];
export const OCUCLAW_RESTART_LINES = [
  "  One restart loads OcuClaw. Type:",
  `    ${CLOUDWAYS_RESTART_COMMAND}`,
  ...CLOUDWAYS_RESTART_WARNING_LINES.map((line) => `  ${line}`),
  "  After you reconnect, type this again:",
  `    ${SETUP_COMMAND}`,
  "  Or restart the agent from your Cloudways dashboard.",
];

const LOADED_CHECK_ATTEMPTS = 3;
const LOADED_CHECK_RETRY_MS = 2000;

export const MODEL_SIGN_IN_CODEX_ARGV = Object.freeze([
  "openclaw", "models", "auth", "login", "--provider", "openai", "--device-code", "--set-default",
]);
export const MODEL_SIGN_IN_API_KEY_ARGV = Object.freeze([
  "openclaw", "models", "auth", "login", "--set-default",
]);
export const MODEL_STATUS_ARGV = Object.freeze(["openclaw", "models", "status", "--json"]);
export const MODEL_NOT_SIGNED_IN_MESSAGE = "No model is signed in yet. Which account will this agent use?";
export const MODEL_SIGN_IN_CHOICES = [
  "    1  ChatGPT subscription",
  "    2  An API key",
  "    3  I'll set it up myself",
];
export const MODEL_SIGN_IN_QUESTION = "Choose 1–3:";
export const MODEL_SIGNED_IN_MESSAGE = "Model signed in.";
export const MODEL_SIGN_IN_UNFINISHED_MESSAGE = "Sign-in did not finish. No model is signed in yet.";

export const MODEL_NOT_SIGNED_IN_NOTICE = "No model is signed in yet. Sign in before the first message.";
export const MODEL_SIGN_IN_SELF_LINES = [
  "  For a ChatGPT subscription, type:",
  `    ${MODEL_SIGN_IN_CODEX_ARGV.join(" ")}`,
  "  For an API key, type:",
  `    ${MODEL_SIGN_IN_API_KEY_ARGV.join(" ")}`,
];
export const MODEL_SIGN_IN_RESUME_LINES = [
  "  Then type this again:",
  `    ${SETUP_COMMAND}`,
];

export function modelSignedIn(document) {
  if (!isRecord(document)) return null;
  const model = [document.resolvedDefault, document.defaultModel]
    .find((value) => typeof value === "string" && value.trim() !== "");
  if (!model) return false;
  const auth = isRecord(document.auth) ? document.auth : null;
  if (!auth || !Array.isArray(auth.missingProvidersInUse)) return null;
  return auth.missingProvidersInUse.length === 0;
}

export const ENROLL_ON_PHONE_LINES = [
  "  On your phone, sign in to Tailscale. Open this link to approve this server:",
];
export const ENROLL_INSTALL_TAILSCALE_LINE =
  "  No Tailscale on your phone? Install it from the App Store or Google Play and sign in first.";
export const ENROLL_QR_PROMPT = "  Point your phone's camera at this code to approve this server:";
export const ENROLL_OR_OPEN_PREFIX = "  Or open: ";

export const PHONE_PRESENT_MESSAGE = "Phone found on your Tailscale network.";

export const PHONE_WALKTHROUGH_LINES = [
  "Phone not found on your Tailscale network.",
  "",
  "On your phone:",
  "1. Open Tailscale.",
  "2. Sign in with the same account as this server.",
  "3. Switch Tailscale on.",
  "",
  "Waiting for your phone. Press Enter to skip this check.",
];

export const PHONE_NO_TERMINAL_MESSAGE =
  "No phone found on your Tailscale network.\nPhone check skipped: this terminal is not interactive.";

export const PHONE_APPEARED_MESSAGE = "Phone found on your Tailscale network.";

export const PHONE_CARRY_ON_MESSAGE = "Phone check skipped. No phone was found on your Tailscale network.";

export const PHONE_WAIT_TIMEOUT_MESSAGE =
  "No phone found before the check timed out.\nTurn on Tailscale on your phone, then run setup again.";

export const PAIR_READY_LINES = [
  "Open Even > OcuClaw > Pair with your computer on your phone, then press Enter to show the code.",
  "The next pairing code expires in 2 minutes.",
];

export const PAIR_RETRY_PROMPT_MESSAGE =
  "Press Enter for a new code, or type stop:";

export const PAIR_RETRY_STOP_ANSWER = "stop";

export const PAIR_RETRY_LIMIT = 3;

export const PAIR_TIMEOUT_CAUSE_LINES = Object.freeze([
  "Most often this means Tailscale is switched off,",
  "or signed in to a different account, on your phone.",
]);

export const PAIR_SCREEN_NOT_OPEN_MESSAGE = "If the pair screen wasn't open yet, open it first.";

export const PAIR_NOBODY_ENTERED_MESSAGE = "Code expired before a phone joined.";

export function pairingExpiryMessage(phase) {
  if (phase === "waiting-for-phone") return PAIR_NOBODY_ENTERED_MESSAGE;
  if (phase === "awaiting-approval") return "Pairing expired while waiting for approval.";
  if (phase === "awaiting-phone-connection") return "Approval was sent, but your phone's connection was not confirmed in time. Check your phone before retrying.";
  return "Pairing did not finish before the code expired.";
}

export {
  FIRST_USE_SEND_TEXT,
  FIRST_USE_ALREADY_COMPLETE_MESSAGE,
  FIRST_USE_WAITING_MESSAGE,
  FIRST_USE_REARMED_MESSAGE,
  FIRST_USE_REPLY_MESSAGE,
} from "./first-use-wait.js";

export const FIRST_USE_SKIPPED_MESSAGE =
  "First-message check skipped.\nWhen ready, run openclaw ocuclaw first-use.";

export const FIRST_USE_UNAVAILABLE_MESSAGE =
  "Setup cannot start the first-message check on this host.\nRun openclaw ocuclaw first-use in your terminal.";

export const FIRST_USE_REPLY_ERROR_MESSAGE =
  "The model returned an error. No first reply was confirmed.\nOcuClaw is installed; setup is not complete.\n\nFix the model account or configuration, then resume:\n  openclaw ocuclaw cloudways setup";

export const FIRST_USE_REPLY_RATE_LIMIT_MESSAGE =
  "The model is rate limited. No first reply was confirmed.\nOcuClaw is installed; setup is not complete.\n\nWait for the limit to reset or choose another model, then run:\n  openclaw ocuclaw cloudways setup";

export const FIRST_USE_TIMEOUT_MESSAGE =
  "No reply arrived before the check timed out.\nKeep Tailscale on your phone switched on, then run setup again.";

export const FIRST_USE_PENDING_MESSAGE =
  "Glasses reply confirmation is still pending.\nRun setup again when you are ready.";

export const SETUP_COMPLETE_MESSAGE = "Setup is complete.";

export const FIRST_USE_TEST_INPUT_MESSAGE =
  "Test input used. No wearer confirmation was recorded.";

export const FIRST_USE_WELCOME_UNAVAILABLE_MESSAGE =
  "Setup is not complete: the glasses welcome still needs a double-tap.\nThis host could not show it. When ready, run openclaw ocuclaw first-use.";

const DEFAULT_ENROLL_WAIT_S = 600;
const DEFAULT_FIRST_USE_WAIT_S = 600;
const DEFAULT_PHONE_WAIT_S = 600;
const DEFAULT_PHONE_POLL_MS = 3000;

const ENTER_SETTLE_MS = 150;

const PAIR_READY_WAIT_MS = 600000;
const DEFAULT_POLL_MS = 5000;
const DEFAULT_NOTICE_MS = 30000;

const DEFAULT_CERTIFICATE_WAIT_MS = 300000;
const CERTIFICATE_PROGRESS_MS = 30000;

const CERTIFICATE_RETRY_MS = 30000;

const CERTIFICATE_MAX_CALLS = 3;

const CERTIFICATE_QUICK_FAIL_MS = 2000;

function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function serveApplyArgv(relayPort, port = null, tailscaleArgv = null) {
  const prefix = Array.isArray(tailscaleArgv) && tailscaleArgv.length > 0
    ? tailscaleArgv.slice()
    : ["tailscale"];
  return prefix.concat([
    "serve",
    "--bg",
    `--tls-terminated-tcp=${servePort(port)}`,
    `tcp://${LOOPBACK}:${relayPort}`,
  ]);
}

export function conversationAccessGranted(config) {
  const entry = isRecord(config) && isRecord(config.plugins) && isRecord(config.plugins.entries)
    ? config.plugins.entries.ocuclaw
    : null;
  const hooks = isRecord(entry) && isRecord(entry.hooks) ? entry.hooks : null;
  return !!hooks && hooks.allowConversationAccess === true;
}

export const CONVERSATION_ACCESS_DETAILS_HINT =
  "  Run again with --details to see the exact setting.";

export function conversationAccessConsentLines(details = false) {
  const lines = [
    "  OcuClaw needs to read and write the attached conversation",
    "  for glasses replies and voice input.",
    "  Other conversations and credentials are excluded.",
  ];
  if (details !== true) return lines.concat([CONVERSATION_ACCESS_DETAILS_HINT]);
  return lines.concat([
    "  This grant lets the OcuClaw plugin read and write the OpenClaw conversation",
    "  it is attached to: it can see the messages in that conversation and send its",
    "  own into it. That is what puts your replies on the glasses and your spoken",
    "  words into the conversation. It does not give the plugin your credentials and",
    "  it does not reach conversations you have not attached it to.",
    `  Change: ${CONVERSATION_ACCESS_KEY} = true`,
  ]);
}

export function serveConsentLines(command, details = false) {
  const lines = [
    "  Allow access from your tailnet only. Never public; never Tailscale Funnel.",
  ];
  if (details === true) {
    lines.push(
      "  This publishes the OcuClaw relay on your tailnet so your phone can reach it.",
      "  Tailnet only, never public, never Funnel: only devices signed in to your own",
      "  tailnet can connect, and nothing is exposed to the internet.",
    );
  }
  return lines.concat([
    "",
    "  If you say yes, setup will run:",
    `    ${command}`,
    `  Anything but ${CONSENT_ANSWER} leaves this route unchanged.`,
  ]);
}

function defaultConfirm(io) {
  const input = (io && io.input) || process.stdin;
  const output = (io && io.output) || process.stdout;

  return function confirm(lines, strict = false) {
    for (const line of lines) output.write(`${terminalText(line,
      line === CONVERSATION_ACCESS_DETAILS_HINT ? "detail" : "body", output, io.env)}\n`);
    output.write(terminalText(strict === true ? CONSENT_QUESTION_STRICT : CONSENT_QUESTION, "action", output, io.env));
    return new Promise((resolve) => {
      let settled = false;
      const settle = (answer) => {
        if (settled) return;
        settled = true;
        try { input.pause(); } catch (_) {  }
        output.write("\n");
        resolve(consentGiven(answer, strict));
      };
      try {
        input.setEncoding("utf8");
        input.once("data", settle);
        input.once("end", () => settle(""));
        input.resume();
      } catch (_) {
        settle("");
      }
    });
  };
}

function defaultStartCertificate(layout) {
  return async function startCertificate(budgetMs) {
    const argv = cliArgv(layout);
    const node = await readNodeState((args) => defaultRunTailscale(args, argv));
    if (!node || !node.dnsName) return null;
    return startCertificateIssuance(argv, node.dnsName, budgetMs);
  };
}

function defaultReadPhonePresence(layout) {
  return function phonePresence() {
    const argv = cliArgv(layout);
    return readPhonePresence((args) => defaultRunTailscale(args, argv));
  };
}

function defaultWatchEnter(io) {
  const input = (io && io.input) || process.stdin;
  return function watchEnter(onPress) {

    const handler = (chunk) => { onPress(chunk); };
    try {
      input.setEncoding("utf8");
      input.on("data", handler);
      input.resume();
    } catch (_) {
      return () => {  };
    }
    return () => {
      try {
        if (typeof input.off === "function") input.off("data", handler);
        else if (typeof input.removeListener === "function") input.removeListener("data", handler);
        input.pause();
      } catch (_) {  }
    };
  };
}

function defaultIsTty(io) {
  const input = (io && io.input) || process.stdin;
  const output = (io && io.output) || process.stdout;
  return () => input.isTTY === true && output.isTTY === true;
}

function defaultGrantConversationAccess(api) {
  const runtimeConfig = api && api.runtime ? api.runtime.config : null;
  return async function grantConversationAccess() {
    if (
      !runtimeConfig ||
      typeof runtimeConfig.mutateConfigFile !== "function"
    ) {
      throw new Error(
        `this OpenClaw host does not expose the config mutation contract; set ${CONVERSATION_ACCESS_KEY} true yourself and run this command again`,
      );
    }

    await runtimeConfig.mutateConfigFile({
      afterWrite: { mode: "none", reason: "OcuClaw conversation access granted" },
      mutate(draft) {
        if (!isRecord(draft.plugins)) draft.plugins = {};
        if (!isRecord(draft.plugins.entries)) draft.plugins.entries = {};
        if (!isRecord(draft.plugins.entries.ocuclaw)) draft.plugins.entries.ocuclaw = {};
        if (!isRecord(draft.plugins.entries.ocuclaw.hooks)) draft.plugins.entries.ocuclaw.hooks = {};
        draft.plugins.entries.ocuclaw.hooks.allowConversationAccess = true;
        return { granted: true };
      },
    });
    return { granted: true };
  };
}

function defaultReadRoute(api, options) {
  const installation = setupInstallation(resolveSetupStateDir(api));
  return (relayPort) =>
    readPrivateRoute(relayPort, { installation, servePort: options && options.servePort });
}

function defaultPairingComplete(controller) {
  return async function pairingComplete() {
    if (typeof controller !== "function") return false;
    try {
      const journey = await controller("journey", { surface: "cli" });
      const checkpoints = journey && Array.isArray(journey.checkpoints) ? journey.checkpoints : [];
      const checkpoint = checkpoints.find((entry) => entry && entry.id === "pair-phone");
      return !!checkpoint && checkpoint.status === "complete";
    } catch (_) {
      return false;
    }
  };
}

function defaultFirstUseCall(api) {
  return async function firstUseCall(params) {
    const installation = setupInstallation(resolveSetupStateDir(api));
    return setupFirstUseRequest({ ...params, installationId: installation.id });
  };
}

export function firstUseFailureReason(error) {
  const message = error && error.message ? String(error.message) : String(error ?? "");
  const match = /\b(setup-[a-z-]+|installation-mismatch|runtime-unavailable)\b/.exec(message);
  return match ? match[1] : "unavailable";
}

function defaultRelayPort(api, controller) {
  return async function relayPort() {
    if (typeof controller === "function") {
      try {
        const journey = await controller("journey", { surface: "cli" });
        const live = journey && journey.currentHealth && journey.currentHealth.privateRoute
          ? journey.currentHealth.privateRoute.relay
          : null;
        if (live && Number.isInteger(live.port) && live.port > 0) return live.port;
      } catch (_) {  }
    }
    const runtime = api && api.runtime ? api.runtime : null;
    const env = runtime && runtime.process && runtime.process.env ? runtime.process.env : {};
    const overview = createRuntimeConfigOverview({
      env,
      pluginConfig: api ? api.pluginConfig : undefined,
      openclawConfig: api ? api.config : undefined,
    });
    return overview.wsPort;
  };
}

function defaultReadLoadedPlugin(controller) {
  return async function readLoadedPlugin() {
    if (typeof controller !== "function") return null;
    const journey = await controller("journey", { surface: "cli" });
    const runtime = journey && isRecord(journey.runtimePlugin) ? journey.runtimePlugin : null;
    return runtime && typeof runtime.version === "string" && runtime.version
      ? { version: runtime.version }
      : null;
  };
}

async function defaultReadModelStatus() {
  const result = await defaultRunCommand(MODEL_STATUS_ARGV.slice(), { timeoutMs: 60000 });
  if (!result || result.code !== 0) return null;
  const text = String(result.stdout || "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return modelSignedIn(JSON.parse(text.slice(start, end + 1)));
  } catch (_) {
    return null;
  }
}

function defaultRunSignIn(argv) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(argv[0], argv.slice(1), { stdio: "inherit" });
    } catch (_) {
      resolve({ code: null, spawnFailed: true });
      return;
    }
    child.once("error", () => resolve({ code: null, spawnFailed: true }));
    child.once("exit", (code) => resolve({ code: Number.isInteger(code) ? code : null, spawnFailed: false }));
  });
}

function defaultQrTerminal(io) {
  const output = (io && io.output) || process.stdout;
  const env = (io && io.env) || process.env;
  return () => ({
    tty: output.isTTY === true,
    unicode: localeAllowsUnicode(env.LC_ALL || env.LC_CTYPE || env.LANG || ""),
    columns: Number(output.columns) > 0 ? Number(output.columns) : 0,
    rows: Number(output.rows) > 0 ? Number(output.rows) : 0,
  });
}

export function approvalLinkQr(url, terminal, lightTerminal = false, prefix = [], suffix = []) {
  if (!terminal || terminal.tty !== true || terminal.unicode !== true) return null;
  if (typeof url !== "string" || !url) return null;
  let code;
  try {
    code = renderQrTextToTerminal(url, { invert: lightTerminal !== true });
  } catch (_) {
    return null;
  }
  const rows = code.split("\n");
  const width = rows[0].length;
  const columns = Number(terminal.columns) > 0 ? Number(terminal.columns) : 0;
  if (columns > 0 && width > columns) return null;
  const height = Number(terminal.rows) > 0 ? Number(terminal.rows) : 0;
  if (height > 0) {
    const wrap = columns > 0 ? columns : 80;
    const textRows = [...prefix, ...suffix]
      .reduce((total, line) => total + Math.max(1, Math.ceil(String(line).length / wrap)), 0);
    if (textRows + rows.length + 1 > height) return null;
  }
  return code;
}

export async function runCloudwaysSetup(options = {}, deps = {}, io = {}) {
  const output = io.output || process.stdout;
  const lines = [];
  const steps = [];
  const say = (line, role = "body") => {
    lines.push(line);

    const indent = (String(line).match(/^ */) || [""])[0];
    const shown = indent ? String(line).replace(/\n(?=.)/g, `\n${indent}`) : line;
    output.write(`${terminalText(shown, role, output, io.env)}\n`);
  };
  const step = (index, text) => {
    if (index > 1) say("");
    say(`[${index}/${SETUP_STEP_COUNT}] ${text}`, "heading");
  };
  const record = (id, status, detail = null) => {
    steps.push({ id, status, detail });
  };

  const finish = (exitCode, help = exitCode === SETUP_EXIT_PROBLEM) => {
    if (help) say(`  ${STUCK_HELP_MESSAGE}`);
    return { exitCode, lines, steps };
  };

  const api = deps.api || null;
  const layout = deps.layout || resolveLayout(options);
  const verbDeps = isRecord(deps.verbDeps) ? { ...deps.verbDeps, layout } : { layout };
  const runVerb = typeof deps.runVerb === "function" ? deps.runVerb : runCloudwaysVerb;
  const isTty = typeof deps.isTty === "function" ? deps.isTty : defaultIsTty(io);
  const confirm = typeof deps.confirm === "function" ? deps.confirm : defaultConfirm(io);
  const sleep = typeof deps.sleep === "function"
    ? deps.sleep
    : (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const now = typeof deps.now === "function" ? deps.now : () => Date.now();
  const readConfig = typeof deps.readConfig === "function"
    ? deps.readConfig
    : () => (api && api.runtime && api.runtime.config && typeof api.runtime.config.current === "function"
      ? api.runtime.config.current()
      : null);
  const grantConversationAccess = typeof deps.grantConversationAccess === "function"
    ? deps.grantConversationAccess
    : defaultGrantConversationAccess(api);
  const provisionRelayCredential = typeof deps.provisionRelayCredential === "function"
    ? deps.provisionRelayCredential
    : createRelayCredentialProvision(api);
  const readRoute = typeof deps.readRoute === "function" ? deps.readRoute : defaultReadRoute(api, options);
  const runServeApply = typeof deps.runServeApply === "function"
    ? deps.runServeApply
    : (argv) => defaultRunCommand(argv, { timeoutMs: 30000 });

  const startCertificate = typeof deps.startCertificate === "function"
    ? deps.startCertificate
    : (typeof deps.readRoute === "function" ? null : defaultStartCertificate(layout));
  const pair = typeof deps.pair === "function" ? deps.pair : null;
  const pairingComplete = typeof deps.pairingComplete === "function"
    ? deps.pairingComplete
    : defaultPairingComplete(deps.controller);

  const firstUse = typeof deps.firstUse === "function"
    ? deps.firstUse
    : (api ? createFirstUseCommand(api) : null);
  const firstUseCall = typeof deps.firstUseCall === "function"
    ? deps.firstUseCall
    : (api ? defaultFirstUseCall(api) : null);

  const welcome = typeof deps.welcome === "function" ? deps.welcome : (api ? runSetupWelcome : null);
  const phonePresence = typeof deps.readPhonePresence === "function"
    ? deps.readPhonePresence
    : defaultReadPhonePresence(layout);
  const watchEnter = typeof deps.watchEnter === "function" ? deps.watchEnter : defaultWatchEnter(io);

  const watchAnswer = typeof deps.watchAnswer === "function" ? deps.watchAnswer : watchEnter;
  const phoneWaitS = Number(deps.phoneWaitS) > 0 ? Number(deps.phoneWaitS) : DEFAULT_PHONE_WAIT_S;
  const phonePollMs = Number(deps.phonePollMs) > 0 ? Number(deps.phonePollMs) : DEFAULT_PHONE_POLL_MS;
  const pollMs = Number(deps.pollMs) > 0 ? Number(deps.pollMs) : DEFAULT_POLL_MS;
  const noticeMs = Number(deps.noticeMs) > 0 ? Number(deps.noticeMs) : DEFAULT_NOTICE_MS;
  const answerWaitMs = Number(deps.answerWaitMs) > 0 ? Number(deps.answerWaitMs) : PAIR_READY_WAIT_MS;
  const certificateWaitMs = Number(deps.certificateWaitMs) > 0
    ? Number(deps.certificateWaitMs)
    : DEFAULT_CERTIFICATE_WAIT_MS;

  const installedVersion = typeof deps.installedVersion === "string"
    ? deps.installedVersion
    : (typeof PLUGIN_VERSION === "string" ? PLUGIN_VERSION : "");
  const readLoadedPlugin = typeof deps.readLoadedPlugin === "function"
    ? deps.readLoadedPlugin
    : defaultReadLoadedPlugin(deps.controller);

  const readModelStatus = typeof deps.readModelStatus === "function" ? deps.readModelStatus : defaultReadModelStatus;
  const runSignIn = typeof deps.runSignIn === "function" ? deps.runSignIn : defaultRunSignIn;

  const qrTerminal = typeof deps.qrTerminal === "function" ? deps.qrTerminal : defaultQrTerminal(io);

  const assumeYes = options.yes === true;

  const details = options.details === true;
  const skipPair = options.pair === false || options.noPair === true;
  const enrollWaitS = Number(options.wait) > 0 ? Number(options.wait) : DEFAULT_ENROLL_WAIT_S;
  const firstUseWaitS = Number(options.firstUseWait) > 0
    ? Number(options.firstUseWait)
    : DEFAULT_FIRST_USE_WAIT_S;

  const ask = async (consentLines, strict = false) => {
    if (assumeYes) {
      for (const line of consentLines) say(line);
      say(`  Approved by --yes.`, "detail");
      return true;
    }
    for (const line of consentLines) lines.push(line);
    return (await confirm(consentLines, strict)) === true;
  };

  const awaitTypedLine = (timeoutMs = answerWaitMs) => {
    const armedAt = now();
    let cancel = null;
    let answered = false;
    let timer = null;
    const typed = new Promise((resolve) => {

      timer = setTimeout(() => { if (!answered) { answered = true; resolve(null); } }, timeoutMs);
      if (timer && typeof timer.unref === "function") timer.unref();
      cancel = watchAnswer((chunk) => {
        if (answered) return;
        if (now() - armedAt < ENTER_SETTLE_MS) return;
        answered = true;
        resolve(typeof chunk === "string" ? chunk : "");
      });
    });
    return typed.then((chunk) => {
      if (timer) clearTimeout(timer);
      if (typeof cancel === "function") cancel();
      return chunk;
    });
  };

  let signInFailed = false;
  const ensureModelSignIn = async () => {
    const readSignedIn = async () => {
      try {
        const answer = await readModelStatus();
        return answer === true || answer === false ? answer : null;
      } catch (_) {
        return null;
      }
    };
    const signedIn = await readSignedIn();
    if (signedIn !== false) {
      record("model-sign-in", "skipped", signedIn === true ? "signed in" : "unreadable");
      return false;
    }
    if (assumeYes || !isTty()) {
      say(`  ${MODEL_NOT_SIGNED_IN_NOTICE}`);
      for (const line of MODEL_SIGN_IN_SELF_LINES) say(line);
      record("model-sign-in", "skipped", assumeYes ? "--yes" : "no terminal");
      return false;
    }
    say(`  ${MODEL_NOT_SIGNED_IN_MESSAGE}`);
    for (const line of MODEL_SIGN_IN_CHOICES) say(line);
    let choice = null;
    for (let asked = 0; asked < 3 && choice === null; asked += 1) {
      say(`  ${MODEL_SIGN_IN_QUESTION}`, "action");
      const typed = await awaitTypedLine();

      if (typed === null) { choice = "3"; break; }
      const answer = String(typed).trim();
      if (answer === "1" || answer === "2" || answer === "3") choice = answer;
    }
    if (choice === null || choice === "3") {
      for (const line of MODEL_SIGN_IN_SELF_LINES) say(line);
      for (const line of MODEL_SIGN_IN_RESUME_LINES) say(line);
      record("model-sign-in", "declined", "set up by the person");
      return true;
    }
    const argv = (choice === "1" ? MODEL_SIGN_IN_CODEX_ARGV : MODEL_SIGN_IN_API_KEY_ARGV).slice();
    say(`  Running: ${argv.join(" ")}`);

    let ran = null;
    try { ran = await runSignIn(argv); } catch (_) { ran = null; }
    const after = await readSignedIn();
    if (after === true || (after === null && ran && ran.code === 0)) {
      say(`  ${MODEL_SIGNED_IN_MESSAGE}`);
      record("model-sign-in", "done", choice === "1" ? "chatgpt" : "api-key");
      return false;
    }
    say(`  ${MODEL_SIGN_IN_UNFINISHED_MESSAGE}`);
    for (const line of MODEL_SIGN_IN_SELF_LINES) say(line);
    for (const line of MODEL_SIGN_IN_RESUME_LINES) say(line);
    record("model-sign-in", "failed", ran && ran.spawnFailed ? "command did not start" : "not signed in");
    signInFailed = true;
    return true;
  };

  step(1, "Cloudways host");
  let detected;
  try {
    detected = await runVerb("detect", {}, verbDeps);
  } catch (err) {
    say(`  Could not read this host: ${err && err.message ? err.message : err}`);
    record("detect", "failed", "detect threw");
    return finish(SETUP_EXIT_PROBLEM);
  }
  if (!detected || !detected.report || detected.report.verdict !== DETECT_CLOUDWAYS) {
    say(`  ${NOT_CLOUDWAYS_MESSAGE}`);
    record("detect", "refused", detected && detected.report ? detected.report.verdict : "unknown");
    return finish(SETUP_EXIT_PROBLEM);
  }
  say(`  ${detected.report.hostname} is a Cloudways Managed AI Agents container.`);
  say(`  ${NO_GATEWAY_RESTART_MESSAGE}`);
  say(`  ${IGNORE_HOST_RESTART_HINT_MESSAGE}`);
  record("detect", "done", detected.report.hostname);

  if (!assumeYes && !isTty()) {
    say(TTY_REQUIRED_MESSAGE);
    record("tty", "refused", "no terminal");
    return finish(SETUP_EXIT_PROBLEM);
  }
  if (await ensureModelSignIn()) return finish(SETUP_EXIT_STOPPED, signInFailed);

  step(2, "Conversation access");
  if (conversationAccessGranted(readConfig())) {
    say("  Settings already applied.");
    if (details) for (const line of conversationAccessConsentLines(true)) say(line);
    record("conversation-access", "skipped", "already granted");
  } else {
    const granted = await ask(conversationAccessConsentLines(details));
    if (!granted) {
      say(RESUME_MESSAGE);
      record("conversation-access", "declined", null);
      return finish(SETUP_EXIT_STOPPED);
    }
    try {
      await grantConversationAccess();
    } catch (err) {
      say(`  Could not record the grant: ${err && err.message ? err.message : err}`);
      record("conversation-access", "failed", "write refused");
      return finish(SETUP_EXIT_PROBLEM);
    }
    say("  Conversation access granted.");
    record("conversation-access", "done", null);
  }

  step(3, "OcuClaw");
  let credential;
  try {
    credential = await provisionRelayCredential({ operation: PROVISION_RELAY_CREDENTIAL_OPERATION });
  } catch (err) {
    say(`  ${OCUCLAW_NOT_LOADED_MESSAGE}`);
    for (const line of OCUCLAW_NOT_LOADED_HELP_LINES) say(line);
    record("relay-credential", "failed", err && err.code ? err.code : "error");
    return finish(SETUP_EXIT_PROBLEM);
  }
  record("relay-credential",
    credential && credential.status === "preserved" ? "skipped" : "done",
    credential && credential.status === "preserved" ? "preserved" : "provisioned");

  let loaded = null;
  for (let attempt = 0; attempt < LOADED_CHECK_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await sleep(LOADED_CHECK_RETRY_MS);
    try { loaded = await readLoadedPlugin(); } catch (_) { loaded = null; }
    if (loaded && typeof loaded.version === "string" && loaded.version) break;
    loaded = null;
  }
  const loadedVersion = loaded ? loaded.version : null;
  if (loadedVersion === null || (installedVersion && loadedVersion !== installedVersion)) {
    say(loadedVersion === null
      ? `  ${OCUCLAW_NOT_LOADED_MESSAGE}`
      : `  ${ocuclawOldVersionMessage(loadedVersion, installedVersion)}`);
    for (const line of OCUCLAW_RESTART_LINES) {
      say(line, line.startsWith("    ") ? "action" : "body");
    }
    record("plugin-loaded", "failed", loadedVersion === null ? "not loaded" : "version mismatch");
    return finish(SETUP_EXIT_STOPPED);
  }
  say(`  ${OCUCLAW_LOADED_MESSAGE}`);
  record("plugin-loaded", "done", loadedVersion);

  step(4, "Tailscale");
  let state = await runVerb("status", {}, verbDeps);
  let report = state.report || {};
  const installed = !!(report.binaries && report.binaries.present) && !!report.receipt;
  if (installed) {
    say("  Tailscale is already installed.");
    record("install", "skipped", "installed");
  } else {
    const installResult = await runVerb("install", {}, verbDeps);
    if (!installResult.report || installResult.report.ok !== true) {
      for (const line of installResult.lines || []) say(`  ${line}`);
      record("install", "failed", installResult.report ? installResult.report.error : "install failed");
      return finish(SETUP_EXIT_PROBLEM);
    }
    say("  Tailscale installed.");
    record("install", "done", installResult.report.version || null);
    state = await runVerb("status", {}, verbDeps);
    report = state.report || {};
  }
  let daemonState = report.daemon ? report.daemon.state : null;
  if (daemonState !== STATE_RUNNING && daemonState !== STATE_NEEDS_AUTH) {
    const enabled = await runVerb("enable", {}, verbDeps);
    if (!enabled.report || enabled.report.ok !== true) {
      for (const line of enabled.lines || []) say(`  ${line}`);
      record("daemon", "failed", enabled.report ? enabled.report.error : "daemon refused");
      return finish(SETUP_EXIT_PROBLEM);
    }
    say("  Tailscale started.");
    record("daemon", "done", null);
    state = await runVerb("status", {}, verbDeps);
    report = state.report || {};
    daemonState = report.daemon ? report.daemon.state : null;
  } else if (daemonState === STATE_RUNNING) {
    say("  Tailscale is running.");
    record("daemon", "skipped", daemonState);
  } else {
    say("  Tailscale is running. Server approval is still needed.");
    record("daemon", "skipped", daemonState);
  }

  step(5, "Connect to Tailscale");
  if (daemonState === STATE_RUNNING) {
    say("  This server is already approved.");
    record("enroll", "skipped", STATE_RUNNING);
  } else {
    const enrolled = await runVerb(
      "enroll",
      { hostname: options.hostname || null, wait: 90 },
      verbDeps,
    );
    const enrollReport = enrolled.report || {};

    if (enrollReport.staleMarkerCleared === true) say(`  ${STALE_ENROLLMENT_MESSAGE}`);
    if (enrollReport.state === STATE_RUNNING) {
      say("  This server is already approved.");
      record("enroll", "skipped", STATE_RUNNING);
    } else if (!enrollReport.authUrl) {
      for (const line of enrolled.lines || []) say(`  ${line}`);
      record("enroll", "failed", enrollReport.error || "no authorization link");
      return finish(SETUP_EXIT_PROBLEM);
    } else {

      say(ENROLL_INSTALL_TAILSCALE_LINE);
      const orOpen = `${ENROLL_OR_OPEN_PREFIX}${enrollReport.authUrl}`;
      const qr = approvalLinkQr(enrollReport.authUrl, qrTerminal(), options.lightTerminal === true,
        [`[5/${SETUP_STEP_COUNT}] Connect to Tailscale`, ENROLL_INSTALL_TAILSCALE_LINE, ENROLL_QR_PROMPT],
        [orOpen, "  Waiting for server approval."]);
      if (qr) {
        say(ENROLL_QR_PROMPT, "action");

        for (const row of qr.split("\n")) say(row);
        say(orOpen);
      } else {
        for (const line of ENROLL_ON_PHONE_LINES) say(line, "action");
        say(`    ${enrollReport.authUrl}`);
      }
      const deadline = now() + enrollWaitS * 1000;
      let lastNotice = now();
      let running = false;
      for (;;) {
        const polled = await runVerb("status", {}, verbDeps);
        const polledState = polled.report && polled.report.daemon ? polled.report.daemon.state : null;
        if (polledState === STATE_RUNNING) { running = true; break; }
        if (now() >= deadline) break;
        if (now() - lastNotice >= noticeMs) {
          lastNotice = now();
          say("  Waiting for server approval.");
        }
        await sleep(pollMs);
      }
      if (!running) {
        say("  Server approval timed out. Run setup again to resume.");
        record("enroll", "failed", "timeout");
        return finish(SETUP_EXIT_PROBLEM);
      }
      say("  Server approved.");
      record("enroll", "done", null);
    }
  }

  step(6, "Private route for your phone");
  const relayPort = deps.relayPort !== undefined && deps.relayPort !== null
    ? deps.relayPort
    : await defaultRelayPort(api, deps.controller)();
  let route = await readRoute(relayPort);
  if (route && route.status === ROUTE_STATUS_HEALTHY) {
    say("  Private route is already configured.");
    record("serve", "skipped", ROUTE_STATUS_HEALTHY);
  } else {
    const port = servePort(options.servePort);
    const tailscaleArgv = cliArgv(layout);
    const command = applyCommand(relayPort, port, tailscaleArgv);

    const approved = await ask(serveConsentLines(command, details), true);
    if (!approved) {
      say(RESUME_MESSAGE);
      record("serve", "declined", null);
      return finish(SETUP_EXIT_STOPPED);
    }
    const applied = await runServeApply(serveApplyArgv(relayPort, port, tailscaleArgv));
    if (!applied || applied.code !== 0) {
      const detail = applied && applied.stderr ? String(applied.stderr).trim() : "no output";
      say(`  The route could not be published: ${detail}`);
      record("serve", "failed", detail);
      return finish(SETUP_EXIT_PROBLEM);
    }
    say("  Private route configured.");

    say(`  ${COLD_CERTIFICATE_MESSAGE}`);

    const started = now();
    const deadline = started + certificateWaitMs;
    let nextProgress = started + CERTIFICATE_PROGRESS_MS;
    let healthy = false;
    let issuance = null;
    let certificateAskable = startCertificate !== null;
    let issued = false;
    let calls = 0;
    let lastStart = null;
    try {
      for (;;) {
        if (issuance) {
          const outcome = issuance.poll();
          if (outcome !== null) {
            const ranMs = typeof issuance.ranMs === "function" ? issuance.ranMs() : null;
            issuance.stop();
            issuance = null;
            if (outcome === ISSUANCE_AVAILABLE) issued = true;
            else if (outcome === ISSUANCE_UNAVAILABLE) certificateAskable = false;

            else if (outcome === ISSUANCE_UNKNOWN && ranMs !== null && ranMs < CERTIFICATE_QUICK_FAIL_MS) certificateAskable = false;
          }
        }
        if (certificateAskable && !issued && !issuance && calls >= CERTIFICATE_MAX_CALLS) certificateAskable = false;
        if (certificateAskable && !issued && !issuance
          && (lastStart === null || now() - lastStart >= CERTIFICATE_RETRY_MS)) {
          lastStart = now();
          calls += 1;
          try {
            issuance = await startCertificate(Math.max(1000, deadline - lastStart));
          } catch (_) {
            issuance = null;
          }
          if (!issuance) certificateAskable = false;
        }
        if (issued || !certificateAskable) {
          route = await readRoute(relayPort);
          if (route && route.status === ROUTE_STATUS_HEALTHY) { healthy = true; break; }
        }
        if (now() >= deadline) break;
        if (now() >= nextProgress) {
          const periods = Math.floor((now() - started) / CERTIFICATE_PROGRESS_MS);
          say(`  ${certificateProgressMessage((periods * CERTIFICATE_PROGRESS_MS) / 1000)}`);
          nextProgress = started + (periods + 1) * CERTIFICATE_PROGRESS_MS;
        }
        await sleep(Math.max(0, Math.min(pollMs, deadline - now())));
      }
    } finally {
      if (issuance) issuance.stop();
    }
    if (!healthy) {
      say(`  ${CERTIFICATE_TIMEOUT_MESSAGE}`);
      record("serve", "failed", route ? route.status : "unknown");
      return finish(SETUP_EXIT_PROBLEM);
    }
    say("  Certificate ready.");
    record("serve", "done", null);
  }

  const awaitPhoneOnTailnet = async () => {
    const look = async () => {
      let answer = null;
      try {
        answer = await phonePresence();
      } catch (_) {
        return { found: false, readable: false };
      }
      const found = !!(answer && answer.found === true);
      return { found, readable: found || !!(answer && answer.readable === true) };
    };

    const first = await look();
    if (first.found) {
      say(`  ${PHONE_PRESENT_MESSAGE}`);
      record("phone-check", "done", "present");
      return { stopped: false, found: true };
    }
    if (!first.readable) {

      record("phone-check", "skipped", "unreadable");
      return { stopped: false, found: false };
    }

    if (!isTty()) {
      say(`  ${PHONE_NO_TERMINAL_MESSAGE}`);
      record("phone-check", "skipped", "no terminal");
      return { stopped: false, found: false };
    }

    for (const line of PHONE_WALKTHROUGH_LINES) say(line, line.startsWith("Waiting") ? "action" : "body");
    let carriedOn = false;

    const armedAt = now();
    const cancelEnter = watchEnter(() => {
      if (now() - armedAt >= ENTER_SETTLE_MS) carriedOn = true;
    });
    let appeared = false;
    try {
      const deadline = now() + phoneWaitS * 1000;
      while (!carriedOn) {
        if (now() >= deadline) break;
        await sleep(phonePollMs);
        if (carriedOn) break;
        const again = await look();
        if (again.found) { appeared = true; break; }

      }
    } finally {
      if (typeof cancelEnter === "function") cancelEnter();
    }
    if (appeared) {
      say(`  ${PHONE_APPEARED_MESSAGE}`);
      record("phone-check", "done", "appeared");
      return { stopped: false, found: true };
    }
    if (carriedOn) {
      say(`  ${PHONE_CARRY_ON_MESSAGE}`);
      record("phone-check", "skipped", "carried on");
      return { stopped: false, found: false };
    }
    say(`  ${PHONE_WAIT_TIMEOUT_MESSAGE}`);

    record("phone-check", "declined", "timeout");
    return { stopped: true, found: false };
  };

  step(7, "Pair your phone");
  let phonePaired = false;
  if (await pairingComplete()) {
    say("  A phone is already paired.");
    record("pair", "skipped", "already paired");
    phonePaired = true;
  } else if (skipPair) {
    say("  Pairing skipped (--no-pair).\nWhen ready, run openclaw ocuclaw pair.");
    record("pair", "skipped", "--no-pair");
  } else if (typeof pair !== "function") {
    say("  This host cannot run the terminal pairing ceremony. Run openclaw ocuclaw pair yourself.");
    record("pair", "failed", "pairing unavailable");
    return finish(SETUP_EXIT_PROBLEM);
  } else {
    const phoneCheck = await awaitPhoneOnTailnet();
    if (phoneCheck.stopped) {
      record("pair", "skipped", "no phone on the tailnet");
      return finish(SETUP_EXIT_STOPPED);
    }

    const interactive = !assumeYes && isTty();
    if (interactive) {
      for (const line of PAIR_READY_LINES) say(line, "action");
      await awaitTypedLine();
    }
    let attempts = 0;
    for (;;) {
      const paired = await pair({ lightTerminal: options.lightTerminal === true }, { driven: true });
      attempts += 1;
      const exitCode = paired && Number.isInteger(paired.exitCode) ? paired.exitCode : SETUP_EXIT_PROBLEM;
      const outcome = paired ? paired.outcome || null : null;
      if (exitCode === SETUP_EXIT_OK) {
        record("pair", "done", outcome);
        phonePaired = true;
        break;
      }

      if (outcome !== "expired") {
        record("pair", "failed", outcome);
        const decided = outcome === "refused" || outcome === "cancelled";
        return finish(exitCode, !decided && exitCode === SETUP_EXIT_PROBLEM);
      }
      say(`  ${pairingExpiryMessage(paired?.phase)}`);

      if (paired?.phase === "waiting-for-phone") {
        for (const line of PAIR_TIMEOUT_CAUSE_LINES) say(`  ${line}`);
        say(`  ${PAIR_SCREEN_NOT_OPEN_MESSAGE}`);
      }

      if (!interactive || attempts > PAIR_RETRY_LIMIT) {
        record("pair", "failed", outcome);
        return finish(exitCode);
      }
      say(PAIR_RETRY_PROMPT_MESSAGE, "action");
      const typed = await awaitTypedLine();

      if (typed === null) {
        say(`  ${PAIR_RETRY_NO_ANSWER_MESSAGE}`);
        record("pair", "failed", "no answer");
        return finish(exitCode);
      }
      const answer = String(typed).trim().toLowerCase();
      if (answer === PAIR_RETRY_STOP_ANSWER) {
        record("pair", "failed", outcome);

        return finish(exitCode, false);
      }
    }
  }

  step(8, "First message");
  if (!phonePaired || options.firstUse === false) {
    say(`  ${FIRST_USE_SKIPPED_MESSAGE}`);
    record("first-use", "skipped", options.firstUse === false ? "--no-first-use" : "--no-pair");
    return finish(SETUP_EXIT_OK);
  }
  if (typeof firstUse !== "function" || typeof firstUseCall !== "function") {
    say(`  ${FIRST_USE_UNAVAILABLE_MESSAGE}`);
    record("first-use", "failed", "first-use unavailable");
    return finish(SETUP_EXIT_PROBLEM);
  }

  const callFirstUse = async (params) => {
    try { return { ok: true, record: recordOf(await firstUseCall(params)) }; }
    catch (err) { return { ok: false, reason: firstUseFailureReason(err) }; }
  };

  const current = await callFirstUse({ operation: "first_use_wait" });
  if (current.ok && current.record && current.record.status === "completed") {
    say(`  ${FIRST_USE_ALREADY_COMPLETE_VALUE}`);
    record("first-use", "skipped", "already complete");
    return finish(SETUP_EXIT_OK);
  }

  const armed = await callFirstUse({ operation: "begin" });
  if (!armed.ok || !armed.record) {
    say(`  Could not start the first-message check: ${armed.reason || "unavailable"}.`);
    record("first-use", "failed", armed.reason || "unavailable");
    return finish(SETUP_EXIT_PROBLEM);
  }

  if (armed.record.status === "awaiting-reply") {
    say(`  In the paired conversation on your phone, send ${FIRST_USE_SEND_TEXT_VALUE}.`, "action");
    say("  Waiting for the reply on your glasses...");
  }

  const waited = await awaitFirstUseReply({
    call: callFirstUse,
    say: (text, kind = null) => say(`  ${text}`, kind),
    now, sleep,
    waitMs: firstUseWaitS * 1000,
    pollMs, noticeMs,
    strictPhone: true,
    initialStatus: armed.record.status,
  });
  if (waited.outcome === "unavailable") {
    const reason = waited.reason || "unavailable";
    say(`  Could not check the first message: ${reason}.`);
    record("first-use", "failed", reason);
    return finish(SETUP_EXIT_PROBLEM);
  }
  if (waited.outcome === "timeout" || waited.outcome === "cancelled") {
    say(`  ${FIRST_USE_TIMEOUT_MESSAGE}`);
    record("first-use", "failed", "timeout");
    return finish(SETUP_EXIT_PROBLEM);
  }

  if (waited.outcome === "errored") {
    const replyReason = waited.reason;
    say(`  ${replyReason === "reply_run_rate_limited" ? FIRST_USE_REPLY_RATE_LIMIT_MESSAGE : FIRST_USE_REPLY_ERROR_MESSAGE}`);
    record("first-use", "failed", replyReason);
    return finish(SETUP_EXIT_PROBLEM);
  }
  say(`  ${FIRST_USE_REPLY_VALUE}`);

  const ceremony = await firstUse(options.testInput === true
    ? { testInput: true, waitForReply: false }
    : { waitForReply: false });
  const ceremonyExit = ceremony && Number.isInteger(ceremony.exitCode)
    ? ceremony.exitCode
    : SETUP_EXIT_PROBLEM;
  if (ceremonyExit !== SETUP_EXIT_OK) {
    say(`  ${FIRST_USE_PENDING_MESSAGE}`);
    record("first-use", "failed", "not confirmed");
    return finish(ceremonyExit);
  }
  if (ceremony && ceremony.testInput === true) {
    say(`  ${FIRST_USE_TEST_INPUT_MESSAGE}`);
    record("first-use", "skipped", "test-input");
    return finish(SETUP_EXIT_OK);
  }
  const settled = await callFirstUse({ operation: "first_use_wait" });
  const settledStatus = settled.ok && settled.record ? settled.record.status : null;
  if (settledStatus === "awaiting-welcome") {
    if (typeof welcome !== "function") {
      say(`  ${FIRST_USE_WELCOME_UNAVAILABLE_MESSAGE}`);
      record("first-use", "done", "awaiting-welcome");
      return finish(SETUP_EXIT_OK);
    }

    const mirror = { write: (chunk) => {
      for (const line of String(chunk).split("\n")) if (line) lines.push(line);
      return output.write(chunk);
    } };
    const nextOperations = Array.isArray(settled.record.nextOperations) ? settled.record.nextOperations : [];
    const shown = await welcome(api, {
      binding: settled.record.binding,
      retry: nextOperations.includes("first_use_welcome_retry"),
    }, { output: mirror });
    if (!shown || shown.ok !== true) {
      const outcome = (shown && shown.outcome) || "unavailable";

      if (outcome === "unavailable") {
        record("first-use", "done", "awaiting-welcome");
        return finish(SETUP_EXIT_OK);
      }
      record("first-use", "failed", outcome);
      return finish(SETUP_EXIT_PROBLEM);
    }
    record("first-use", "done", "welcome-dismissed");
    return finish(SETUP_EXIT_OK);
  }

  if (settledStatus !== "completed") say(SETUP_COMPLETE_MESSAGE);
  record("first-use", "done", settledStatus || "completed");
  return finish(SETUP_EXIT_OK);
}

function recordOf(result) {
  return result && isRecord(result.record) ? result.record : null;
}
