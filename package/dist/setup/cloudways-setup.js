import { runCloudwaysVerb } from "./cloudways-command.js";
import { terminalText } from "./terminal-text.js";
import {
  cliArgv,
  defaultRunCommand,
  DETECT_CLOUDWAYS,
  resolveLayout,
  STATE_NEEDS_AUTH,
  STATE_RUNNING,
} from "./cloudways.js";
import {
  applyCommand,
  defaultRunTailscale,
  LOOPBACK,
  readPhonePresence,
  ROUTE_STATUS_HEALTHY,
  servePort,
} from "./private-route.js";
import { readPrivateRoute } from "./setup-live.js";
import { setupInstallation } from "./setup-journey.js";
import { resolveSetupStateDir } from "./setup-controller.js";
import { createRelayCredentialProvision, PROVISION_RELAY_CREDENTIAL_OPERATION } from "./relay-credential-provision.js";
import { createFirstUseCommand, runSetupWelcome, setupFirstUseRequest } from "./first-use-command.js";
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
  "Waiting for the certificate. This usually takes about a minute.";

export const NO_GATEWAY_RESTART_MESSAGE =
  "No gateway restart is needed on Cloudways.";

export const OCUCLAW_LOADED_MESSAGE = "OcuClaw is loaded and ready.";

export const OCUCLAW_NOT_LOADED_MESSAGE =
  "OcuClaw is installed but your agent has not loaded it yet.";

export const OCUCLAW_NOT_LOADED_HELP_LINES = [
  "  This host normally loads the plugin without a restart.",
  "  If OcuClaw stays unloaded, run openclaw ocuclaw doctor.",
];

export const ENROLL_ON_PHONE_LINES = [
  "  On your phone, sign in to Tailscale. Open this link to approve this server:",
];

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
  "Open Even > OcuClaw on your phone.",
  "The next pairing code expires in 2 minutes.",
  "Press Enter to show the code.",
];

export const PAIR_RETRY_PROMPT_MESSAGE =
  "Press Enter for a new code, or type stop:";

export const PAIR_RETRY_STOP_ANSWER = "stop";

export const PAIR_RETRY_LIMIT = 3;

export const PAIR_TIMEOUT_CAUSE_MESSAGE =
  "Most often this means Tailscale is switched off, or signed in to a different account, on your phone.";

export const PAIR_NOBODY_ENTERED_MESSAGE = "Code expired before a phone joined.";

export function pairingExpiryMessage(phase) {
  if (phase === "waiting-for-phone") return PAIR_NOBODY_ENTERED_MESSAGE;
  if (phase === "awaiting-approval") return "Pairing expired while waiting for approval.";
  if (phase === "awaiting-phone-connection") return "Approval was sent, but your phone's connection was not confirmed in time. Check your phone before retrying.";
  return "Pairing did not finish before the code expired.";
}

export const FIRST_USE_SEND_TEXT = "hello";

export const FIRST_USE_ALREADY_COMPLETE_MESSAGE =
  "First-message setup is already complete.";

export const FIRST_USE_SKIPPED_MESSAGE =
  "First-message check skipped.\nWhen ready, run openclaw ocuclaw first-use.";

export const FIRST_USE_UNAVAILABLE_MESSAGE =
  "Setup cannot start the first-message check on this host.\nRun openclaw ocuclaw first-use in your terminal.";

export const FIRST_USE_WAITING_MESSAGE = "Waiting for the phone reply.";

export const FIRST_USE_REARMED_MESSAGE =
  "First-message check restarted for the phone you just paired.";

export const FIRST_USE_REPLY_MESSAGE = "Phone reply received.";

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
const DEFAULT_CERTIFICATE_WAIT_MS = 120000;

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

export async function runCloudwaysSetup(options = {}, deps = {}, io = {}) {
  const output = io.output || process.stdout;
  const lines = [];
  const steps = [];
  const say = (line, role = "body") => {
    lines.push(line);
    output.write(`${terminalText(line, role, output, io.env)}\n`);
  };
  const step = (index, text) => {
    if (index > 1) say("");
    say(`[${index}/${SETUP_STEP_COUNT}] ${text}`, "heading");
  };
  const record = (id, status, detail = null) => {
    steps.push({ id, status, detail });
  };
  const finish = (exitCode) => ({ exitCode, lines, steps });

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
  const certificateWaitMs = Number(deps.certificateWaitMs) > 0
    ? Number(deps.certificateWaitMs)
    : DEFAULT_CERTIFICATE_WAIT_MS;

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

  step(1, "Cloudways host");
  let detected;
  try {
    detected = await runVerb("detect", {}, verbDeps);
  } catch (err) {
    say(`  could not read this host: ${err && err.message ? err.message : err}`);
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
  record("detect", "done", detected.report.hostname);

  if (!assumeYes && !isTty()) {
    say(TTY_REQUIRED_MESSAGE);
    record("tty", "refused", "no terminal");
    return finish(SETUP_EXIT_PROBLEM);
  }

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
      say(`  could not record the grant: ${err && err.message ? err.message : err}`);
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
  say(`  ${OCUCLAW_LOADED_MESSAGE}`);
  record("relay-credential",
    credential && credential.status === "preserved" ? "skipped" : "done",
    credential && credential.status === "preserved" ? "preserved" : "provisioned");

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
    if (enrollReport.state === STATE_RUNNING) {
      say("  This server is already approved.");
      record("enroll", "skipped", STATE_RUNNING);
    } else if (!enrollReport.authUrl) {
      for (const line of enrolled.lines || []) say(`  ${line}`);
      record("enroll", "failed", enrollReport.error || "no authorization link");
      return finish(SETUP_EXIT_PROBLEM);
    } else {
      for (const line of ENROLL_ON_PHONE_LINES) say(line, "action");
      say(`    ${enrollReport.authUrl}`);
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
      say(`  the route could not be published: ${detail}`);
      record("serve", "failed", detail);
      return finish(SETUP_EXIT_PROBLEM);
    }
    say("  Private route configured.");

    say(`  ${COLD_CERTIFICATE_MESSAGE}`);
    const deadline = now() + certificateWaitMs;
    let healthy = false;
    for (;;) {
      route = await readRoute(relayPort);
      if (route && route.status === ROUTE_STATUS_HEALTHY) { healthy = true; break; }
      if (now() >= deadline) break;
      await sleep(pollMs);
    }
    if (!healthy) {
      say("  the certificate has not been issued yet. Run the same command again.");
      record("serve", "failed", route ? route.status : "unknown");
      return finish(SETUP_EXIT_PROBLEM);
    }
    say("  Certificate ready.");
    record("serve", "done", null);
  }

  const awaitTypedLine = (timeoutMs = PAIR_READY_WAIT_MS) => {
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
    say("  this host cannot run the terminal pairing ceremony. Run openclaw ocuclaw pair yourself.");
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
        return finish(exitCode);
      }
      say(`  ${pairingExpiryMessage(paired?.phase)}`);

      if (!interactive || attempts > PAIR_RETRY_LIMIT) {
        record("pair", "failed", outcome);
        return finish(exitCode);
      }
      say(PAIR_RETRY_PROMPT_MESSAGE, "action");
      const typed = await awaitTypedLine();

      if (typed === null) {
        record("pair", "failed", outcome);
        return finish(exitCode);
      }
      const answer = String(typed).trim().toLowerCase();
      if (answer === PAIR_RETRY_STOP_ANSWER) {
        record("pair", "failed", outcome);
        return finish(exitCode);
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
    say(`  ${FIRST_USE_ALREADY_COMPLETE_MESSAGE}`);
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
    say(`  In the paired conversation on your phone, send ${FIRST_USE_SEND_TEXT}.`, "action");
    say("  Waiting for the reply on your glasses...");
  }

  const firstUseDeadline = now() + firstUseWaitS * 1000;
  let lastReplyNotice = now();
  let rearmed = false;
  let replied = false;
  let lastRecord = null;
  for (;;) {
    const polled = await callFirstUse({ operation: "first_use_wait" });
    if (!polled.ok) {

      if (polled.reason === "setup-session-mismatch" && !rearmed) {
        rearmed = true;
        const again = await callFirstUse({ operation: "first_use_retry" });
        if (again.ok && again.record) {
          say(`  ${FIRST_USE_REARMED_MESSAGE}`);
          continue;
        }
        say(`  Could not restart the first-message check: ${again.reason || "unavailable"}.`);
        record("first-use", "failed", again.reason || "unavailable");
        return finish(SETUP_EXIT_PROBLEM);
      }
      say(`  Could not check the first message: ${polled.reason}.`);
      record("first-use", "failed", polled.reason);
      return finish(SETUP_EXIT_PROBLEM);
    }
    const status = polled.record ? polled.record.status : null;
    if (status && status !== "awaiting-reply") { lastRecord = polled.record; replied = true; break; }
    if (now() >= firstUseDeadline) break;
    if (now() - lastReplyNotice >= noticeMs) {
      lastReplyNotice = now();
      say(`  ${FIRST_USE_WAITING_MESSAGE}`);
    }
    await sleep(pollMs);
  }
  if (!replied) {
    say(`  ${FIRST_USE_TIMEOUT_MESSAGE}`);
    record("first-use", "failed", "timeout");
    return finish(SETUP_EXIT_PROBLEM);
  }

  const replyReason = (replied && lastRecord && lastRecord.replyEvidenceReason) || null;
  if (replyReason === "reply_run_errored" || replyReason === "reply_run_rate_limited") {
    say(`  ${replyReason === "reply_run_rate_limited" ? FIRST_USE_REPLY_RATE_LIMIT_MESSAGE : FIRST_USE_REPLY_ERROR_MESSAGE}`);
    record("first-use", "failed", replyReason);
    return finish(SETUP_EXIT_PROBLEM);
  }
  say(`  ${FIRST_USE_REPLY_MESSAGE}`);

  const ceremony = await firstUse(options.testInput === true ? { testInput: true } : {});
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
  say(SETUP_COMPLETE_MESSAGE);
  record("first-use", "done", settledStatus || "completed");
  return finish(SETUP_EXIT_OK);
}

function recordOf(result) {
  return result && isRecord(result.record) ? result.record : null;
}
