import { createHash, randomUUID } from "node:crypto";
import { constantTimeEqual } from "../domain/constant-time-equal.js";
import { filterRawEmojiText } from "../domain/message-emoji-filter.js";
import { composeReadabilitySystemPrompt } from "../domain/readability-system-prompt.js";
import { normalizeEvenAiSystemPrompt } from "./even-ai-settings-store.js";

const DEFAULT_RESPONSE_MODEL = "ocuclaw-active-session";
const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_MAX_BODY_BYTES = 65536;
const DEFAULT_DEDUP_WINDOW_MS = 500;

const DEFAULT_MAX_INTERCEPT_INFLIGHT = 4;
export const EVEN_AI_CHAT_COMPLETIONS_PATH = "/v1/chat/completions";
const REQUEST_HANDLED_MARKER = Symbol.for("ocuclaw.evenai.handled");
function normalizeLogger(logger) {
  if (!logger || typeof logger !== "object") {
    return console;
  }
  return {
    info: typeof logger.info === "function" ? logger.info.bind(logger) : console.log,
    warn: typeof logger.warn === "function" ? logger.warn.bind(logger) : console.warn,
    error: typeof logger.error === "function" ? logger.error.bind(logger) : console.error,
    debug:
      typeof logger.debug === "function" ? logger.debug.bind(logger) : console.debug,
  };
}

function normalizePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function trimString(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeDefaultModel(value) {
  return trimString(value);
}

function normalizeDefaultThinking(value) {
  const normalized = trimString(value).toLowerCase();
  if (
    ["off", "minimal", "low", "medium", "high", "xhigh"].includes(normalized)
  ) {
    return normalized;
  }
  return "";
}

function normalizeSessionKey(value) {
  const trimmed = trimString(value);
  return trimmed || null;
}

function parseBearerToken(headerValue) {
  const raw = trimString(headerValue);
  if (!raw) return "";
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match ? trimString(match[1]) : "";
}

function buildCompletionPayload(opts = {}) {
  const createdMs =
    Number.isFinite(opts.createdMs) && opts.createdMs > 0
      ? Math.floor(opts.createdMs)
      : Date.now();
  return {
    id: trimString(opts.id) || `chatcmpl-${randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(createdMs / 1000),
    model: trimString(opts.model) || DEFAULT_RESPONSE_MODEL,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: typeof opts.content === "string" ? opts.content : "",
        },
        finish_reason: "stop",
      },
    ],
  };
}

function buildListenInterceptCloseoutPayload(opts = {}) {
  return buildCompletionPayload({
    id: opts.id,
    createdMs: opts.createdMs,
    model: opts.model,
    content: "\u200B",
  });
}

function extractLastUserText(payload) {
  if (!payload || !Array.isArray(payload.messages)) {
    return null;
  }

  for (let idx = payload.messages.length - 1; idx >= 0; idx -= 1) {
    const message = payload.messages[idx];
    if (!message || message.role !== "user") continue;
    if (typeof message.content !== "string") {
      return null;
    }
    const text = trimString(message.content);
    return text ? message.content : null;
  }
  return null;
}

function classifyHandledError(err) {
  const code = trimString(err && err.code).toLowerCase();
  const message = trimString(err && err.message).toLowerCase();

  if (code === "evenai_timeout") {
    return {
      event: "request_timeout",
      severity: "warn",
      content: "Even AI request timed out. Please try again.",
    };
  }

  if (
    code === "evenai_disconnected" ||
    message.includes("gateway not connected") ||
    message.includes("gateway disconnected") ||
    message.includes("gateway closed")
  ) {
    return {
      event: "request_disconnected",
      severity: "warn",
      content: "Even AI is unavailable because OpenClaw is disconnected.",
    };
  }

  return {
    event: "request_failed",
    severity: "warn",
    content: "Even AI request failed upstream. Please try again.",
  };
}

function setJsonHeaders(res) {
  if (res.headersSent) return;
  res.statusCode = 200;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
}

function writeJson(res, payload) {
  if (res.writableEnded) return;
  setJsonHeaders(res);
  res.end(JSON.stringify(payload));
}

function matchesEndpointRoute(req) {
  if (!req || typeof req.method !== "string") return false;
  if (req.method.toUpperCase() !== "POST") return false;
  const url = new URL(req.url || "/", "http://127.0.0.1");
  return url.pathname === EVEN_AI_CHAT_COMPLETIONS_PATH;
}

function readRequestBody(req, maxBodyBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let truncated = false;

    req.on("error", reject);
    req.on("aborted", () => {
      reject(new Error("request aborted"));
    });
    req.on("data", (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;
      if (truncated) {
        return;
      }
      if (totalBytes > maxBodyBytes) {
        truncated = true;
        return;
      }
      chunks.push(buffer);
    });
    req.on("end", () => {
      resolve({
        bodyText: Buffer.concat(chunks).toString("utf8"),
        bodyBytes: totalBytes,
        truncated,
      });
    });
  });
}

function promiseWithTimeout(promise, timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    const timeoutErr = new Error("Even AI request timed out.");
    timeoutErr.code = "evenai_timeout";
    timeoutErr.timeoutMs = timeoutMs;
    return Promise.reject(timeoutErr);
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const timeoutErr = new Error("Even AI request timed out.");
      timeoutErr.code = "evenai_timeout";
      timeoutErr.timeoutMs = timeoutMs;
      reject(timeoutErr);
    }, timeoutMs);

    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function createEvenAiEndpoint(opts = {}) {
  const logger = normalizeLogger(opts.logger);
  const httpServer = opts.httpServer || null;
  const enabled = opts.enabled === true;
  const externallyRouted = opts.externallyRouted === true;
  const token = trimString(opts.token);
  const getSystemPrompt =
    typeof opts.getSystemPrompt === "function"
      ? opts.getSystemPrompt
      : () => opts.systemPrompt;
  const getSettingsSnapshot =
    typeof opts.getSettingsSnapshot === "function"
      ? opts.getSettingsSnapshot
      : () => opts.settingsSnapshot || {};
  const router = opts.router;
  const gatewayBridge = opts.gatewayBridge;
  const runWaiter = opts.runWaiter;
  const emitDebug = typeof opts.emitDebug === "function" ? opts.emitDebug : () => {};
  const onSessionActivated =
    typeof opts.onSessionActivated === "function" ? opts.onSessionActivated : null;
  const onSessionRouted =
    typeof opts.onSessionRouted === "function" ? opts.onSessionRouted : null;
  const recordFirstSentUserMessage =
    typeof opts.recordFirstSentUserMessage === "function"
      ? opts.recordFirstSentUserMessage
      : null;
  const dispatchOcuClawUserSend =
    typeof opts.dispatchOcuClawUserSend === "function"
      ? opts.dispatchOcuClawUserSend
      : null;
  const emitListenInterceptRecovery =
    typeof opts.emitListenInterceptRecovery === "function"
      ? opts.emitListenInterceptRecovery
      : null;
  const emitListenInterceptBroadcast =
    typeof opts.emitListenInterceptBroadcast === "function"
      ? opts.emitListenInterceptBroadcast
      : null;
  const isUpstreamConnected =
    typeof opts.isUpstreamConnected === "function"
      ? opts.isUpstreamConnected
      : () => false;
  const hasConnectedAppClient =
    typeof opts.hasConnectedAppClient === "function"
      ? opts.hasConnectedAppClient
      : () => false;
  const shouldSeedThinkingForRoute =
    typeof opts.shouldSeedThinkingForRoute === "function"
      ? opts.shouldSeedThinkingForRoute
      : async () => false;
  const seedFastModeForRoute =
    typeof opts.seedFastModeForRoute === "function"
      ? opts.seedFastModeForRoute
      : null;
  const resolveAgentForRoute =
    typeof opts.resolveAgentForRoute === "function"
      ? opts.resolveAgentForRoute
      : null;
  const now =
    typeof opts.now === "function" ? opts.now : () => Date.now();
  const requestTimeoutMs = normalizePositiveInt(
    opts.requestTimeoutMs,
    DEFAULT_TIMEOUT_MS,
  );
  const maxBodyBytes = normalizePositiveInt(
    opts.maxBodyBytes,
    DEFAULT_MAX_BODY_BYTES,
  );
  const dedupWindowMs = Math.max(
    0,
    normalizePositiveInt(opts.dedupWindowMs, DEFAULT_DEDUP_WINDOW_MS),
  );
  const maxInterceptInflight = normalizePositiveInt(
    opts.maxInterceptInflight,
    DEFAULT_MAX_INTERCEPT_INFLIGHT,
  );

  if (!gatewayBridge || typeof gatewayBridge.sendMessage !== "function") {
    throw new Error("Even AI endpoint requires gatewayBridge.sendMessage()");
  }
  if (
    !router ||
    (
      typeof router.resolveTargetSession !== "function" &&
      typeof router.resolveActiveSession !== "function"
    )
  ) {
    throw new Error(
      "Even AI endpoint requires router.resolveTargetSession() or router.resolveActiveSession()",
    );
  }
  if (!runWaiter || typeof runWaiter.waitForRun !== "function") {
    throw new Error("Even AI endpoint requires runWaiter.waitForRun()");
  }

  let inFlight = null;

  let interceptInflight = 0;

  let lastAccepted = null;

  async function handleRequest(req, res) {
    if (!enabled) return false;
    if (!matchesEndpointRoute(req)) return false;
    if (res.writableEnded) return true;

    req[REQUEST_HANDLED_MARKER] = true;
    res[REQUEST_HANDLED_MARKER] = true;

    const requestId = `chatcmpl-${randomUUID()}`;
    const startedAtMs = now();
    const authToken = parseBearerToken(req.headers && req.headers.authorization);
    const configuredSystemPrompt = normalizeEvenAiSystemPrompt(getSystemPrompt());
    const systemPrompt = composeReadabilitySystemPrompt(configuredSystemPrompt);

    emitDebug(
      "evenai",
      "request_received",
      "info",
      null,
      () => ({
        requestId,
        method: req.method || null,
        bodyLimitBytes: maxBodyBytes,
        hasAuthorization: !!authToken,
        userAgentTail:
          req.headers && typeof req.headers["user-agent"] === "string"
            ? req.headers["user-agent"].slice(-120)
            : null,
      }),
    );

    if (!token || !constantTimeEqual(authToken, token)) {
      emitDebug(
        "evenai",
        "request_auth_failed",
        "warn",
        null,
        () => ({
          requestId,
          hasConfiguredToken: !!token,
          hasAuthorization: !!authToken,
        }),
      );
      writeJson(
        res,
        buildCompletionPayload({
          id: requestId,
          createdMs: startedAtMs,
          content: "Authentication failed.",
        }),
      );
      return true;
    }

    let bodyResult;
    try {
      bodyResult = await readRequestBody(req, maxBodyBytes);
    } catch (err) {
      emitDebug(
        "evenai",
        "request_body_read_failed",
        "warn",
        null,
        () => ({
          requestId,
          message: err && err.message ? err.message : String(err),
        }),
      );
      writeJson(
        res,
        buildCompletionPayload({
          id: requestId,
          createdMs: startedAtMs,
          content: "Request body could not be read.",
        }),
      );
      return true;
    }

    if (bodyResult.truncated) {
      emitDebug(
        "evenai",
        "request_body_too_large",
        "warn",
        null,
        () => ({
          requestId,
          bodyBytes: bodyResult.bodyBytes,
          maxBodyBytes,
        }),
      );
      writeJson(
        res,
        buildCompletionPayload({
          id: requestId,
          createdMs: startedAtMs,
          content: "Request body exceeds the Even AI size limit.",
        }),
      );
      return true;
    }

    let payload;
    try {
      payload = JSON.parse(bodyResult.bodyText);
    } catch (err) {
      emitDebug(
        "evenai",
        "request_invalid_json",
        "warn",
        null,
        () => ({
          requestId,
          bodyBytes: bodyResult.bodyBytes,
          message: err && err.message ? err.message : String(err),
        }),
      );
      writeJson(
        res,
        buildCompletionPayload({
          id: requestId,
          createdMs: startedAtMs,
          content: "Request body must be valid JSON.",
        }),
      );
      return true;
    }

    const settingsSnapshot = getSettingsSnapshot() || {};
    const configuredDefaultModel = normalizeDefaultModel(settingsSnapshot.defaultModel);
    const configuredDefaultThinking = normalizeDefaultThinking(
      settingsSnapshot.defaultThinking,
    );
    const listenEnabled = settingsSnapshot.listenEnabled === true;
    const responseModel =
      trimString(payload && payload.model) ||
      configuredDefaultModel ||
      DEFAULT_RESPONSE_MODEL;
    const userText = extractLastUserText(payload);
    if (!userText) {
      emitDebug(
        "evenai",
        "request_invalid_messages",
        "warn",
        null,
        () => ({
          requestId,
          bodyBytes: bodyResult.bodyBytes,
        }),
      );
      writeJson(
        res,
        buildCompletionPayload({
          id: requestId,
          createdMs: startedAtMs,
          model: responseModel,
          content: "The last user message must be plain text.",
        }),
      );
      return true;
    }

    const upstreamConnected = isUpstreamConnected();
    const interceptListenRequest =
      listenEnabled &&
      upstreamConnected &&
      typeof router.resolveActiveSession === "function" &&
      dispatchOcuClawUserSend &&
      hasConnectedAppClient();
    const fingerprint = createHash("sha1")
      .update(bodyResult.bodyText || "")
      .digest("hex");
    if (
      lastAccepted &&
      lastAccepted.fingerprint === fingerprint &&
      startedAtMs - lastAccepted.startedAtMs <= dedupWindowMs
    ) {
      emitDebug(
        "evenai",
        "request_deduplicated",
        "info",
        null,
        () => ({
          requestId,
          dedupWindowMs,
        }),
      );
      if (interceptListenRequest) {
        writeJson(
          res,
          buildListenInterceptCloseoutPayload({
            id: requestId,
            createdMs: startedAtMs,
            model: responseModel,
          }),
        );
      } else {
        writeJson(
          res,
          buildCompletionPayload({
            id: requestId,
            createdMs: startedAtMs,
            model: responseModel,
            content: "",
          }),
        );
      }
      return true;
    }

    if (!interceptListenRequest && inFlight) {
      emitDebug(
        "evenai",
        "request_busy",
        "info",
        {
          sessionKey: inFlight.sessionKey || undefined,
        },
        () => ({
          requestId,
          activeRequestId: inFlight.requestId,
        }),
      );
      writeJson(
        res,
        buildCompletionPayload({
          id: requestId,
          createdMs: startedAtMs,
          model: responseModel,
          content: "Even AI is busy with another request. Please retry shortly.",
        }),
      );
      return true;
    }

    if (!interceptListenRequest && !upstreamConnected) {
      emitDebug(
        "evenai",
        "request_disconnected",
        "warn",
        null,
        () => ({
          requestId,
        }),
      );
      writeJson(
        res,
        buildCompletionPayload({
          id: requestId,
          createdMs: startedAtMs,
          model: responseModel,
          content: "Even AI is unavailable because OpenClaw is disconnected.",
        }),
      );
      return true;
    }

    if (interceptListenRequest) {
      const sessionKey =
        normalizeSessionKey(
          router.resolveActiveSession({
            requestId,
            model: responseModel,
            userText,
          }),
        ) || "main";

      if (interceptInflight >= maxInterceptInflight) {
        emitDebug(
          "evenai",
          "listen_intercept_capacity_exceeded",
          "warn",
          { sessionKey },
          () => ({
            requestId,
            interceptInflight,
            maxInterceptInflight,
          }),
        );
        writeJson(
          res,
          buildListenInterceptCloseoutPayload({
            id: requestId,
            createdMs: startedAtMs,
            model: responseModel,
          }),
        );
        return true;
      }
      lastAccepted = {
        fingerprint,
        startedAtMs,
      };

      emitDebug(
        "evenai",
        "listen_intercepted",
        "info",
        { sessionKey },
        () => ({
          requestId,
          bodyBytes: bodyResult.bodyBytes,
          messageChars: userText.length,
          model: responseModel,
          listenEnabled,
        }),
      );

      interceptInflight += 1;
      void (async () => {
        try {
          const dispatchResult = await Promise.resolve(
            dispatchOcuClawUserSend({
              id: requestId,
              text: userText,
              sessionKey,
              source: "hybrid_voice_endpoint",
            }),
          );
          const dispatchRunId =
            dispatchResult &&
            typeof dispatchResult.runId === "string" &&
            dispatchResult.runId.trim()
              ? dispatchResult.runId.trim()
              : null;
          if (emitListenInterceptBroadcast) {
            try {
              emitListenInterceptBroadcast({ sessionKey });
            } catch (broadcastErr) {
              logger.warn(
                `[evenai] listen intercept broadcast callback failed: ${broadcastErr && broadcastErr.message ? broadcastErr.message : broadcastErr}`,
              );
            }
          }
          emitDebug(
            "evenai",
            "listen_intercept_dispatch_succeeded",
            "info",
            {
              sessionKey,
              runId: dispatchRunId || undefined,
            },
            () => ({
              requestId,
              elapsedMs: now() - startedAtMs,
              status:
                dispatchResult &&
                typeof dispatchResult.status === "string" &&
                dispatchResult.status.trim()
                  ? dispatchResult.status.trim()
                  : null,
            }),
          );

          if (dispatchRunId) {
            try {
              await runWaiter.waitForRun({
                runId: dispatchRunId,
                sessionKey,
                timeoutMs: requestTimeoutMs,
              });
            } catch (_) {}
          }
        } catch (err) {
          let cleanupEmitted = false;
          let cleanupConnectedAppClients = null;
          let cleanupError = null;
          if (emitListenInterceptRecovery) {
            try {
              const recoveryResult = await Promise.resolve(
                emitListenInterceptRecovery({
                  requestId,
                  sessionKey,
                  error: err,
                }),
              );
              cleanupEmitted = recoveryResult
                ? recoveryResult.cleanupEmitted === true
                : true;
              cleanupConnectedAppClients =
                recoveryResult &&
                Number.isFinite(recoveryResult.connectedAppClients)
                  ? Math.floor(recoveryResult.connectedAppClients)
                  : null;
            } catch (recoveryErr) {
              cleanupError = recoveryErr;
              logger.warn(
                `[evenai] listen intercept cleanup callback failed: ${recoveryErr && recoveryErr.message ? recoveryErr.message : recoveryErr}`,
              );
            }
          }
          emitDebug(
            "evenai",
            "listen_intercept_dispatch_failed",
            "warn",
            { sessionKey },
            () => ({
              requestId,
              elapsedMs: now() - startedAtMs,
              code: err && err.code ? err.code : null,
              message: err && err.message ? err.message : String(err),
              cleanupEmitted,
              cleanupConnectedAppClients,
              cleanupError:
                cleanupError && cleanupError.message ? cleanupError.message : null,
            }),
          );
        } finally {
          interceptInflight -= 1;
        }
      })();

      writeJson(
        res,
        buildListenInterceptCloseoutPayload({
          id: requestId,
          createdMs: startedAtMs,
          model: responseModel,
        }),
      );
      return true;
    }

    let route;
    try {
      route =
        typeof router.resolveTargetSession === "function"
          ? await router.resolveTargetSession({
              requestId,
              model: responseModel,
              userText,
            })
          : {
              routingMode: "active",
              sessionKey: router.resolveActiveSession(),
              previousSessionKey: null,
              sessionChanged: false,
            };
    } catch (err) {
      emitDebug(
        "evenai",
        "request_routing_failed",
        "warn",
        null,
        () => ({
          requestId,
          message: err && err.message ? err.message : String(err),
        }),
      );
      writeJson(
        res,
        buildCompletionPayload({
          id: requestId,
          createdMs: startedAtMs,
          model: responseModel,
          content: "Even AI request failed upstream. Please try again.",
        }),
      );
      return true;
    }

    const sessionKey = normalizeSessionKey(route && route.sessionKey) || "main";
    const routingMode = trimString(route && route.routingMode) || "active";
    const sessionChanged = !!(route && route.sessionChanged);
    if (recordFirstSentUserMessage) {
      try {
        recordFirstSentUserMessage(sessionKey, userText);
      } catch (err) {
        logger.warn(
          `[evenai] first user message record callback failed: ${err && err.message ? err.message : err}`,
        );
      }
    }
    if (onSessionRouted) {
      try {
        onSessionRouted({
          ...route,
          sessionKey,
          routingMode,
          sessionChanged,
        });
      } catch (err) {
        logger.warn(
          `[evenai] session routed callback failed: ${err && err.message ? err.message : err}`,
        );
      }
    }
    if (sessionChanged && onSessionActivated) {
      try {
        onSessionActivated({
          ...route,
          sessionKey,
          routingMode,
        });
      } catch (err) {
        logger.warn(
          `[evenai] session activation callback failed: ${err && err.message ? err.message : err}`,
        );
      }
    }
    inFlight = {
      requestId,
      fingerprint,
      sessionKey,
      startedAtMs,
    };
    lastAccepted = {
      fingerprint,
      startedAtMs,
    };

    let activeRunId = null;
    let clientDisconnected = false;
    const onClientDisconnect = () => {
      if (res.writableEnded) return;
      clientDisconnected = true;
      if (inFlight && inFlight.requestId === requestId) {
        inFlight = null;
        emitDebug(
          "evenai",
          "request_client_disconnect",
          "info",
          { sessionKey: sessionKey || undefined, runId: activeRunId },
          () => ({
            requestId,
            elapsedMs: now() - startedAtMs,
            preAck: activeRunId == null,
          }),
        );
      }
      if (activeRunId && typeof runWaiter.cancelRun === "function") {
        try {
          runWaiter.cancelRun(activeRunId, "client_disconnect");
        } catch (_err) {

        }
      }
    };

    res.once("close", onClientDisconnect);

    emitDebug(
      "evenai",
      "request_accepted",
      "info",
      { sessionKey },
      () => ({
        requestId,
        bodyBytes: bodyResult.bodyBytes,
        messageChars: userText.length,
        model: responseModel,
        extraSystemPromptChars: systemPrompt.length,
        routingMode,
        sessionChanged,
      }),
    );

    try {
      const sendOptions = { extraSystemPrompt: systemPrompt };
      if (
        configuredDefaultThinking &&
        await Promise.resolve(
          shouldSeedThinkingForRoute({
            route,
            sessionKey,
            routingMode,
            thinkingLevel: configuredDefaultThinking,
          }),
        )
      ) {
        sendOptions.thinking = configuredDefaultThinking;
      }
      if (seedFastModeForRoute) {
        try {
          await Promise.resolve(
            seedFastModeForRoute({ route, sessionKey, routingMode }),
          );
        } catch (err) {

          emitDebug("evenai", "fast_mode_seed_failed", "warn", { sessionKey }, () => ({
            requestId,
            message: err && err.message ? err.message : String(err),
          }));
        }
      }
      if (resolveAgentForRoute) {
        try {
          const agentId = await Promise.resolve(
            resolveAgentForRoute({ route, sessionKey, routingMode }),
          );
          if (typeof agentId === "string" && agentId.trim()) {
            sendOptions.agentId = agentId.trim();
          }
        } catch (err) {

          emitDebug("evenai", "agent_resolve_failed", "warn", { sessionKey }, () => ({
            requestId,
            message: err && err.message ? err.message : String(err),
          }));
        }
      }
      const ack = await promiseWithTimeout(
        gatewayBridge.sendMessage(
          userText,
          sessionKey,
          null,
          sendOptions,
        ),
        requestTimeoutMs,
      );
      const runId = trimString(ack && ack.runId);
      if (!runId) {
        throw new Error("Even AI upstream ack was missing a runId.");
      }
      activeRunId = runId;
      if (trimString(ack && ack.status) && trimString(ack.status) !== "accepted") {
        throw new Error(
          trimString(ack && ack.error) || `Even AI upstream returned ${ack.status}.`,
        );
      }

      emitDebug(
        "evenai",
        "request_dispatched",
        "debug",
        { sessionKey, runId },
        () => ({
          requestId,
          elapsedMs: now() - startedAtMs,
        }),
      );

      if (clientDisconnected) {
        emitDebug(
          "evenai",
          "request_wait_skipped_after_disconnect",
          "info",
          { sessionKey, runId },
          () => ({
            requestId,
            elapsedMs: now() - startedAtMs,
          }),
        );
        return true;
      }

      const remainingTimeoutMs = Math.max(1, requestTimeoutMs - (now() - startedAtMs));
      const assistantText = await runWaiter.waitForRun({
        runId,
        sessionKey,
        timeoutMs: remainingTimeoutMs,
      });

      emitDebug(
        "evenai",
        "request_completed",
        "info",
        { sessionKey, runId },
        () => ({
          requestId,
          elapsedMs: now() - startedAtMs,
          textChars: assistantText.length,
        }),
      );

      writeJson(
        res,
        buildCompletionPayload({
          id: requestId,
          createdMs: startedAtMs,
          model: responseModel,
          content: filterRawEmojiText(assistantText),
        }),
      );
      return true;
    } catch (err) {
      const handled = classifyHandledError(err);
      emitDebug(
        "evenai",
        handled.event,
        handled.severity,
        { sessionKey },
        () => ({
          requestId,
          elapsedMs: now() - startedAtMs,
          code: err && err.code ? err.code : null,
          message: err && err.message ? err.message : String(err),
        }),
      );
      writeJson(
        res,
        buildCompletionPayload({
          id: requestId,
          createdMs: startedAtMs,
          model: responseModel,
          content: handled.content,
        }),
      );
      return true;
    } finally {
      if (inFlight && inFlight.requestId === requestId) {
        inFlight = null;
      }
      if (typeof res.removeListener === "function") {
        res.removeListener("close", onClientDisconnect);
      }
    }
  }

  const onRequest = (req, res) => {
    handleRequest(req, res).catch((err) => {
      logger.error(`[evenai] endpoint request failed: ${err.message}`);
      if (!res.writableEnded) {
        writeJson(
          res,
          buildCompletionPayload({
            content: "Even AI request failed upstream. Please try again.",
          }),
        );
      }
    });
  };

  let attached = false;
  if (enabled) {
    if (httpServer && typeof httpServer.prependListener === "function") {
      httpServer.prependListener("request", onRequest);
      attached = true;
    } else if (httpServer && typeof httpServer.on === "function") {
      httpServer.on("request", onRequest);
      attached = true;
    } else if (!externallyRouted) {
      logger.warn("[evenai] evenAiEnabled is set but no shared httpServer was provided");
    }
  }

  return {
    close() {
      if (
        attached &&
        httpServer &&
        typeof httpServer.removeListener === "function"
      ) {
        httpServer.removeListener("request", onRequest);
      }
      attached = false;
    },

    handleRequest,
  };
}

export default createEvenAiEndpoint;
