import { FIRST_USE_ERRORED_RUN_REASONS, firstUseProviderErrorClass } from "./setup-journey.js";

export const FIRST_USE_SEND_TEXT = "hello";

export const FIRST_USE_SEND_PROMPT = `In the paired conversation on your phone, send ${FIRST_USE_SEND_TEXT}.`;
export const FIRST_USE_WAIT_PROMPT = "Waiting for the reply on your glasses...";

export const FIRST_USE_WAITING_MESSAGE = "Waiting for the phone reply.";

export const FIRST_USE_REARMED_MESSAGE =
  "First-message check restarted for the phone you just paired.";

export const FIRST_USE_REPLY_MESSAGE = "Phone reply received.";

export const FIRST_USE_ALREADY_COMPLETE_MESSAGE =
  "First-message setup is already complete.";

export const FIRST_USE_OPEN_APP_NOTICE = "Open OcuClaw on your phone.";

export const FIRST_USE_REARM_REASONS = Object.freeze(["setup-session-mismatch", "setup-phone-binding-changed"]);

export const FIRST_USE_PHONE_WAIT_REASONS = Object.freeze([
  "setup-phone-session-ambiguous-or-disconnected",
  "setup-phone-session-unavailable",
]);

export const FIRST_USE_DEFAULT_RESUME_COMMAND = "openclaw ocuclaw first-use --retry";

export const FIRST_USE_PROVIDER_ERROR_LEAD =
  "Your message reached your agent and its reply reached your glasses, but the model returned an error instead of an answer. OcuClaw is installed; setup is not complete.";

export const FIRST_USE_MODEL_LOGIN_COMMAND = "openclaw models auth add";
export const FIRST_USE_MODEL_CHECK_COMMAND = "openclaw models status --probe";

export function firstUseProviderErrorClassLine(errorClass     , retry     , login     , check     ) {
  switch (errorClass) {
    case "auth":
      return `The model provider rejected the sign-in. Sign in to the model again (\`${login}\`), then run ${retry} and send a fresh message.`;
    case "quota":
      return `The model account is out of quota or has a billing problem. Check the plan or billing for this model, then run ${retry} and send a fresh message.`;
    case "rate_limit":
      return `The model is rate limiting this account. Wait for the limit to reset or choose another model, then run ${retry} and send a fresh message.`;
    default:
      return `The model provider failed or is busy. Try again in a minute, or check the model itself (\`${check}\`), then run ${retry}.`;
  }
}

export function firstUseProviderErrorVerdict(errored     , resumeCommand      = FIRST_USE_DEFAULT_RESUME_COMMAND) {
  const command = typeof resumeCommand === "string" && resumeCommand ? resumeCommand : FIRST_USE_DEFAULT_RESUME_COMMAND;
  const line = firstUseProviderErrorClassLine(firstUseProviderErrorClass(errored), command,
    FIRST_USE_MODEL_LOGIN_COMMAND, FIRST_USE_MODEL_CHECK_COMMAND);
  return `${FIRST_USE_PROVIDER_ERROR_LEAD} ${line}`;
}

export function firstUseTimeoutMessage(waitMs     ) {
  const seconds = Math.max(0, Math.round(Number(waitMs) / 1000) || 0);
  return `No reply was recorded for a phone message in this conversation within ${seconds} s.`;
}

export const GATEWAY_FREEZE_MAX_MS = 120000;
export const GATEWAY_FREEZE_RETRY_MS = 2000;
export const GATEWAY_SLOW_MESSAGE = "The gateway is slow to answer. Still waiting for it...";
export const GATEWAY_UNRESPONSIVE_REASON = "gateway-unresponsive";

export const FIRST_USE_RESUME_COMMAND = "openclaw ocuclaw first-use";

export function gatewayUnresponsiveMessage(waitedMs      = GATEWAY_FREEZE_MAX_MS) {
  const seconds = Math.max(1, Math.round(Number(waitedMs) / 1000) || 0);
  return `The gateway did not answer for ${seconds} s. Your setup progress is saved on this server.\n` +
    `When the gateway answers again, run: ${FIRST_USE_RESUME_COMMAND}`;
}

export class GatewayUnresponsiveError extends Error {
  waitedMs        ;
  constructor(waitedMs     ) {
    super(GATEWAY_UNRESPONSIVE_REASON);
    this.name = "GatewayUnresponsiveError";
    this.waitedMs = Number(waitedMs) || 0;
  }
}

export function isGatewayUnresponsive(error     ) {
  return !!error && (error instanceof GatewayUnresponsiveError || error.name === "GatewayUnresponsiveError");
}

const GATEWAY_ANSWER_PATTERN = /\b(setup-[a-z-]+|installation-mismatch|runtime-unavailable|terminal-confirmation-required)\b|unauthori[sz]ed|forbidden|missing scope|pairing required|unknown method|method not found/i;

export function isGatewayTransportFailure(error     ) {
  if (!error || isGatewayUnresponsive(error)) return false;
  const message = error.message ? String(error.message) : String(error);
  return !GATEWAY_ANSWER_PATTERN.test(message);
}

export function createGatewayFreezeRider(io      = {}) {
  const now = typeof io.now === "function" ? io.now : () => Date.now();
  const sleep = typeof io.sleep === "function" ? io.sleep
    : (ms        ) => new Promise      ((resolve) => { setTimeout(resolve, ms); });
  const say = typeof io.say === "function" ? io.say : () => {};
  const maxMs = Number.isFinite(io.maxMs) ? io.maxMs : GATEWAY_FREEZE_MAX_MS;
  const retryMs = Number.isFinite(io.retryMs) ? io.retryMs : GATEWAY_FREEZE_RETRY_MS;
  const cancelled = typeof io.cancelled === "function" ? io.cancelled : () => false;
  const rider      = {
    said: false,
    noteSlow() {
      if (rider.said) return;
      rider.said = true;
      say(GATEWAY_SLOW_MESSAGE);
    },
    async call(fn     , options      = {}) {
      const retryable = typeof options.retryable === "function" ? options.retryable : isGatewayTransportFailure;
      let since      = null;
      for (;;) {
        try {
          return await fn();
        } catch (error) {
          if (!retryable(error) || cancelled()) throw error;
          if (since === null) since = now();
          rider.noteSlow();
          if (now() - since >= maxMs) throw new GatewayUnresponsiveError(now() - since);
          await sleep(retryMs);
          if (cancelled()) throw error;
        }
      }
    },
  };
  return rider;
}

function outcomeOf(outcome        , record      = null, reason      = null) {
  return { outcome, record, reason };
}

export async function awaitFirstUseReply(io     ) {
  const call = io.call;
  const say = typeof io.say === "function" ? io.say : () => {};
  const now = typeof io.now === "function" ? io.now : () => Date.now();
  const sleep = io.sleep;
  const signal = io.signal || null;
  const waitMs = Number.isFinite(io.waitMs) ? io.waitMs : 600000;
  const pollMs = Number.isFinite(io.pollMs) ? io.pollMs : 3000;
  const noticeMs = Number.isFinite(io.noticeMs) ? io.noticeMs : 30000;

  const phoneSettleMs = Number.isFinite(io.phoneSettleMs) && io.phoneSettleMs > 0 ? io.phoneSettleMs : 0;

  const waiting = typeof io.waiting === "function" ? io.waiting : null;
  const startedAt = now();

  const cancelled = () => !!(signal && signal.aborted);
  const deadline = now() + waitMs;
  let lastNotice = now();

  let rearmed = false;
  let lastGoodStatus = typeof io.initialStatus === "string" ? io.initialStatus : null;
  let openAppSaid = false;

  for (;;) {
    if (cancelled()) return outcomeOf("cancelled");
    const polled = await call({ operation: "first_use_wait" });
    if (cancelled()) return outcomeOf("cancelled");

    if (!polled || polled.ok !== true) {
      const reason = (polled && polled.reason) || "unavailable";

      if (FIRST_USE_REARM_REASONS.includes(reason) && !rearmed && lastGoodStatus === "awaiting-reply") {
        rearmed = true;
        const again = await call({ operation: "first_use_retry" });
        if (cancelled()) return outcomeOf("cancelled");
        if (again && again.ok === true && again.record) {
          lastGoodStatus = again.record.status || null;
          say(FIRST_USE_REARMED_MESSAGE);
          continue;
        }
        return outcomeOf("unavailable", null, (again && again.reason) || "unavailable");
      }
      if (FIRST_USE_PHONE_WAIT_REASONS.includes(reason)) {
        if (!openAppSaid && now() - startedAt >= phoneSettleMs) {
          openAppSaid = true;
          say(FIRST_USE_OPEN_APP_NOTICE, "action");
        }
      } else {
        return outcomeOf("unavailable", null, reason);
      }
    } else {
      const record = polled.record || null;
      const status = record ? record.status : null;
      if (status) lastGoodStatus = status;

      if (status === "awaiting-reply" && record && record.replyRunErrored) {
        const code = record.replyRunErrored.code;
        return outcomeOf("errored", record, code === "provider_rate_limited" ? "reply_run_rate_limited" : "reply_run_errored");
      }
      if (status && status !== "awaiting-reply") {

        const fresh = await call({ operation: "begin" });
        if (cancelled()) return outcomeOf("cancelled");
        const settled = fresh && fresh.ok === true && fresh.record ? fresh.record : record;
        const replyReason = settled.replyEvidenceReason || null;
        if (FIRST_USE_ERRORED_RUN_REASONS.includes(replyReason)) {
          return outcomeOf("errored", settled, replyReason);
        }
        return outcomeOf("replied", settled, null);
      }
    }

    if (now() >= deadline) return outcomeOf("timeout");
    if (now() - lastNotice >= noticeMs) {
      lastNotice = now();
      if (waiting) {

        const periods = Math.max(1, Math.floor((now() - startedAt) / noticeMs));
        waiting(periods * noticeMs);
      } else {
        say(FIRST_USE_WAITING_MESSAGE);
      }
    }
    await sleep(pollMs, signal);
  }
}
