import { realpathSync } from "node:fs";

import { createRequire } from "node:module";

import { pathToFileURL } from "node:url";

import process from "node:process";
import { setupInstallation, FIRST_USE_RETRY, firstUseSuccess, OPTIONAL_SETUP_HANDOFF } from "./setup-journey.js";
import { resolveSetupStateDir } from "./setup-controller.js";
import { createFirstUseStore, firstUseBinding, firstUseResult, FIRST_USE_WAIT_MAX_MS, FIRST_USE_RECEIPT_SETTLE_MAX_MS, FIRST_USE_TOOL_OPERATIONS, validateFirstUseParams } from "./first-use.js";
import { terminalText } from "./terminal-text.js";

const METHOD = "ocuclaw.setup.firstUse";

export const SETUP_WELCOME_METHOD = "ocuclaw.setup.welcome";
export const SETUP_WELCOME_OPERATIONS = Object.freeze(["first_use_welcome", "first_use_welcome_retry"]);
export const SETUP_WELCOME_CANCEL_OPERATION = "first_use_welcome_cancel";

export function registerSetupFirstUseControl(api     , service     ) {
  if (api?.registrationMode !== "full" || typeof api.registerGatewayMethod !== "function") return;
  api.registerGatewayMethod(METHOD, async ({ params, respond }     ) => {
    const installation = setupInstallation(resolveSetupStateDir(api));
    try {
      if (!installation.id || params?.installationId !== installation.id) throw new Error("installation-mismatch");
      const toolOperation = FIRST_USE_TOOL_OPERATIONS.includes(params.operation);
      if (!toolOperation && params.operation !== "begin") throw new Error("terminal-confirmation-required");
      if (toolOperation) {
        const { installationId, testInput, ...operationParams } = params;
        validateFirstUseParams(operationParams);
      }
      const relay = service.getRelay();
      if (typeof relay?.setupFirstUse !== "function") throw new Error("runtime-unavailable");
      const record = relay.setupFirstUse(params.operation, params);
      respond(true, { installation, record, testInput: params.testInput === true });
    } catch (error) {

      const reason = error instanceof Error && /^(setup-[a-z-]+|installation-mismatch|runtime-unavailable)$/.test(error.message) ? error.message : "setup-first-use-unavailable";
      respond(false, undefined, { code: "INVALID_REQUEST", message: `${reason}: Re-read journey; preserve existing setup state.` });
    }
  }, { scope: "operator.admin" });
}

export function registerSetupWelcomeControl(api     , service     ) {
  if (api?.registrationMode !== "full" || typeof api.registerGatewayMethod !== "function") return;
  api.registerGatewayMethod(SETUP_WELCOME_METHOD, async ({ params, respond }     ) => {
    const installation = setupInstallation(resolveSetupStateDir(api));
    try {
      if (!installation.id || params?.installationId !== installation.id) throw new Error("installation-mismatch");
      const relay = service.getRelay();

      if (params.operation === SETUP_WELCOME_CANCEL_OPERATION) {
        if (typeof relay?.cancelSetupWelcome !== "function") throw new Error("runtime-unavailable");
        respond(true, { installation, cancelled: relay.cancelSetupWelcome() === true });
        return;
      }
      const { installationId, ...operationParams } = params;
      validateFirstUseParams(operationParams);
      if (!SETUP_WELCOME_OPERATIONS.includes(params.operation)) throw new Error("setup-welcome-operation-unsupported");
      if (typeof relay?.setupWelcome !== "function") throw new Error("runtime-unavailable");
      const record = await relay.setupWelcome({
        ...operationParams, installationId: installation.id,
        timeoutMs: operationParams.timeoutMs ?? FIRST_USE_WAIT_MAX_MS,
        retry: params.operation === "first_use_welcome_retry",
      }, null);
      respond(true, { installation, record });
    } catch (error) {

      const reason = error instanceof Error && /^(setup-[a-z-]+|installation-mismatch|runtime-unavailable)$/.test(error.message) ? error.message : "setup-welcome-unavailable";
      respond(false, undefined, { code: "INVALID_REQUEST", message: `${reason}: Re-read journey; preserve existing setup state.` });
    }
  }, { scope: "operator.admin" });
}

export function createFirstUseTool(api     , transport      = setupFirstUseRequest, service      = null) {
  return async (params     , signal      = null) => {
    validateFirstUseParams(params);
    const installation = setupInstallation(resolveSetupStateDir(api));
    if (!installation.id) return { status: "unavailable", reason: "setup-state-unavailable" };

    const waitMs = params.timeoutMs === undefined ? FIRST_USE_WAIT_MAX_MS
      : Math.max(0, params.timeoutMs - Math.min(1000, params.timeoutMs / 2));
    const deadline = Date.now() + waitMs;

    const projectWelcomeCapability = (result     ) => {
      if (!result?.nextOperations?.some((op        ) => op.startsWith("first_use_welcome"))) return result;
      if (service?.getRelay?.()?.setupWelcomeAvailable?.() === true) return result;
      return { ...result, nextOperations: [], welcome: { ...result.welcome, capability: "unavailable" } };
    };

    const cancelledBeforeRead = () => {
      try { return { ...projectWelcomeCapability(firstUseResult(createFirstUseStore(resolveSetupStateDir(api)).read())), wait: "cancelled" }; }
      catch (error) { return { status: "unavailable", reason: error instanceof Error ? error.message : "setup-first-use-unavailable", wait: "cancelled" }; }
    };
    let last      = null;

    let receiptSettleDeadline                = null;
    do {
      if (signal?.aborted) return last ? { ...projectWelcomeCapability(last), wait: "cancelled" } : cancelledBeforeRead();
      try {
        const relay = service?.getRelay?.();
        if (["first_use_welcome", "first_use_welcome_retry"].includes(params.operation)) {
          if (typeof relay?.setupWelcome !== "function") throw new Error("setup-welcome-unavailable");
          return await relay.setupWelcome({ ...params, installationId: installation.id,
            timeoutMs: waitMs, retry: params.operation === "first_use_welcome_retry" }, signal);
        } else if (params.operation === "first_use_wait") {

          if (typeof relay?.setupFirstUse !== "function") throw new Error("runtime-unavailable");
          last = relay.setupFirstUse(params.operation, { ...params, installationId: installation.id });
        } else {
          const result = await transport({ ...params, installationId: installation.id });
          if (result?.installation?.id !== installation.id || !result.record?.status) throw new Error("setup-context-mismatch");
          last = result.record;
        }
      } catch (error) {
        const reason = error instanceof Error ? /\b(setup-[a-z-]+|installation-mismatch|runtime-unavailable)(?:$|:)/.exec(error.message)?.[1] : null;
        return { status: "unavailable", reason: reason ?? "setup-first-use-unavailable",
          action: "Re-read journey. Check the owning runtime and intended phone session; preserve existing setup state." };
      }
      if (signal?.aborted) return { ...projectWelcomeCapability(last), wait: "cancelled" };
      if (params.operation !== "first_use_wait") return projectWelcomeCapability(last);

      if (last.status === "awaiting-confirmation" && last.replyEvidenceReason === "observation_pending") {
        if (receiptSettleDeadline === null) {
          receiptSettleDeadline = Math.min(deadline, Date.now() + FIRST_USE_RECEIPT_SETTLE_MAX_MS);
        }
        if (Date.now() >= receiptSettleDeadline) return projectWelcomeCapability(last);
      } else if (last.status !== "awaiting-reply") {
        return projectWelcomeCapability(last);
      }
      if (Date.now() >= deadline) return { ...last, wait: "timed-out" };

      await new Promise      (resolve => {
        const done = () => { clearTimeout(timer); signal?.removeEventListener("abort", done); resolve(); };
        const timer = setTimeout(done, Math.min(250, Math.max(0, deadline - Date.now())));
        signal?.addEventListener("abort", done, { once: true });
        if (signal?.aborted) done();
      });
    } while (true);
  };
}

async function callSetupGateway(method     , params     , timeoutMs     ) {
  const sdkName = "openclaw/plugin-sdk/gateway-runtime";
  const sdk = await import(sdkName).catch(() => {
    const hostRequire = createRequire(realpathSync(process.argv[1]));
    return import(pathToFileURL(hostRequire.resolve(sdkName)).href);
  });
  return sdk.callGatewayFromCli(method, { timeout: String(timeoutMs), json: true }, params,
    { scopes: ["operator.admin"], progress: false, clientName: "gateway-client", mode: "backend", deviceIdentity: null });
}

export async function setupFirstUseRequest(params     ) {
  return callSetupGateway(METHOD, params, 12000);
}

export const SETUP_WELCOME_SETTLE_MARGIN_MS = 15000;
export const SETUP_WELCOME_TRANSPORT_MARGIN_MS = SETUP_WELCOME_SETTLE_MARGIN_MS + 15000;

export async function setupWelcomeRequest(params     ) {
  const waitMs = params?.operation === SETUP_WELCOME_CANCEL_OPERATION ? 0
    : Number.isInteger(params?.timeoutMs) ? params.timeoutMs : FIRST_USE_WAIT_MAX_MS;
  return callSetupGateway(SETUP_WELCOME_METHOD, params, waitMs + SETUP_WELCOME_TRANSPORT_MARGIN_MS);
}

export const SETUP_WELCOME_COMING_MESSAGE =
  "Double-tap the welcome on your glasses to finish.";
export const SETUP_WELCOME_DONE_MESSAGE =
  "OcuClaw setup is complete for this OpenClaw installation.";
export const SETUP_WELCOME_PHONE_MESSAGE =
  "Your phone is not connected to this server. The welcome could not be sent.\nOpen Even on your phone, then run the same command again.";
export const SETUP_WELCOME_INCOMPLETE_MESSAGE =
  "The glasses welcome still needs a double-tap. Installation is done; setup is not complete.\nRun the same command again when you are ready.";

export const SETUP_WELCOME_CANCELLED_MESSAGE =
  "Welcome check stopped.\nRun the same command again when you are ready.";
export const SETUP_WELCOME_UNAVAILABLE_MESSAGE =
  "This host cannot show the glasses welcome right now.\nInstallation is done; the welcome double-tap is still pending.";

const WELCOME_PHONE_REASONS = ["setup-phone-session-ambiguous-or-disconnected",
  "setup-phone-session-unavailable", "setup-phone-binding-changed"];

export async function runSetupWelcome(api     , options      = {}, io      = {}) {
  const output = io.output ?? process.stdout;
  const request = io.request ?? setupWelcomeRequest;
  const installation = setupInstallation(resolveSetupStateDir(api));
  const binding = options.binding;
  const timeoutMs = Number.isInteger(options.timeoutMs) ? options.timeoutMs : FIRST_USE_WAIT_MAX_MS;
  if (!installation.id || typeof binding !== "string" || !/^[a-f0-9]{64}$/.test(binding)) {
    output.write(`${SETUP_WELCOME_UNAVAILABLE_MESSAGE}\n`);
    return { ok: false, outcome: "unavailable", reason: "setup-welcome-binding-unavailable", record: null };
  }
  output.write(`${terminalText(SETUP_WELCOME_COMING_MESSAGE, "action", output, io.env)}\n`);
  let cancelling = false;
  const cancel = () => {
    if (cancelling) return;
    cancelling = true;

    Promise.resolve(request({ installationId: installation.id, operation: SETUP_WELCOME_CANCEL_OPERATION }))
      .catch(() => {  });
  };
  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);
  options.signal?.addEventListener?.("abort", cancel, { once: true });
  if (options.signal?.aborted) cancel();
  try {
    const result      = await request({
      installationId: installation.id, binding, timeoutMs,
      operation: options.retry === true ? "first_use_welcome_retry" : "first_use_welcome",
    });
    const record = result?.record ?? null;
    if (result?.installation?.id !== installation.id || !record?.status) {
      return { ok: false, outcome: "unavailable", reason: "setup-context-mismatch", record: null };
    }
    if (record.status === "completed") {
      output.write(`${SETUP_WELCOME_DONE_MESSAGE}\n`);
      output.write(`${OPTIONAL_SETUP_HANDOFF}\n`);
      return { ok: true, outcome: "dismissed", reason: null, record };
    }
    const reason = record.welcome?.reason ?? null;
    if (cancelling || reason === "cancelled") {
      output.write(`${SETUP_WELCOME_CANCELLED_MESSAGE}\n`);
      return { ok: false, outcome: "cancelled", reason, record };
    }
    if (WELCOME_PHONE_REASONS.includes(reason)) {
      output.write(`${SETUP_WELCOME_PHONE_MESSAGE}\n`);
      return { ok: false, outcome: "phone-disconnected", reason, record };
    }
    output.write(`${SETUP_WELCOME_INCOMPLETE_MESSAGE}\n`);
    return { ok: false, outcome: "incomplete", reason, record };
  } catch (error     ) {
    const message = error?.message ? String(error.message) : String(error ?? "");
    const reason = /\b(setup-[a-z-]+|installation-mismatch|runtime-unavailable)\b/.exec(message)?.[1] ?? "setup-welcome-unavailable";
    if (cancelling) {
      output.write(`${SETUP_WELCOME_CANCELLED_MESSAGE}\n`);
      return { ok: false, outcome: "cancelled", reason, record: null };
    }
    if (WELCOME_PHONE_REASONS.includes(reason)) {
      output.write(`${SETUP_WELCOME_PHONE_MESSAGE}\n`);
      return { ok: false, outcome: "phone-disconnected", reason, record: null };
    }
    output.write(`${SETUP_WELCOME_UNAVAILABLE_MESSAGE}\n`);
    return { ok: false, outcome: "unavailable", reason, record: null };
  } finally {
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
    options.signal?.removeEventListener?.("abort", cancel);
  }
}

export const FIRST_USE_RECEIPT_MESSAGE =
  "Your phone reported SDK acceptance of the reply.";

export function createFirstUseCommand(api     ) {
  return async function firstUse(options      = {}, io      = {}) {
    const input = io.input ?? process.stdin;
    const output = io.output ?? process.stdout;
    if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== "function") {
      output.write("First-use confirmation requires your own interactive terminal. Piped input cannot confirm G2.\n");
      return { exitCode: 2 };
    }
    const testInput = options.testInput === true || !!(io.input || io.request);
    const installation = setupInstallation(resolveSetupStateDir(api));
    const call = (params     ) => (io.request ?? setupFirstUseRequest)({ ...params, installationId: installation.id, testInput });
    let armed = false;
    let answer = "";
    let cancelled = false;
    let finish     ;
    const decision = new Promise        ((resolve) => { finish = resolve; });

    const welcomeAbort = new AbortController();
    const stop = () => { cancelled = true; welcomeAbort.abort(); finish(""); };

    const showWelcome = async () => {

      clearTimeout(timer);
      let stored      = null;
      try { stored = createFirstUseStore(resolveSetupStateDir(api)).read(); } catch (_) { stored = null; }
      const run = io.welcome ?? runSetupWelcome;
      const result = await run(api, { binding: firstUseBinding(stored), retry: !!stored?.welcome,
        signal: welcomeAbort.signal }, { output, request: io.welcomeRequest });
      return { exitCode: result?.ok === true ? 0 : 1 };
    };
    const onData = (chunk     ) => {
      for (const char of String(chunk)) {
        if (["\u0003", "\u0004", "\u001b"].includes(char)) { stop(); return; }
        if (!armed) continue;
        if (char === "\r" || char === "\n") { armed = false; finish(answer); }
        else if (char === "\u007f" || char === "\b") {
          if (answer.length) { answer = answer.slice(0, -1); output.write("\b \b"); }
        }
        else if (/^[A-Z0-9 ]$/.test(char) && answer.length < 32) { answer += char; output.write(char); }
        else { armed = false; finish(""); }
      }
    };
    const wasRaw = input.isRaw;
    const wasPaused = input.isPaused();
    let timer     ;
    input.on("data", onData);
    input.on("end", stop);
    input.on("close", stop);
    input.on("error", stop);
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
    try {
      input.setRawMode(true);
      input.resume();
      const result = await call({ operation: "begin", sessionKey: options.session, retry: options.retry === true });
      const r = result?.record;
      if (result?.installation?.id !== installation.id || !r || r.installationId !== installation.id) throw new Error("context-mismatch");
      if (r.status === "completed" && r.confirmation?.source !== "test-input") { output.write(`${firstUseSuccess(r)}\n`); return { exitCode: 0 }; }
      if (r.status === "awaiting-welcome") {
        if (r.replyEvidence === "client_sdk_receipt") output.write(`${FIRST_USE_RECEIPT_MESSAGE}\n`);
        return await showWelcome();
      }
      output.write(terminalText("OpenClaw first reply\n", "heading", output, io.env));
      output.write(terminalText(`Session: ${r.sessionKey}\n`, "detail", output, io.env));
      if (r.status === "awaiting-reply") { output.write(`${FIRST_USE_RETRY}\n`); return { exitCode: 0 }; }
      if ((r.status !== "awaiting-confirmation" && r.confirmation?.source !== "test-input") || !r.reply?.runId || !r.attemptId) throw new Error("reply-required");

      if (r.status === "awaiting-confirmation") {

        const settleBy = Date.now() + FIRST_USE_RECEIPT_SETTLE_MAX_MS;
        for (;;) {
          const observed      = await call({ operation: "first_use_wait" }).catch(() => null);
          const seen = observed?.record;
          if (seen?.status === "awaiting-welcome" && seen.replyEvidence === "client_sdk_receipt") {
            output.write(`${FIRST_USE_RECEIPT_MESSAGE}\n`);
            return await showWelcome();
          }
          if (cancelled) break;
          if (seen?.status !== "awaiting-confirmation" ||
              seen.replyEvidenceReason !== "observation_pending") break;
          if (Date.now() >= settleBy) break;
          await new Promise      ((resolve) => {
            const done = () => { clearTimeout(timer); input.off("data", onCancelPoll); resolve(); };
            const onCancelPoll = () => { if (cancelled) done(); };
            const timer = setTimeout(done, 200);
            input.on("data", onCancelPoll);
          });
        }
      }
      output.write(terminalText(`The phone reply completed at ${new Date(r.reply.completedAt).toISOString()}.\n`, "detail", output, io.env));
      output.write("If it never appeared, cancel and run openclaw ocuclaw first-use --retry before sending a fresh phone message.\n\n");
      output.write(terminalText("Only if you saw that reply on G2, type SEEN ON G2 and press Enter. Enter alone or Ctrl-C leaves setup unfinished: ", "action", output, io.env));

      await new Promise((resolve) => setTimeout(resolve, 0));
      if (!cancelled) armed = true;
      timer = setTimeout(stop, io.timeoutMs ?? 120000);
      const typed = await decision;
      if (typed !== "SEEN ON G2" || cancelled) {
        output.write("\nG2 confirmation is still pending. Run openclaw ocuclaw first-use when ready; no need to pair again.\n");
        return { exitCode: 1 };
      }
      const confirmed = createFirstUseStore(resolveSetupStateDir(api)).confirm({
        installationId: installation.id, attemptId: r.attemptId, testInput,
        sessionKey: r.sessionKey, runId: r.reply.runId, source: "direct-wearer-terminal", answer: typed });
      if (testInput) {
        output.write("\nTest input exercised; no real wearer acceptance recorded.\n");
        return { exitCode: 0, testInput: true };
      }
      if (confirmed?.status === "awaiting-welcome" && confirmed.attemptId === r.attemptId) {
        output.write("\n");
        return await showWelcome();
      }
      if (confirmed?.status !== "completed" || confirmed.attemptId !== r.attemptId) throw new Error("completion-unverified");
      output.write(`\n${firstUseSuccess(confirmed)}\n`);
      return { exitCode: 0 };
    } catch (_) {
      output.write("\nFirst-use state could not be verified. Run openclaw ocuclaw journey for this installation and retry; preserve existing credentials and checkpoint files.\n");
      return { exitCode: 2 };
    } finally {
      clearTimeout(timer);
      input.removeListener("data", onData);
      input.removeListener("end", stop);
      input.removeListener("close", stop);
      input.removeListener("error", stop);
      process.removeListener("SIGINT", stop);
      process.removeListener("SIGTERM", stop);
      input.setRawMode(wasRaw);
      if (wasPaused) input.pause();
    }
  };
}
