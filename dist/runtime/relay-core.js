import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import * as os from "node:os";
import { EventEmitter } from "node:events";
import { createPluginVersionService } from "./plugin-version-service.js";
import * as conversationStateModule from "../domain/conversation-state.js";
import { createDebugStore } from "../domain/debug-store.js";
import { startUploadCaptureArming, UPLOAD_CAPTURE_PRESET } from "../domain/debug-upload-preset.js";
import { summarizeGlassesUiContent } from "../domain/glasses-ui-content-summary.js";
import { composeReadabilitySystemPrompt } from "../domain/readability-system-prompt.js";
import { composeNeuralEmojiReactorSystemPrompt } from "../domain/neural-emoji-reactor-system-prompt.js";
import { composeNeuralPaceModulatorSystemPrompt } from "../domain/neural-pace-modulator-system-prompt.js";
import { composeGlassesUiNudgeSystemPrompt } from "../domain/glasses-ui-system-prompt.js";
import { composeGlassesDisplaySystemPrompt } from "../domain/glasses-display-system-prompt.js";
import { createStablePromptSnapshotStore } from "./stable-prompt-snapshot.js";
import { createActivityStatusAdapter } from "../domain/activity-status-adapter.js";
import { createEvenAiEndpoint } from "../even-ai/even-ai-endpoint.js";
import { createEvenAiRouter } from "../even-ai/even-ai-router.js";
import { createEvenAiRunWaiter } from "../even-ai/even-ai-run-waiter.js";
import {
  createEvenAiSettingsStore,
  normalizeEvenAiDefaultAgent,
} from "../even-ai/even-ai-settings-store.js";
import { createPluginOpenclawClient } from "../gateway/openclaw-client.js";
import { createPluginRpcGatewayBridge } from "../gateway/gateway-bridge.js";
import { createAgentTurnTracker } from "../tools/glasses-ui-wake.js";
import { createDownstreamHandler } from "./downstream-handler.js";
import { handleDebugBundleRequest, handleDebugBundleSave, handleDebugBundleFetch } from "./debug-bundle-handler.js";
import { createBundleCache } from "../domain/debug-bundle-cache.js";
import { saveBundleToDisk } from "../domain/debug-bundle-save.js";
import {
  createOcuClawSettingsStore,
  normalizeOcuClawDefaultAgent,
} from "./ocuclaw-settings-store.js";
import { createRelayHealthMonitor } from "./relay-health-monitor.js";
import { createGlassesBackpressureLatch } from "./glasses-backpressure-latch.js";
import { createRelayOperationRegistry } from "./relay-operation-registry.js";
import { createRelayWorkerSupervisor } from "./relay-worker-supervisor.js";
import {
  createSessionService,
  NEW_SESSION_GREETING_PROMPT,
} from "./session-service.js";
import { createUpstreamRuntime } from "./upstream-runtime.js";

const GLASSES_UI_MARKERS = new Set(["listening", "parked", "inflight"]);
export function sanitizeGlassesMarker(v) { return GLASSES_UI_MARKERS.has(v) ? v : undefined; }

const SONIOX_TEMP_KEY_URL = "https://api.soniox.com/v1/auth/temporary-api-key";
const SONIOX_MODELS_URL = "https://api.soniox.com/v1/models";
const DEFAULT_SONIOX_TEMP_KEY_EXPIRES_IN_SECONDS = 3600;

const DEFAULT_SONIOX_TEMP_KEY_MINT_TIMEOUT_MS = 8000;
const CARTESIA_ACCESS_TOKEN_URL = "https://api.cartesia.ai/access-token";
const CARTESIA_VERSION = "2026-03-01";
const DEFAULT_CARTESIA_ACCESS_TOKEN_EXPIRES_IN_SECONDS = 3600;
const DEFAULT_CARTESIA_ACCESS_TOKEN_MINT_TIMEOUT_MS = 8000;
const EVEN_AI_NAMESPACE_PREFIX = "ocuclaw:even-ai";
const EVEN_AI_NAMESPACE_PREFIX_WITH_DELIMITER = "ocuclaw:even-ai:";
const LISTEN_INTERCEPT_RECOVERY_ERROR = "Voice interrupted; retry";
const LISTEN_INTERCEPT_RECOVERY_CODE = "transport_interrupted";

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

function pickTrimmedString(...values) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function tailForLog(value, maxChars = 160) {
  const text =
    typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
  if (text.length <= maxChars) return text;
  return text.slice(-maxChars);
}

function normalizeEvenAiSessionKeyForLookup(rawKey) {
  if (typeof rawKey !== "string") return "";
  const rawText = rawKey.trim();
  if (!rawText) return "";
  const rawTextLower = rawText.toLowerCase();
  const prefixIndex = rawTextLower.indexOf("ocuclaw:");
  const shortKey = prefixIndex >= 0 ? rawText.slice(prefixIndex) : rawText;
  const shortKeyLower = shortKey.toLowerCase();
  if (
    shortKeyLower === EVEN_AI_NAMESPACE_PREFIX ||
    shortKeyLower.startsWith(EVEN_AI_NAMESPACE_PREFIX_WITH_DELIMITER)
  ) {
    return shortKey;
  }
  return "";
}

function dedupeNormalizedSessionKeys(sessionKeys) {
  if (!Array.isArray(sessionKeys) || sessionKeys.length === 0) {
    return [];
  }
  const dedupe = new Set();
  const normalized = [];
  for (const rawKey of sessionKeys) {
    const normalizedKey = normalizeEvenAiSessionKeyForLookup(rawKey);
    if (!normalizedKey) continue;
    const compareKey = normalizedKey.toLowerCase();
    if (dedupe.has(compareKey)) continue;
    dedupe.add(compareKey);
    normalized.push(normalizedKey);
  }
  return normalized;
}

function parseExpiryMs(raw, nowMs) {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw <= 0) return null;
    return raw > 10_000_000_000 ? Math.floor(raw) : nowMs + Math.floor(raw * 1000);
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return parseExpiryMs(numeric, nowMs);
    }
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? Math.floor(parsed) : null;
  }
  return null;
}

function normalizeSonioxTemporaryKeyResult(result, voiceSessionId, nowMs = Date.now()) {
  const temporaryKey = pickTrimmedString(
    result && result.temporaryKey,
    result && result.temporary_key,
    result && result.key,
    result && result.apiKey,
    result && result.api_key,
  );
  if (!temporaryKey) {
    throw new Error("Soniox temporary-key response missing temporaryKey");
  }

  const expiresAtMs =
    parseExpiryMs(
      result && (
        result.expiresAtMs ??
        result.expires_at_ms ??
        result.expiresAt ??
        result.expires_at
      ),
      nowMs,
    ) ??
    (
      Number.isFinite(result && result.expiresInSeconds)
        ? nowMs + Math.floor(result.expiresInSeconds * 1000)
        : null
    ) ??
    (
      Number.isFinite(result && result.expires_in_seconds)
        ? nowMs + Math.floor(result.expires_in_seconds * 1000)
        : null
    );

  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
    throw new Error("Soniox temporary-key response missing expiresAtMs");
  }

  return {
    voiceSessionId,
    temporaryKey,
    expiresAtMs: Math.floor(expiresAtMs),
  };
}

function normalizeSonioxTemporaryKeyErrorCode(err) {
  const message =
    err && typeof err.message === "string" && err.message.trim()
      ? err.message.trim()
      : "";
  const lowered = message.toLowerCase();
  if (!message) return "soniox_temp_key_request_failed";

  if (err && err.name === "AbortError") {
    return "soniox_temp_key_mint_timeout";
  }
  if (lowered.includes("api key is not configured")) {
    return "soniox_temp_key_not_configured";
  }
  if (lowered.includes("fetch is not available")) {
    return "soniox_temp_key_fetch_unavailable";
  }
  if (lowered.includes("temporary-key response missing")) {
    return "soniox_temp_key_invalid_response";
  }
  if (lowered.includes("voicesessionid is required")) {
    return "soniox_temp_key_invalid_request";
  }
  const statusMatch = lowered.match(/\((\d{3})\)/);
  if (statusMatch) {
    return `soniox_temp_key_http_${statusMatch[1]}`;
  }
  return "soniox_temp_key_request_failed";
}

function normalizeSonioxModelEntryRows(result) {
  const rows =
    result &&
    typeof result === "object" &&
    Array.isArray(result.models)
      ? result.models
      : [];
  const models = [];
  const seenIds = new Set();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const transcriptionMode =
      typeof row.transcription_mode === "string"
        ? row.transcription_mode.trim()
        : "";
    if (transcriptionMode !== "real_time") continue;
    if (row.aliased_model_id !== undefined && row.aliased_model_id !== null) {
      const aliasedModelId = pickTrimmedString(row.aliased_model_id);
      if (aliasedModelId) continue;
    }
    const id = pickTrimmedString(row.id);
    if (!id || seenIds.has(id)) continue;
    seenIds.add(id);
    models.push({
      id,
      name: pickTrimmedString(row.name) || id,
      supportsMaxEndpointDelay: row.supports_max_endpoint_delay === true,
    });
  }
  return models;
}

function createBufferedHttpRequest(envelope) {
  const req = new EventEmitter();
  req.method = envelope && envelope.method ? envelope.method : "GET";
  req.url = envelope && envelope.url ? envelope.url : "/";
  req.headers = envelope && envelope.headers && typeof envelope.headers === "object"
    ? envelope.headers
    : {};
  req.socket = {
    remoteAddress: "127.0.0.1",
  };
  const body = Buffer.from((envelope && envelope.bodyBase64) || "", "base64");
  process.nextTick(() => {
    if (body.length > 0) {
      req.emit("data", body);
    }
    req.emit("end");
  });
  return req;
}

function createBufferedHttpResponse(maxResponseBytes) {
  const headers = {};
  const chunks = [];
  let totalBytes = 0;
  const limit = Number.isFinite(maxResponseBytes) && maxResponseBytes > 0
    ? Math.floor(maxResponseBytes)
    : 262_144;

  const res = new EventEmitter();
  res.statusCode = 200;
  res.writableEnded = false;
  res.setHeader = function (name, value) {
    if (typeof name === "string" && name) {
      headers[name.toLowerCase()] = value;
    }
  };
  res.getHeader = function (name) {
    return typeof name === "string" ? headers[name.toLowerCase()] : undefined;
  };
  res.write = function (chunk) {
    if (this.writableEnded) return false;
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk ?? ""));
    totalBytes += buffer.length;
    if (totalBytes > limit) {
      throw new Error("Buffered HTTP response exceeded relay worker limit");
    }
    chunks.push(buffer);
    return true;
  };
  res.end = function (chunk) {
    if (chunk !== undefined && chunk !== null) {
      this.write(chunk);
    }
    this.writableEnded = true;
  };
  res.toResult = function () {
    return {
      statusCode: this.statusCode,
      headers: { ...headers },
      body: Buffer.concat(chunks),
    };
  };
  return res;
}

function createRelay(opts) {
  const logger = normalizeLogger(opts.logger);
  const externalDebugToolsEnabled = opts.externalDebugToolsEnabled !== false;

  const allowDebugUpload = opts.allowDebugUpload === true;

  const debugUploadMaxZipBytes =
    Number.isFinite(opts.debugUploadMaxZipBytes) && opts.debugUploadMaxZipBytes > 0
      ? Math.floor(opts.debugUploadMaxZipBytes)
      : 4_000_000;

  const debugBundleIdSalt = crypto.randomBytes(16).toString("hex");
  const openclawClient =
    opts.openclawClient ||
    (opts.gatewayBridge
      ? null
      : createPluginOpenclawClient({
          gatewayUrl: opts.gatewayUrl,
          gatewayToken: opts.gatewayToken,
          logger,
          stateDir: opts.stateDir,
        }));
  if (openclawClient && typeof openclawClient.setLogger === "function") {
    openclawClient.setLogger(logger);
  }
  const gatewayBridge =
    opts.gatewayBridge ||
    createPluginRpcGatewayBridge({
      openclawClient,
    });
  const conversationState =
    opts.conversationState || conversationStateModule;
  const activityStatusAdapter = createActivityStatusAdapter(
    opts.activityStatusAdapter,
  );

  const agentTurnTracker = createAgentTurnTracker();
  const sharedHttpServer = opts.httpServer || null;

  let cachedPages = null;

  let pagesRevision = 0;

  let cachedStatus = null;

  let statusRevision = 0;

  let currentSessionModelConfigSnapshot = null;

  let simulateStreamRunSeq = 0;

  const simulateStreamTimers = new Map();

  const debugCategories = Array.isArray(opts.debugCategories)
    ? opts.debugCategories
    : opts.debugCategories && typeof opts.debugCategories === "object"
      ? Object.entries(opts.debugCategories)
          .filter(([, enabled]) => enabled)
          .map(([category]) => category)
      : opts.debugCategories;

  const debugNow =
    typeof opts.debugNow === "function" ? opts.debugNow : () => Date.now();

  const debugArmStatePath =
    typeof opts.stateDir === "string" && opts.stateDir
      ? path.join(opts.stateDir, "debug-arm.json")
      : null;
  let initialDebugArm = [];
  if (debugArmStatePath) {
    try {
      const parsed = JSON.parse(fs.readFileSync(debugArmStatePath, "utf8"));
      if (parsed && Array.isArray(parsed.enabled)) {
        initialDebugArm = parsed.enabled;
      }
    } catch {
      initialDebugArm = [];
    }
  }
  const debugStore = createDebugStore({
    categories: debugCategories,
    capacity: opts.debugCapacity,
    defaultTtlMs: opts.debugDefaultTtlMs,
    maxTtlMs: opts.debugMaxTtlMs,
    dumpDefaultLimit: opts.debugDumpDefaultLimit,
    dumpMaxLimit: opts.debugDumpMaxLimit,
    now: debugNow,
    noisyPolicies: opts.debugNoisyPolicies,
    initialEnabled: initialDebugArm,
  });

  const bundleCache = createBundleCache({ maxEntries: 4, ttlMs: 5 * 60_000, now: () => Date.now() });
  let bundleCacheSweepTimer = null;

  function resolveSaveDir() {
    const c = opts.debugBundleSaveDir;
    return (typeof c === "string" && c.trim()) ? c : path.join(os.homedir(), ".openclaw", "ocuclaw-debug-bundles");
  }

  const liveUiTraceFlagPath =
    typeof opts.stateDir === "string" && opts.stateDir
      ? path.join(opts.stateDir, "liveui-trace.json")
      : null;
  let liveUiTraceLogEnabled = false;
  if (liveUiTraceFlagPath) {
    try {
      liveUiTraceLogEnabled =
        JSON.parse(fs.readFileSync(liveUiTraceFlagPath, "utf8")).enabled === true;
    } catch {
      liveUiTraceLogEnabled = false;
    }
  }

  const consoleLogPath =
    typeof opts.consoleLogPath === "string" && opts.consoleLogPath.trim()
      ? opts.consoleLogPath
      : null;

  if (consoleLogPath) {
    try {
      fs.writeFileSync(consoleLogPath, "");
    } catch {}
  }
  const CONSOLE_LOG_MAX_LINES = 500;
  const CONSOLE_LOG_TRIM_TO = 250;

  function writeConsoleLog(level, message) {
    if (!consoleLogPath) {
      logger.debug(`[browser:${level}] ${message}`);
      return;
    }
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    const line = `[${timestamp}] [${level}] ${message}\n`;
    try {
      fs.appendFileSync(consoleLogPath, line);

      const content = fs.readFileSync(consoleLogPath, "utf8");
      const lines = content.split("\n");
      if (lines.length > CONSOLE_LOG_MAX_LINES) {
        const trimmed = lines.slice(-CONSOLE_LOG_TRIM_TO).join("\n");
        fs.writeFileSync(consoleLogPath, trimmed);
      }
    } catch (err) {
      logger.error(`[relay] Console log write failed: ${err.message}`);
    }
  }

  function emitDebug(cat, event, severity, context, buildData, options) {
    const force = !!(options && options.force === true);
    if (!force && !debugStore.isEnabled(cat) && !(liveUiTraceLogEnabled && (cat === "glasses.lifecycle" || cat === "openclaw.message"))) {
      return;
    }

    let data = {};
    if (typeof buildData === "function") {
      try {
        data = buildData() || {};
      } catch (err) {
        data = { buildError: err.message || String(err) };
      }
    }

    const ts = debugNow();
    const payload = { ts, cat, event, severity, data };

    if (context && context.sessionKey) payload.sessionKey = context.sessionKey;
    if (context && context.runId) payload.runId = context.runId;
    if (context && context.screen) payload.screen = context.screen;

    debugStore.emit(payload, { force });

    if (liveUiTraceLogEnabled && (cat === "glasses.lifecycle" || cat === "openclaw.message")) {
      try {
        const surfaceId =
          data && typeof data.surfaceId === "string" ? data.surfaceId : null;
        const sessionKey =
          payload.sessionKey ||
          (data && typeof data.sessionKey === "string" ? data.sessionKey : null) ||
          null;
        const side =
          cat === "openclaw.message"
            ? (event === "user_message" ? "user" : "agent")
            : "openclaw";
        logger.info(
          "[liveui] " +
            JSON.stringify({
              trace: "liveui",
              side,
              ts,
              cat,
              event,
              severity,
              surfaceId,
              sessionKey,
              data,
            }),
        );
      } catch {

      }
    }
  }

  function isForcedReadinessProofEvent(payload) {
    return !!(
      payload &&
      payload.cat === "app.lifecycle" &&
      payload.event === "readiness_probe_received"
    );
  }

  function scheduleSimulateStreamTimer(delayMs, callback, sessionKey) {
    const timer = setTimeout(() => {
      simulateStreamTimers.delete(timer);
      try {
        callback();
      } catch (err) {
        logger.error(`[relay] simulate-stream timer failed: ${err.message}`);
      }
    }, delayMs);
    simulateStreamTimers.set(timer, typeof sessionKey === "string" ? sessionKey : null);
    return timer;
  }

  function clearSimulateStreamTimersForSession(sessionKey) {
    let cleared = 0;
    for (const [timer, timerSessionKey] of simulateStreamTimers) {
      if (timerSessionKey === sessionKey) {
        clearTimeout(timer);
        simulateStreamTimers.delete(timer);
        cleared += 1;
      }
    }
    if (cleared > 0) {
      logger.info(
        `[relay] cancelled ${cleared} pending simulate-stream timer(s) for session ${sessionKey}`,
      );
    }
    return cleared;
  }

  function clearSimulateStreamTimers() {
    for (const timer of simulateStreamTimers.keys()) {
      clearTimeout(timer);
    }
    simulateStreamTimers.clear();
  }

  function resetActivityStatusAdapter() {
    activityStatusAdapter.reset();
  }

  const configuredSonioxApiKey =
    opts.sonioxApiKey !== undefined
      ? opts.sonioxApiKey
      : (opts.config && opts.config.sonioxApiKey) || "";
  const sonioxTemporaryKeyExpiresInSeconds = Number.isFinite(
    opts.sonioxTemporaryKeyExpiresInSeconds,
  )
    ? Math.max(30, Math.floor(opts.sonioxTemporaryKeyExpiresInSeconds))
    : DEFAULT_SONIOX_TEMP_KEY_EXPIRES_IN_SECONDS;
  const sonioxTemporaryKeyMintTimeoutMs = Number.isFinite(
    opts.sonioxTemporaryKeyMintTimeoutMs,
  )
    ? Math.max(1, Math.floor(opts.sonioxTemporaryKeyMintTimeoutMs))
    : DEFAULT_SONIOX_TEMP_KEY_MINT_TIMEOUT_MS;
  const configuredCartesiaApiKey =
    opts.cartesiaApiKey !== undefined
      ? opts.cartesiaApiKey
      : (opts.config && opts.config.cartesiaApiKey) || "";
  const cartesiaAccessTokenExpiresInSeconds = Number.isFinite(
    opts.cartesiaAccessTokenExpiresInSeconds,
  )
    ? Math.max(30, Math.min(3600, Math.floor(opts.cartesiaAccessTokenExpiresInSeconds)))
    : DEFAULT_CARTESIA_ACCESS_TOKEN_EXPIRES_IN_SECONDS;
  const cartesiaAccessTokenMintTimeoutMs = Number.isFinite(
    opts.cartesiaAccessTokenMintTimeoutMs,
  )
    ? Math.max(1, Math.floor(opts.cartesiaAccessTokenMintTimeoutMs))
    : DEFAULT_CARTESIA_ACCESS_TOKEN_MINT_TIMEOUT_MS;

  let cachedSonioxModels = null;
  let cachedSonioxModelsFetchedAt = 0;
  let cachedSonioxModelsStale = true;
  let sonioxModelsFetchStarted = false;

  let inFlightSonioxModelsFetch = null;

  function resolveFetchImpl() {
    return typeof opts.fetch === "function"
      ? opts.fetch
      : typeof globalThis.fetch === "function"
        ? globalThis.fetch.bind(globalThis)
        : null;
  }

  function sonioxModelsSnapshot(nowMs) {
    const now = Number.isFinite(nowMs) ? nowMs : Date.now();
    const hasCache = Array.isArray(cachedSonioxModels);
    return {
      models: hasCache ? cachedSonioxModels : [],
      fetchedAtMs: hasCache ? cachedSonioxModelsFetchedAt : now,
      stale: !hasCache || cachedSonioxModelsStale,
    };
  }

  function cacheSonioxModels(models, fetchedAtMs, stale) {
    cachedSonioxModels = Array.isArray(models) ? models : [];
    cachedSonioxModelsFetchedAt = Number.isFinite(fetchedAtMs)
      ? Math.floor(fetchedAtMs)
      : Date.now();
    cachedSonioxModelsStale = !!stale;
    return sonioxModelsSnapshot(cachedSonioxModelsFetchedAt);
  }

  function getSonioxModelsSnapshot() {
    if (inFlightSonioxModelsFetch) {
      return inFlightSonioxModelsFetch;
    }
    return Promise.resolve(sonioxModelsSnapshot());
  }

  function prefetchSonioxModels(trigger = "relay_start") {
    if (inFlightSonioxModelsFetch) {
      return inFlightSonioxModelsFetch;
    }
    if (sonioxModelsFetchStarted) {
      return Promise.resolve(sonioxModelsSnapshot());
    }
    sonioxModelsFetchStarted = true;

    const fetchImpl = resolveFetchImpl();
    if (!configuredSonioxApiKey) {
      const snapshot = cacheSonioxModels([], Date.now(), true);
      emitDebug(
        "voice.timeline",
        "soniox_models_prefetch_skipped",
        "warn",
        { sessionKey: sessionService.peekSessionKey() || undefined },
        () => ({
          trigger,
          reason: "api_key_not_configured",
        }),
      );
      return Promise.resolve(snapshot);
    }
    if (!fetchImpl) {
      const snapshot = cacheSonioxModels([], Date.now(), true);
      emitDebug(
        "voice.timeline",
        "soniox_models_prefetch_skipped",
        "warn",
        { sessionKey: sessionService.peekSessionKey() || undefined },
        () => ({
          trigger,
          reason: "fetch_unavailable",
        }),
      );
      return Promise.resolve(snapshot);
    }

    inFlightSonioxModelsFetch = Promise.resolve()
      .then(async () => {
        const response = await fetchImpl(SONIOX_MODELS_URL, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${configuredSonioxApiKey}`,
          },
        });
        const rawText =
          response && typeof response.text === "function"
            ? await response.text()
            : "";
        let payload = {};
        if (rawText) {
          try {
            payload = JSON.parse(rawText);
          } catch {
            if (!response.ok) {
              throw new Error(
                `Soniox models request failed (${response.status}): ${tailForLog(rawText)}`,
              );
            }
            throw new Error(
              `Soniox models response was not valid JSON (${response.status})`,
            );
          }
        }
        if (!response.ok) {
          const errorDetail = pickTrimmedString(
            payload && payload.error,
            payload && payload.message,
            payload && payload.detail,
            rawText,
          ) || `HTTP ${response.status}`;
          throw new Error(
            `Soniox models request failed (${response.status}): ${tailForLog(errorDetail)}`,
          );
        }
        const snapshot = cacheSonioxModels(
          normalizeSonioxModelEntryRows(payload || {}),
          Date.now(),
          false,
        );
        emitDebug(
          "voice.timeline",
          "soniox_models_prefetched",
          "info",
          { sessionKey: sessionService.peekSessionKey() || undefined },
          () => ({
            trigger,
            count: snapshot.models.length,
            stale: snapshot.stale,
          }),
        );
        return snapshot;
      })
      .catch((err) => {
        const snapshot = Array.isArray(cachedSonioxModels)
          ? cacheSonioxModels(cachedSonioxModels, cachedSonioxModelsFetchedAt, true)
          : cacheSonioxModels([], Date.now(), true);
        emitDebug(
          "voice.timeline",
          "soniox_models_prefetch_failed",
          "warn",
          { sessionKey: sessionService.peekSessionKey() || undefined },
          () => ({
            trigger,
            message: err && err.message ? err.message : String(err),
          }),
        );
        return snapshot;
      })
      .finally(() => {
        inFlightSonioxModelsFetch = null;
      });

    return inFlightSonioxModelsFetch;
  }

  async function mintSonioxTemporaryKey(clientId, request) {
    const voiceSessionId = pickTrimmedString(request && request.voiceSessionId);
    if (!voiceSessionId) {
      throw new Error("voiceSessionId is required");
    }

    const sessionKey = pickTrimmedString(request && request.sessionKey) || null;
    const nowMs = Date.now();
    const resolvedSessionKey = sessionKey || sessionService.peekSessionKey() || undefined;
    const emitIssued = (normalized, source) => {
      logger.info(
        `[relay] soniox temp key issued: clientId=${clientId} voiceSessionId=${voiceSessionId} source=${source} expiresAtMs=${normalized.expiresAtMs}`,
      );
      emitDebug(
        "voice.timeline",
        "soniox_temp_key_issued",
        "info",
        { sessionKey: resolvedSessionKey },
        () => ({
          clientId,
          voiceSessionId,
          expiresAtMs: normalized.expiresAtMs,
          source,
        }),
      );
      return normalized;
    };

    try {
      emitDebug(
        "voice.timeline",
        "soniox_temp_key_requested",
        "info",
        { sessionKey: resolvedSessionKey },
        () => ({
          clientId,
          voiceSessionId,
          expiresInSeconds: sonioxTemporaryKeyExpiresInSeconds,
        }),
      );

      if (typeof opts.createSonioxTemporaryKey === "function") {
        const overrideResult = await Promise.resolve(
          opts.createSonioxTemporaryKey({
            voiceSessionId,
            sessionKey,
            expiresInSeconds: sonioxTemporaryKeyExpiresInSeconds,
          }),
        );
        return emitIssued(
          normalizeSonioxTemporaryKeyResult(
            overrideResult || {},
            voiceSessionId,
            nowMs,
          ),
          "override",
        );
      }

      if (!configuredSonioxApiKey) {
        throw new Error("Soniox API key is not configured");
      }

      const fetchImpl = resolveFetchImpl();
      if (!fetchImpl) {
        throw new Error("fetch is not available for Soniox temporary-key minting");
      }

      const mintAbortController = new AbortController();
      const mintTimeoutTimer = setTimeout(
        () => mintAbortController.abort(),
        sonioxTemporaryKeyMintTimeoutMs,
      );
      let response;
      try {
        response = await fetchImpl(SONIOX_TEMP_KEY_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${configuredSonioxApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            usage_type: "transcribe_websocket",
            expires_in_seconds: sonioxTemporaryKeyExpiresInSeconds,
            client_reference_id: voiceSessionId,
          }),
          signal: mintAbortController.signal,
        });
      } finally {
        clearTimeout(mintTimeoutTimer);
      }

      const rawText =
        response && typeof response.text === "function"
          ? await response.text()
          : "";
      let payload = {};
      if (rawText) {
        try {
          payload = JSON.parse(rawText);
        } catch (err) {
          if (!response.ok) {
            throw new Error(
              `Soniox temporary-key request failed (${response.status}): ${tailForLog(rawText)}`,
            );
          }
          throw new Error(
            `Soniox temporary-key response was not valid JSON (${response.status})`,
          );
        }
      }

      if (!response.ok) {
        const errorDetail = pickTrimmedString(
          payload && payload.error,
          payload && payload.message,
          payload && payload.detail,
          rawText,
        ) || `HTTP ${response.status}`;
        throw new Error(
          `Soniox temporary-key request failed (${response.status}): ${tailForLog(errorDetail)}`,
        );
      }

      return emitIssued(
        normalizeSonioxTemporaryKeyResult(
          payload || {},
          voiceSessionId,
          nowMs,
        ),
        "soniox_api",
      );
    } catch (err) {
      const message =
        err && err.message
          ? err.message
          : "Soniox temporary-key request failed";
      const code = normalizeSonioxTemporaryKeyErrorCode(err);
      logger.warn(
        `[relay] soniox temp key failed: clientId=${clientId} voiceSessionId=${voiceSessionId} code=${code} message=${tailForLog(message)}`,
      );
      emitDebug(
        "voice.timeline",
        "soniox_temp_key_failed",
        "warn",
        { sessionKey: resolvedSessionKey },
        () => ({
          clientId,
          voiceSessionId,
          code,
          message: tailForLog(message),
        }),
      );
      throw err;
    }
  }

  function normalizeCartesiaAccessTokenResult(result, voiceSessionId, nowMs) {
    const accessToken =
      pickTrimmedString(result && (result.accessToken || result.token)) || "";
    if (!accessToken) {
      throw new Error("Cartesia access-token response missing token");
    }
    const expiresInSeconds = Number.isFinite(result && result.expiresInSeconds)
      ? result.expiresInSeconds
      : cartesiaAccessTokenExpiresInSeconds;
    const expiresAtMs = Number.isFinite(result && result.expiresAtMs)
      ? Math.floor(result.expiresAtMs)
      : Math.floor(nowMs + expiresInSeconds * 1000);
    return { voiceSessionId, accessToken, expiresAtMs };
  }

  async function mintCartesiaAccessToken(clientId, request) {
    const voiceSessionId = pickTrimmedString(request && request.voiceSessionId);
    if (!voiceSessionId) {
      throw new Error("voiceSessionId is required");
    }
    const sessionKey = pickTrimmedString(request && request.sessionKey) || null;
    const nowMs = Date.now();
    const resolvedSessionKey = sessionKey || sessionService.peekSessionKey() || undefined;
    const emitIssued = (normalized, source) => {
      logger.info(
        `[relay] cartesia access token issued: clientId=${clientId} voiceSessionId=${voiceSessionId} source=${source} expiresAtMs=${normalized.expiresAtMs}`,
      );
      emitDebug(
        "voice.timeline",
        "cartesia_access_token_issued",
        "info",
        { sessionKey: resolvedSessionKey },
        () => ({ clientId, voiceSessionId, expiresAtMs: normalized.expiresAtMs, source }),
      );
      return normalized;
    };

    try {
      if (typeof opts.createCartesiaAccessToken === "function") {
        const overrideResult = await Promise.resolve(
          opts.createCartesiaAccessToken({
            voiceSessionId,
            sessionKey,
            expiresInSeconds: cartesiaAccessTokenExpiresInSeconds,
          }),
        );
        return emitIssued(
          normalizeCartesiaAccessTokenResult(overrideResult || {}, voiceSessionId, nowMs),
          "override",
        );
      }

      if (!configuredCartesiaApiKey) {
        throw new Error("Cartesia API key is not configured");
      }
      const fetchImpl = resolveFetchImpl();
      if (!fetchImpl) {
        throw new Error("fetch is not available for Cartesia access-token minting");
      }

      const mintAbortController = new AbortController();
      const mintTimeoutTimer = setTimeout(
        () => mintAbortController.abort(),
        cartesiaAccessTokenMintTimeoutMs,
      );
      let response;
      try {
        response = await fetchImpl(CARTESIA_ACCESS_TOKEN_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${configuredCartesiaApiKey}`,
            "Cartesia-Version": CARTESIA_VERSION,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            grants: { stt: true },
            expires_in: cartesiaAccessTokenExpiresInSeconds,
          }),
          signal: mintAbortController.signal,
        });
      } finally {
        clearTimeout(mintTimeoutTimer);
      }

      const rawText =
        response && typeof response.text === "function" ? await response.text() : "";
      let payload = {};
      if (rawText) {
        try {
          payload = JSON.parse(rawText);
        } catch (err) {
          throw new Error(
            `Cartesia access-token response was not valid JSON (${response.status})`,
          );
        }
      }
      if (!response.ok) {
        const errorDetail =
          pickTrimmedString(
            payload && payload.message,
            payload && payload.error,
            rawText,
          ) || `HTTP ${response.status}`;
        throw new Error(
          `Cartesia access-token request failed (${response.status}): ${tailForLog(errorDetail)}`,
        );
      }

      return emitIssued(
        normalizeCartesiaAccessTokenResult(
          { token: payload && payload.token },
          voiceSessionId,
          nowMs,
        ),
        "cartesia_api",
      );
    } catch (err) {
      const message = err && err.message ? err.message : "Cartesia access-token request failed";
      logger.warn(
        `[relay] cartesia access token failed: clientId=${clientId} voiceSessionId=${voiceSessionId} message=${tailForLog(message)}`,
      );
      emitDebug(
        "voice.timeline",
        "cartesia_access_token_failed",
        "warn",
        { sessionKey: resolvedSessionKey },
        () => ({ clientId, voiceSessionId, message: tailForLog(message) }),
      );
      throw err;
    }
  }

  let upstreamRuntime = null;
  const evenAiSettingsStore = createEvenAiSettingsStore({
    logger,
    emitDebug,
    stateDir: opts.stateDir,
    defaults: {
      routingMode: opts.evenAiRoutingMode,
      systemPrompt: opts.evenAiSystemPrompt,
    },
  });
  const ocuClawSettingsStore = createOcuClawSettingsStore({
    logger,
    emitDebug,
    stateDir: opts.stateDir,
    defaults: {
      systemPrompt: opts.ocuClawSystemPrompt,
    },
  });
  const stablePromptSnapshots = createStablePromptSnapshotStore({
    stateDir: opts.stateDir,
    emitDebug,
  });

  let stablePromptSweepTimer = null;

  let uploadCaptureArmingDisposer = null;

  function computeStableChannelOne(startSignals) {
    const baseReadability = composeReadabilitySystemPrompt(
      ocuClawSettingsStore.getSnapshot().systemPrompt,
    );
    const display = composeGlassesDisplaySystemPrompt({
      emoji: startSignals.emoji,
      pace: startSignals.pace,
    });
    const glassesPointer = composeGlassesUiNudgeSystemPrompt();
    const parts = [];
    if (baseReadability) parts.push(baseReadability);
    if (display) parts.push(display);
    if (glassesPointer) parts.push(glassesPointer);
    return parts.join("\n\n");
  }

  function stableSendOptions(resolvedSessionKey, sessionId, perTurnSignals) {
    const signals = perTurnSignals || {};

    const startEmoji = signals.neuralEmojiReactorState === "active";
    const startPace = signals.neuralPaceModulatorState === "active";
    const extraSystemPrompt = stablePromptSnapshots.getOrCreate(
      resolvedSessionKey,
      sessionId,
      () => computeStableChannelOne({ emoji: startEmoji, pace: startPace }),
    );

    if (
      stablePromptSnapshots.wouldChurn(
        resolvedSessionKey,
        sessionId,
        computeStableChannelOne({ emoji: startEmoji, pace: startPace }),
      )
    ) {
      emitDebug(
        "relay.session",
        "stable_prompt_churn_detected",
        "warn",
        { sessionKey: resolvedSessionKey },
        () => ({ sessionId: sessionId || null }),
      );
    }
    const options = { extraSystemPrompt };

    const agentId = sessionService.getSessionAgentId(resolvedSessionKey);
    if (typeof agentId === "string" && agentId.trim()) {
      options.agentId = agentId.trim();
    }
    return options;
  }

  function buildOcuClawSendDiagnostic(params = {}) {
    const attachment = params.attachment || null;
    const messageId =
      typeof params.id === "string" && params.id.trim()
        ? params.id.trim()
        : null;
    const sessionKey =
      typeof params.sessionKey === "string" && params.sessionKey.trim()
        ? params.sessionKey.trim()
        : sessionService.ensureSessionKey();
    const source =
      typeof params.source === "string" && params.source.trim()
        ? params.source.trim()
        : "relay_send";

    return {
      messageId,
      sessionKey,
      source,
      textChars: typeof params.text === "string" ? params.text.length : 0,
      hasAttachment: !!attachment,
      attachmentBytes:
        attachment && Number.isFinite(attachment.sizeBytes)
          ? Math.floor(attachment.sizeBytes)
          : null,
    };
  }

  function buildLocalUserMessageContent(text, attachment) {
    const userContent = [];
    if (typeof text === "string" && text.trim()) {
      userContent.push({ type: "text", text });
    }
    if (attachment) {
      userContent.push({
        type: "image",
        mimeType: attachment.mimeType || null,
        fileName: attachment.name || null,
        source: attachment.source || null,
        sizeBytes:
          Number.isFinite(attachment.sizeBytes) && attachment.sizeBytes > 0
            ? Math.floor(attachment.sizeBytes)
            : null,
        widthPx:
          Number.isFinite(attachment.widthPx) && attachment.widthPx > 0
            ? Math.floor(attachment.widthPx)
            : null,
        heightPx:
          Number.isFinite(attachment.heightPx) && attachment.heightPx > 0
            ? Math.floor(attachment.heightPx)
            : null,
      });
    }
    if (userContent.length === 0) {
      userContent.push({ type: "text", text });
    }
    return userContent;
  }

  function buildGatewayAttachment(attachment) {
    if (
      !attachment ||
      typeof attachment !== "object" ||
      typeof attachment.base64Data !== "string" ||
      !attachment.base64Data
    ) {
      return null;
    }
    const normalizedAttachment = {
      type: attachment.kind || "image",
      mimeType: attachment.mimeType || "image/jpeg",
      fileName: attachment.name || "image.jpg",
      content: attachment.base64Data,
    };
    if (typeof attachment.source === "string" && attachment.source) {
      normalizedAttachment.source = attachment.source;
    }
    if (Number.isFinite(attachment.sizeBytes) && attachment.sizeBytes > 0) {
      normalizedAttachment.sizeBytes = Math.floor(attachment.sizeBytes);
    }
    if (Number.isFinite(attachment.widthPx) && attachment.widthPx > 0) {
      normalizedAttachment.widthPx = Math.floor(attachment.widthPx);
    }
    if (Number.isFinite(attachment.heightPx) && attachment.heightPx > 0) {
      normalizedAttachment.heightPx = Math.floor(attachment.heightPx);
    }
    return normalizedAttachment;
  }

  function buildOcuClawInitialSessionConfigPatch(settings) {
    const patch = {};
    if (settings && typeof settings.defaultModel === "string" && settings.defaultModel.trim()) {
      patch.modelRef = settings.defaultModel.trim();
    }
    if (
      settings &&
      typeof settings.defaultThinking === "string" &&
      settings.defaultThinking.trim()
    ) {
      patch.thinkingLevel = settings.defaultThinking.trim().toLowerCase();
    }
    if (settings && settings.defaultFastMode === true) {
      patch.fastMode = true;
    }
    return Object.keys(patch).length > 0 ? patch : null;
  }

  function seedSessionAgentDefault(sessionKey, defaultAgent) {
    if (
      !sessionKey ||
      !sessionService ||
      typeof sessionService.setSessionAgentId !== "function" ||
      typeof sessionService.getSessionAgentId !== "function"
    ) {
      return;
    }
    const normalized =
      typeof defaultAgent === "string" ? defaultAgent.trim() : "";
    if (!normalized) {
      return;
    }
    if (
      typeof sessionService.hasExplicitSessionAgent === "function" &&
      sessionService.hasExplicitSessionAgent(sessionKey)
    ) {

      return;
    }
    sessionService.setSessionAgentId(sessionKey, normalized);
  }

  async function maybeSeedOcuClawSessionConfig(sessionKey) {
    if (
      !sessionKey ||
      !sessionService ||
      typeof sessionService.hasPendingInitialConfig !== "function" ||
      !sessionService.hasPendingInitialConfig(sessionKey)
    ) {
      return;
    }

    const settings = ocuClawSettingsStore.getSnapshot();
    seedSessionAgentDefault(sessionKey, settings.defaultAgent);
    const patch = buildOcuClawInitialSessionConfigPatch(settings);
    if (!patch) {
      sessionService.clearPendingInitialConfig(sessionKey);
      return;
    }

    const result = await sessionService.setSessionModelConfig(sessionKey, patch);
    if (!result || result.status !== "accepted") {
      throw new Error(
        (result && result.error) || "failed to seed OcuClaw new-session defaults",
      );
    }
    if (
      result.config &&
      sessionKey === sessionService.ensureSessionKey() &&
      server
    ) {
      server.broadcast(handler.formatSessionModelConfig(result.config));
    }
  }

  async function seedOcuClawSessionConfigForNewSession(sessionKey) {
    if (!sessionKey || !sessionService) {
      return null;
    }

    const settings = ocuClawSettingsStore.getSnapshot();
    seedSessionAgentDefault(sessionKey, settings.defaultAgent);
    const patch = buildOcuClawInitialSessionConfigPatch(settings);
    if (!patch) {
      return null;
    }

    const seededConfig =
      typeof sessionService.primeSessionModelConfig === "function"
        ? sessionService.primeSessionModelConfig(sessionKey, patch)
        : null;
    const result = await sessionService.setSessionModelConfig(sessionKey, patch);
    if (result && result.status === "accepted" && result.config) {
      return result.config;
    }
    return seededConfig;
  }

  const sessionService = createSessionService({
    logger,
    gatewayBridge,
    conversationState,
    emitDebug,
    stateDir: opts.stateDir,
    sessionLimit: opts.sessionLimit,
    persistFirstUserMessages: opts.persistFirstUserMessages,
    strictFirstUserMessage: opts.strictFirstUserMessage,
    sessionCacheTtlMs: opts.sessionCacheTtlMs,
    getOpenclawConnected() {
      return upstreamRuntime ? upstreamRuntime.isConnected() : false;
    },
    getAgentName() {
      return upstreamRuntime ? upstreamRuntime.getAgentName() : null;
    },
    getAgentDisplayName(agentId) {
      return upstreamRuntime &&
        typeof upstreamRuntime.getAgentDisplayName === "function"
        ? upstreamRuntime.getAgentDisplayName(agentId)
        : null;
    },
    getDefaultAgentId() {
      return normalizeOcuClawDefaultAgent(
        ocuClawSettingsStore.getSnapshot().defaultAgent,
      );
    },
    isPinnedFirstUserMessageKey(sessionKey) {
      const normalizedSessionKey = normalizeEvenAiSessionKeyForLookup(sessionKey);
      if (!normalizedSessionKey) {
        return false;
      }
      const trackedThrowawayKeys =
        typeof evenAiSettingsStore.getTrackedThrowawayKeys === "function"
          ? evenAiSettingsStore.getTrackedThrowawayKeys()
          : [];
      return dedupeNormalizedSessionKeys(trackedThrowawayKeys).some(
        (trackedKey) =>
          trackedKey.toLowerCase() === normalizedSessionKey.toLowerCase(),
      );
    },
    onSessionStateReset: resetActivityStatusAdapter,
    onPagesChanged: cachePages,
    onStatusChanged: broadcastStatus,
    onSessionModelConfig(config) {
      applyCurrentSessionModelConfigSnapshot(config);
    },
    broadcastSessions: () => broadcastSessions(),
    broadcastEvenAiSessions: () => broadcastEvenAiSessions(),
  });

  const relayHealth = createRelayHealthMonitor({
    emitDebug(event, severity, data) {
      emitDebug(
        "relay.health",
        event,
        severity,
        { sessionKey: sessionService.peekSessionKey() || undefined },
        () => data,
        { force: event === "relay_queue_depth" },
      );
    },
  });
  relayHealth.start();

  const relayOperationRegistry = createRelayOperationRegistry({
    emitDebug(event, severity, data, context = {}) {
      emitDebug(
        "relay.operation",
        event,
        severity,
        {
          sessionKey: context.sessionKey || sessionService.peekSessionKey() || undefined,
          runId: context.runId || undefined,
        },
        () => data,
      );
    },
  });

  function isActiveSessionModelConfig(config) {
    return !!(
      config &&
      typeof config.sessionKey === "string" &&
      (
        typeof sessionService.isCurrentSession === "function"
          ? sessionService.isCurrentSession(config.sessionKey)
          : config.sessionKey === sessionService.ensureSessionKey()
      )
    );
  }

  function applyCurrentSessionModelConfigSnapshot(config) {
    if (!isActiveSessionModelConfig(config)) {
      return false;
    }
    currentSessionModelConfigSnapshot = config;
    if (
      upstreamRuntime &&
      typeof upstreamRuntime.handleCurrentSessionModelConfigChanged === "function"
    ) {
      upstreamRuntime.handleCurrentSessionModelConfigChanged().catch((err) => {
        logger.warn(`[relay] Provider usage rebroadcast failed after session config update: ${err.message}`);
      });
    }
    return true;
  }

  function clearCurrentSessionModelConfigSnapshot(trigger) {
    currentSessionModelConfigSnapshot = null;
    if (
      upstreamRuntime &&
      typeof upstreamRuntime.handleCurrentSessionModelConfigCleared === "function"
    ) {
      upstreamRuntime.handleCurrentSessionModelConfigCleared().catch((err) => {
        logger.warn(`[relay] Provider usage clear broadcast failed after ${trigger}: ${err.message}`);
      });
    }
  }

  const SESSION_TITLE_STATUS_FALLBACK_MS = 1500;
  let sessionTitleStatusFallbackTimer = null;

  function broadcastActivity(rawActivity) {
    const activity = activityStatusAdapter.augmentActivity(rawActivity || {});
    const runId = activity && activity.runId ? activity.runId : null;
    const origin = activity && activity.origin ? activity.origin : null;
    const phase = activity && activity.phase ? activity.phase : null;
    agentTurnTracker.onActivity(
      (activity && activity.sessionKey) || sessionService.ensureSessionKey(),
      phase,
    );

    emitDebug(
      "app.timeline",
      "activity",
      "debug",
      {
        sessionKey: (activity && activity.sessionKey) || sessionService.ensureSessionKey(),
        runId,
      },
      () => ({
        state: (activity && activity.state) || null,
        tool: (activity && activity.tool) || null,
        label: (activity && activity.label) || null,
        intent: (activity && activity.intent) || null,
        thinkingSummarySource: (activity && activity.thinkingSummarySource) || null,
        category: (activity && activity.category) || null,
        isError: typeof activity.isError === "boolean" ? activity.isError : null,
        code: (activity && activity.code) || null,
        activityId: (activity && activity.activityId) || null,
        seq: Number.isFinite(activity && activity.seq) ? activity.seq : null,
        origin,
        phase,
      }),
    );

    server.broadcast(handler.formatActivity(activity));

    if (sessionTitleStatusFallbackTimer) {
      clearTimeout(sessionTitleStatusFallbackTimer);
      sessionTitleStatusFallbackTimer = null;
    }
    if (
      activity &&
      activity.tool === "set_session_title" &&
      phase !== "end" &&
      origin !== "synthetic_session_title_fallback"
    ) {
      const fallbackSessionKey = activity.sessionKey || null;
      const fallbackRunId = runId;
      sessionTitleStatusFallbackTimer = setTimeout(() => {
        sessionTitleStatusFallbackTimer = null;
        broadcastActivity({
          state: "thinking",
          sessionKey: fallbackSessionKey,
          runId: fallbackRunId,
          origin: "synthetic_session_title_fallback",
          phase: "update",
        });
      }, SESSION_TITLE_STATUS_FALLBACK_MS);
    }

    return activity;
  }

  function broadcastProviderUsageSnapshot(snapshot) {
    if (!server || !handler || typeof handler.formatProviderUsageSnapshot !== "function") {
      return snapshot;
    }
    server.broadcast(handler.formatProviderUsageSnapshot(snapshot || {}));
    return snapshot;
  }

  function broadcastAgentsCatalog(snapshot) {
    if (!server || !handler || typeof handler.formatAgentsCatalog !== "function") {
      return snapshot;
    }

    const agents =
      snapshot && Array.isArray(snapshot.agents) ? snapshot.agents : [];
    if (agents.length === 0 && !(snapshot && snapshot.unsupported)) {
      return snapshot;
    }
    server.broadcast(handler.formatAgentsCatalog(snapshot || {}));
    return snapshot;
  }

  const appClientDisconnectHandlers = new Set();
  function onAppClientDisconnect(handler) {
    if (typeof handler !== "function") return () => {};
    appClientDisconnectHandlers.add(handler);
    return () => appClientDisconnectHandlers.delete(handler);
  }
  function dispatchAppClientDisconnect(sessionKey) {
    for (const handler of appClientDisconnectHandlers) {
      try { handler({ sessionKey }); } catch (err) {
        logger.warn(`[relay] app_client_disconnect handler threw: ${err && err.message ? err.message : err}`);
      }
    }
  }

  const glassesUiResultHandlers = new Set();

  function sendGlassesUiRender(params) {
    if (!server) return;
    const payload = {
      type: "glasses_ui_render",
      sessionKey: params && typeof params.sessionKey === "string" ? params.sessionKey : null,
      surfaceId: params && typeof params.surfaceId === "string" ? params.surfaceId : "",
      depth: Number.isFinite(params && params.depth) ? Math.floor(params.depth) : 1,
      spec: params && params.spec ? params.spec : null,
      marker: sanitizeGlassesMarker(params && params.marker),
    };
    server.broadcast(JSON.stringify(payload));
    emitDebug(
      "glasses.lifecycle",
      "surface_send",
      "debug",
      { sessionKey: payload.sessionKey || undefined },
      () => ({ surfaceId: payload.surfaceId, mode: "render", depth: payload.depth, ...summarizeGlassesUiContent(payload.spec) }),
    );
  }

  function sendGlassesUiSurfaceUpdate(params) {
    if (!server) return;
    const patch = params && params.patch ? params.patch : null;
    if (!patch) return;
    const cleanPatch = {};
    if (typeof patch.title === "string") cleanPatch.title = patch.title;
    if (typeof patch.body === "string") cleanPatch.body = patch.body;
    if (Array.isArray(patch.items)) {

      cleanPatch.items = patch.items
        .map((i) => {
          if (typeof i === "string") return i;
          if (i && typeof i === "object" && typeof i.label === "string") {
            const o = { label: i.label };
            if (typeof i.body === "string") o.body = i.body;
            return o;
          }
          return null;
        })
        .filter((i) => i !== null);
    }
    const m = sanitizeGlassesMarker(patch.marker); if (m) cleanPatch.marker = m;
    const payload = {
      type: "glasses_ui_surface_update",
      sessionKey: params && typeof params.sessionKey === "string" ? params.sessionKey : null,
      surfaceId: params && typeof params.surfaceId === "string" ? params.surfaceId : "",
      patch: cleanPatch,
    };
    server.broadcast(JSON.stringify(payload));
    emitDebug(
      "glasses.lifecycle",
      "surface_send",
      "debug",
      { sessionKey: payload.sessionKey || undefined },
      () => ({ surfaceId: payload.surfaceId, mode: "update", ...summarizeGlassesUiContent(cleanPatch) }),
    );
  }

  function onGlassesUiResult(handler) {
    if (typeof handler !== "function") return () => {};
    glassesUiResultHandlers.add(handler);
    return () => glassesUiResultHandlers.delete(handler);
  }

  function dispatchGlassesUiResult(frame) {
    if (!frame || typeof frame !== "object") return;
    for (const handler of glassesUiResultHandlers) {
      try {
        handler({
          surfaceId: typeof frame.surfaceId === "string" ? frame.surfaceId : "",
          outcome: frame.outcome,
        });
      } catch (err) {
        logger.warn(`[relay] glasses_ui_result handler threw: ${err.message}`);
      }
    }
  }

  const glassesUiNavEventHandlers = new Set();

  function onGlassesUiNavEvent(handler) {
    if (typeof handler !== "function") return () => {};
    glassesUiNavEventHandlers.add(handler);
    return () => glassesUiNavEventHandlers.delete(handler);
  }

  function dispatchGlassesUiNavEvent(frame) {
    if (!frame || typeof frame !== "object") return;
    for (const handler of glassesUiNavEventHandlers) {
      try {
        handler({
          surfaceId: typeof frame.surfaceId === "string" ? frame.surfaceId : "",
          depth: Number.isFinite(frame.depth) ? Math.max(1, Math.floor(frame.depth)) : 1,
        });
      } catch (err) {
        logger.warn(`[relay] glasses_ui_nav_event handler threw: ${err.message}`);
      }
    }
  }

  const deviceInfoResponseHandlers = new Set();

  function sendDeviceInfoRequest(params) {
    if (!server) return;
    const payload = {
      type: "device_info_request",
      sessionKey: params && typeof params.sessionKey === "string" ? params.sessionKey : null,
      requestId: params && typeof params.requestId === "string" ? params.requestId : "",
    };
    server.broadcast(JSON.stringify(payload));
  }

  function onDeviceInfoResponse(handler) {
    if (typeof handler !== "function") return () => {};
    deviceInfoResponseHandlers.add(handler);
    return () => deviceInfoResponseHandlers.delete(handler);
  }

  function dispatchDeviceInfoResponse(frame) {
    if (!frame || typeof frame !== "object") return;
    for (const handler of deviceInfoResponseHandlers) {
      try {
        handler({
          requestId: typeof frame.requestId === "string" ? frame.requestId : "",
          ok: frame.ok === true,
          code: typeof frame.code === "string" ? frame.code : undefined,
          data: frame.data && typeof frame.data === "object" ? frame.data : undefined,
        });
      } catch (err) {
        logger.warn(
          `[relay] device_info_response handler threw: ${err && err.message ? err.message : err}`,
        );
      }
    }
  }

  function normalizeAttachmentErrorCode(err) {
    if (!err) return "attachment_upstream_rejected";
    const code = typeof err.code === "string" ? err.code.trim() : "";
    if (
      code === "attachment_invalid_type" ||
      code === "attachment_decode_failed" ||
      code === "attachment_too_large" ||
      code === "attachment_too_large_encoded" ||
      code === "attachment_missing_data" ||
      code === "attachment_upstream_rejected"
    ) {
      return code;
    }

    const message = typeof err.message === "string" ? err.message.toLowerCase() : "";
    if (message.includes("invalid type") || message.includes("mime")) {
      return "attachment_invalid_type";
    }
    if (message.includes("base64") || message.includes("decode")) {
      return "attachment_decode_failed";
    }
    if (message.includes("too large") || message.includes("exceeds")) {
      return "attachment_too_large";
    }
    return "attachment_upstream_rejected";
  }

  function dispatchOcuClawUserSend(params = {}) {
    const id = params.id;
    const text = params.text;
    const sessionKey = params.sessionKey;
    const attachment = params.attachment || null;
    const clientDisplaySignals = params.clientDisplaySignals || null;
    const resolvedSessionKey = sessionKey || sessionService.ensureSessionKey();
    sessionService.recordFirstSentUserMessage(resolvedSessionKey, text);
    if (clientDisplaySignals && resolvedSessionKey) {
      sessionService.recordNeuralSessionNamesEnabled(
        resolvedSessionKey,
        clientDisplaySignals.neuralSessionNamesEnabled !== false,
      );
      sessionService.recordDisplayToggleStates(resolvedSessionKey, {
        emoji: clientDisplaySignals.neuralEmojiReactorState === "active",
        pace: clientDisplaySignals.neuralPaceModulatorState === "active",
      });
    }
    const hasAttachment = !!attachment;
    const sendStartedAt = Date.now();
    relayOperationRegistry.markStarted(id);
    sessionService.invalidateSessionsCache();
    emitDebug(
      "relay.protocol",
      "send",
      "info",
      { sessionKey: resolvedSessionKey },
      () => ({
        messageId: id,
        textChars: typeof text === "string" ? text.length : 0,
        hasAttachment,
        attachmentBytes:
          attachment && Number.isFinite(attachment.sizeBytes)
            ? attachment.sizeBytes
            : null,
      }),
    );

    return maybeSeedOcuClawSessionConfig(resolvedSessionKey).then(() => {

      agentTurnTracker.markBusy(resolvedSessionKey);

      const upstreamPromise = gatewayBridge.sendMessage(
        text,
        resolvedSessionKey,
        attachment,
        {
          ...stableSendOptions(
            resolvedSessionKey,

            resolvedSessionKey,
            clientDisplaySignals,
          ),
          diagnostic: buildOcuClawSendDiagnostic({
            ...params,
            sessionKey: resolvedSessionKey,
          }),
        },
      );
      const upstreamDispatchedAt = Date.now();

      const userContent = buildLocalUserMessageContent(text, attachment);
      conversationState.addMessage("user", userContent);
      emitDebug(
        "openclaw.message",
        "user_message",
        "info",
        { sessionKey: resolvedSessionKey },
        () => ({ text: typeof text === "string" ? text : "" }),
      );
      broadcastPages();
      const localPublishDoneAt = Date.now();

      emitDebug(
        "relay.protocol",
        "send_local_publish",
        "debug",
        { sessionKey: resolvedSessionKey },
        () => ({
          messageId: id,
          upstreamDispatchMs: upstreamDispatchedAt - sendStartedAt,
          localPublishMs: localPublishDoneAt - upstreamDispatchedAt,
          onSendSyncMs: localPublishDoneAt - sendStartedAt,
          hasAttachment,
        }),
      );

      return upstreamPromise.then(
        (result) => {
          const ackAt = Date.now();
          const runId = result && result.runId ? result.runId : null;
          relayOperationRegistry.markUpstreamAck(id, {
            runId,
            status: result && result.status ? result.status : null,
          });
          if (runId && upstreamRuntime) {
            upstreamRuntime.trackAcceptedRun({
              runId,
              sessionKey: resolvedSessionKey,
              messageId: id,
              sendStartedAt,
              ackAt,
            });
          }
          emitDebug(
            "relay.protocol",
            "send_upstream_ack",
            "debug",
            { sessionKey: resolvedSessionKey, runId },
            () => ({
              messageId: id,
              runId,
              status: result && result.status ? result.status : null,
              elapsedMs: ackAt - sendStartedAt,
              hasAttachment,
            }),
          );
          return result;
        },
        (err) => {
          const mirroredErrorCode =
            err && typeof err.errorCode === "string" && err.errorCode.trim()
              ? err.errorCode.trim()
              : err && typeof err.code === "string" && err.code.trim()
                ? err.code.trim()
                : attachment
                  ? normalizeAttachmentErrorCode(err)
                  : null;
          if (mirroredErrorCode && err && typeof err === "object") {
            err.errorCode = mirroredErrorCode;
          }
          emitDebug(
            "relay.protocol",
            "send_upstream_error",
            "warn",
            { sessionKey: resolvedSessionKey },
            () => ({
              messageId: id,
              elapsedMs: Date.now() - sendStartedAt,
              hasAttachment,
              errorCode:
                err && typeof err.errorCode === "string" ? err.errorCode : null,
              message: err && err.message ? err.message : String(err),
            }),
          );
          throw err;
        },
      );
    });
  }

  function dispatchOcuClawSessionAbort(params = {}) {
    const requestId = params.requestId;
    const sessionKey =
      typeof params.sessionKey === "string" && params.sessionKey.trim()
        ? params.sessionKey.trim()
        : sessionService.ensureSessionKey();
    emitDebug(
      "relay.protocol",
      "session_abort_requested",
      "info",
      { sessionKey },
      () => ({ requestId }),
    );
    return gatewayBridge.request("sessions.abort", { key: sessionKey }).then(
      (result) => ({
        status: "accepted",
        ...(result && typeof result === "object" ? result : {}),
      }),
    );
  }

  function dispatchOcuClawSessionSteer(params = {}) {
    const requestId = params.requestId;
    const steerStartedAt = Date.now();
    const sessionKey =
      typeof params.sessionKey === "string" && params.sessionKey.trim()
        ? params.sessionKey.trim()
        : sessionService.ensureSessionKey();
    const message = typeof params.message === "string" ? params.message : "";
    const attachment = params.attachment || null;
    const gatewayAttachment = buildGatewayAttachment(attachment);
    const request = {
      key: sessionKey,
      message,
      idempotencyKey: requestId,
    };
    if (gatewayAttachment) {
      request.attachments = [gatewayAttachment];
    }

    sessionService.recordFirstSentUserMessage(sessionKey, message);
    sessionService.invalidateSessionsCache();
    agentTurnTracker.markBusy(sessionKey);
    emitDebug(
      "relay.protocol",
      "session_steer_requested",
      "info",
      { sessionKey },
      () => ({
        requestId,
        messageChars: message.length,
        hasAttachment: !!attachment,
      }),
    );

    const diagnostic = {
      messageId: requestId,
      sessionKey,
      source: "phone_ui_replace",
      textChars: message.length,
      hasAttachment: !!attachment,
      attachmentBytes:
        attachment && Number.isFinite(attachment.sizeBytes)
          ? Math.floor(attachment.sizeBytes)
          : null,
    };

    return maybeSeedOcuClawSessionConfig(sessionKey)
      .then(() => gatewayBridge.request("sessions.steer", request, {
        expectFinal: false,
        diagnostic,
      }))
      .then((result) => {
        const ackAt = Date.now();
        const runId = result && result.runId ? result.runId : null;
        if (runId && upstreamRuntime) {
          upstreamRuntime.trackAcceptedRun({
            runId,
            sessionKey,
            messageId: requestId,
            sendStartedAt: steerStartedAt,
            ackAt,
          });
        }
        const userContent = buildLocalUserMessageContent(message, attachment);
        conversationState.addMessage("user", userContent);
        emitDebug(
          "openclaw.message",
          "user_message",
          "info",
          { sessionKey },
          () => ({ text: message }),
        );
        broadcastPages();
        return {
          ...(result && typeof result === "object" ? result : {}),
          status: "accepted",
        };
      });
  }

  function emitListenInterceptRecovery(params = {}) {
    const connectedAppClients = server ? server.getConnectedAppCount() : 0;
    if (!server || !handler) {
      return {
        cleanupEmitted: false,
        connectedAppClients,
      };
    }

    server.broadcast(
      handler.formatListenError(
        LISTEN_INTERCEPT_RECOVERY_ERROR,
        LISTEN_INTERCEPT_RECOVERY_CODE,
      ),
    );
    server.broadcast(handler.formatListenEnded());
    return {
      cleanupEmitted: true,
      connectedAppClients,
    };
  }

  function emitListenInterceptBroadcast(params = {}) {
    if (!server || !handler) {
      return;
    }
    const sessionKey = params && typeof params.sessionKey === "string" ? params.sessionKey : null;
    server.broadcast(handler.formatEvenAiListenIntercepted(sessionKey));
  }

  let server = null;
  let evenAiEndpoint = null;
  let evenAiRouter = null;
  let evenAiRunWaiter = null;
  const pendingBufferedEvenAiResponses = new Map();
  let relayApi = null;

  function applyTraceLogSet(clientId, request) {
    const enabled = !!(request && request.enabled === true);
    liveUiTraceLogEnabled = enabled;
    let persisted = false;
    if (liveUiTraceFlagPath) {
      try {
        fs.writeFileSync(liveUiTraceFlagPath, JSON.stringify({ enabled }) + "\n");
        persisted = true;
      } catch (err) {
        logger.warn(`[relay] liveui trace-log flag persist failed: ${err && err.message ? err.message : err}`);
      }
    }
    emitDebug("relay.protocol", "trace_log_set", "info", { sessionKey: sessionService.ensureSessionKey() }, () => ({ clientId, enabled, persisted }));
    return { ok: true, enabled, persisted, persistedPath: liveUiTraceFlagPath };
  }

  function persistDebugArm() {
    if (!debugArmStatePath) return false;
    try {
      const enabled = debugStore.getSnapshot().enabled;
      fs.writeFileSync(debugArmStatePath, JSON.stringify({ enabled }) + "\n");
      return true;
    } catch (err) {
      logger.warn(`[relay] debug arm persist failed: ${err && err.message ? err.message : err}`);
      return false;
    }
  }

  function applyDebugSet(clientId, request) {
    const result = debugStore.setCategories(request);
    if (!result.ok) {
      throw new Error(result.error || "debug-set failed");
    }

    persistDebugArm();
    emitDebug(
      "relay.protocol",
      "debug_set",
      "info",
      { sessionKey: sessionService.ensureSessionKey() },
      () => ({
        clientId,
        enable: result.applied.enable,
        disable: result.applied.disable,
        ttlMs: result.ttlMs,
        enabledCount: result.enabled.length,
      }),
    );
    return result;
  }

  const handler = createDownstreamHandler({
    logger,
    externalDebugToolsEnabled,
    getSnapshotRevision(kind) {
      if (kind === "pages") return pagesRevision;
      if (kind === "status") return statusRevision;
      return null;
    },

    onSend(id, text, sessionKey, attachment, clientDisplaySignals) {
      return dispatchOcuClawUserSend({
        id,
        text,
        sessionKey,
        attachment,
        clientDisplaySignals: clientDisplaySignals || null,
        source: "phone_ui",
      });
    },
    onAbortSession({ requestId, sessionKey }) {
      return dispatchOcuClawSessionAbort({ requestId, sessionKey });
    },
    onSteerSession({ requestId, sessionKey, message, attachment }) {
      return dispatchOcuClawSessionSteer({
        requestId,
        sessionKey,
        message,
        attachment,
      });
    },
    onGlassesUiResult(frame) {
      emitDebug(
        "glasses.lifecycle",
        "surface_outcome",
        "debug",
        {},
        () => ({ surfaceId: frame && frame.surfaceId, outcome: frame && frame.outcome }),
      );
      dispatchGlassesUiResult(frame);
    },
    onGlassesUiNavEvent(frame) {
      emitDebug(
        "glasses.lifecycle",
        "nav_event_recv",
        "debug",
        {},
        () => ({ surfaceId: frame && frame.surfaceId, depth: frame && frame.depth }),
      );
      dispatchGlassesUiNavEvent(frame);
    },
    onDeviceInfoResponse(frame) {
      dispatchDeviceInfoResponse(frame);
    },
    onGlassesUiRenderInject(params) {
      sendGlassesUiRender(params);
    },
    onSetUserSessionTitle(sessionKey, title) {
      const result = sessionService.setSessionTitle(sessionKey, title, { userSet: true });
      if (result && result.ok) {
        broadcastSessions();
      }
    },
    onSetSessionPinned(sessionKey, pinned, kind) {
      const result = sessionService.setSessionPinned(kind, sessionKey, pinned);
      if (result && result.ok) {
        broadcastSessions();
      }
      return result;
    },
    onCompactSession({ sessionKey }) {
      if (!upstreamRuntime || typeof upstreamRuntime.compactActiveSession !== "function") {
        return Promise.resolve({
          status: "rejected",
          error: "upstream runtime not ready",
        });
      }
      return upstreamRuntime.compactActiveSession(sessionKey);
    },
    onDeleteSessions(sessionKeys, kind, switchBeforeDelete) {
      if (Array.isArray(sessionKeys)) {
        for (const key of sessionKeys) {
          if (typeof key === "string" && key.trim()) {
            stablePromptSnapshots.evict(key);
            sessionService.clearDisplayToggleStates(key);
          }
        }
      }
      const action = switchBeforeDelete
        ? sessionService.switchAndDeleteSessions(kind, sessionKeys)
        : sessionService.deleteSessions(kind, sessionKeys);
      Promise.resolve(action)
        .then(() => broadcastSessions())
        .catch((err) => {
          logger.error(`[relay] deleteSessions failed: ${err && err.message ? err.message : err}`);
        });
    },
    onSearchTranscripts(clientId, query, kind) {
      Promise.resolve(sessionService.searchTranscripts(kind, query))
        .then((result) => {
          if (!server) return;
          const payload = {
            type: "ocuclaw.session.transcripts.search.result",
            query,
            kind,
            snippets: result.snippets,
            truncated: result.truncated,
          };
          server.unicast(clientId, JSON.stringify(payload));
        })
        .catch((err) => {
          logger.error(`[relay] searchTranscripts failed: ${err && err.message ? err.message : err}`);
          if (server) {
            const payload = {
              type: "ocuclaw.session.transcripts.search.result",
              query, kind, snippets: [], truncated: false,
            };
            server.unicast(clientId, JSON.stringify(payload));
          }
        });
    },

    onDebugBundleRequest(clientId, msg) {

      const reportedClientVersion = (() => {
        try {
          const snap =
            server && typeof server.getReadinessSnapshot === "function"
              ? server.getReadinessSnapshot()
              : null;
          const entry =
            snap && Array.isArray(snap.clients)
              ? snap.clients.find((c) => c.clientId === clientId)
              : null;
          const v = entry && typeof entry.clientVersion === "string" ? entry.clientVersion.trim() : "";
          return v.length ? v : null;
        } catch {
          return null;
        }
      })();
      const deps = {
        gatesOn: () => externalDebugToolsEnabled && allowDebugUpload,
        dump: (query) => debugStore.dump(query),

        preset:
          opts.debugUploadCapturePreset &&
          Array.isArray(opts.debugUploadCapturePreset) &&
          opts.debugUploadCapturePreset.length
            ? opts.debugUploadCapturePreset
            : UPLOAD_CAPTURE_PRESET,

        build: {
          clientVersion: reportedClientVersion,
          requiresClientVersion: pluginVersionService.getRequiresClientVersion(),
          pluginVersion: pluginVersionService.getPluginVersion(),
          openclawVersion: pluginVersionService.getOpenClawHostVersion(),
          distHash: pluginVersionService.getDistHash(),
        },
        idSalt: debugBundleIdSalt,
        maxZipBytes: debugUploadMaxZipBytes,
        chunkBytes: 64000,
        send: (id, frame) => {
          if (server) server.unicast(id, JSON.stringify(frame));
        },

        emit: (event, data) =>
          emitDebug("relay.operation", event, "debug", {}, () => data),
        newBundleId: () => crypto.randomUUID(),
        cachePut: (id, e) => bundleCache.put(id, e),
        now: () => Date.now(),
      };
      return Promise.resolve(handleDebugBundleRequest(deps, clientId, msg)).catch(
        (err) => {
          logger.error(
            `[relay] debug-bundle-request failed: ${err && err.message ? err.message : err}`,
          );
        },
      );
    },
    onDebugBundleSave(clientId, msg) {
      return Promise.resolve(handleDebugBundleSave({
        gatesOn: () => externalDebugToolsEnabled && allowDebugUpload,
        cacheGet: (id) => bundleCache.get(id),
        saveBundle: (a) => saveBundleToDisk({ ...a, saveDir: resolveSaveDir(), fs, path }),
        now: () => Date.now(),
        send: (id, frame) => { if (server) server.unicast(id, JSON.stringify(frame)); },
        emit: (event, data) => emitDebug("relay.operation", event, "debug", {}, () => data),
      }, clientId, msg)).catch((err) => {
        logger.error(`[relay] debug-bundle-save failed: ${err && err.message ? err.message : err}`);
      });
    },
    onDebugBundleFetch(clientId, msg) {
      return Promise.resolve(handleDebugBundleFetch({
        gatesOn: () => externalDebugToolsEnabled && allowDebugUpload,
        cacheGet: (id) => bundleCache.get(id),
        chunkBytes: 64000,
        send: (id, frame) => { if (server) server.unicast(id, JSON.stringify(frame)); },
        emit: (event, data) => emitDebug("relay.operation", event, "debug", {}, () => data),
      }, clientId, msg)).catch((err) => {
        logger.error(`[relay] debug-bundle-fetch failed: ${err && err.message ? err.message : err}`);
      });
    },
    operationRegistry: relayOperationRegistry,

    onSimulate(sender, text) {
      emitDebug(
        "relay.protocol",
        "simulate",
        "debug",
        { sessionKey: sessionService.ensureSessionKey() },
        () => ({
          sender: sender || "Simulator",
          textChars: typeof text === "string" ? text.length : 0,
        }),
      );

      conversationState.addMessage("assistant", [{ type: "text", text }], sender || "Simulator");

      const pages = conversationState.getPages();
      cachePages(pages);
      return pages;
    },

    onSimulateStream(request) {
      const sessionKey = request.sessionKey || sessionService.ensureSessionKey();
      const sender = (
        request.sender ||
        (upstreamRuntime ? upstreamRuntime.getAgentName() : null) ||
        "Simulator"
      ).trim();
      const text = typeof request.text === "string" ? request.text : "";
      const chunkChars = Math.min(
        200,
        Math.max(1, request.chunkChars || 16),
      );
      const chunkIntervalMs = Math.min(
        5000,
        Math.max(10, request.chunkIntervalMs || 45),
      );
      const startDelayMs = Math.min(
        5000,
        Math.max(0, request.startDelayMs || 80),
      );
      const thinkingTailMs = Math.min(
        10000,
        Math.max(0, request.thinkingTailMs || 900),
      );
      const runId = `sim-${Date.now()}-${++simulateStreamRunSeq}`;
      const chunkCount = Math.max(1, Math.ceil(text.length / chunkChars));
      const streamPrefix = `${sender}: `;

      emitDebug(
        "relay.protocol",
        "simulate_stream_start",
        "info",
        { sessionKey, runId },
        () => ({
          messageId: request.id || null,
          sender,
          textChars: text.length,
          chunkChars,
          chunkIntervalMs,
          startDelayMs,
          thinkingTailMs,
          chunkCount,
        }),
      );

      broadcastActivity({
        state: "thinking",
        sessionKey,
        runId,
        origin: "simulate",
        phase: "start",
      });

      for (let index = 0; index < chunkCount; index += 1) {
        const visibleChars = Math.min(text.length, (index + 1) * chunkChars);
        const delayMs = startDelayMs + (index * chunkIntervalMs);
        scheduleSimulateStreamTimer(delayMs, () => {
          const streamedText = `${streamPrefix}${text.slice(0, visibleChars)}`;
          server.broadcast(handler.formatStreaming(streamedText));
          emitDebug(
            "relay.protocol",
            "simulate_stream_chunk",
            "debug",
            { sessionKey, runId },
            () => ({
              chunkIndex: index + 1,
              chunkCount,
              visibleChars,
              totalChars: text.length,
            }),
          );
        }, sessionKey);
      }

      const completeDelayMs = startDelayMs + (chunkCount * chunkIntervalMs) + thinkingTailMs;
      scheduleSimulateStreamTimer(completeDelayMs, () => {
        conversationState.addMessage(
          "assistant",
          [{ type: "text", text }],
          sender,
        );
        broadcastPages();
        broadcastActivity({
          state: "idle",
          sessionKey,
          runId,
          origin: "simulate",
          phase: "complete",
        });
        emitDebug(
          "relay.protocol",
          "simulate_stream_complete",
          "info",
          { sessionKey, runId },
          () => ({
            messageId: request.id || null,
            textChars: text.length,
            chunkCount,
            thinkingTailMs,
            completeDelayMs,
          }),
        );
      }, sessionKey);

      return Promise.resolve({
        status: "accepted",
        runId,
      });
    },

    onNewChat() {
      emitDebug(
        "relay.session",
        "new_chat",
        "info",
        { sessionKey: sessionService.ensureSessionKey() },
        () => ({}),
      );
      if (upstreamRuntime && typeof upstreamRuntime.clearTyping === "function") {
        upstreamRuntime.clearTyping("new_chat");
      }
      sessionService.invalidateSessionsCache();
      resetActivityStatusAdapter();

      clearSimulateStreamTimersForSession(sessionService.ensureSessionKey());
      conversationState.clear();

      const newChatSessionKey = sessionService.ensureSessionKey();
      stablePromptSnapshots.evict(newChatSessionKey);
      sessionService.clearLogicalSessionState(newChatSessionKey);
      conversationState.setAgentName(
        (upstreamRuntime ? upstreamRuntime.getAgentName() : null) || "Agent",
      );
      const pages = conversationState.getPages();
      cachePages(pages);
      if (upstreamRuntime && upstreamRuntime.isConnected()) {

        gatewayBridge.sendMessage("/new", "main").catch((err) => {
          logger.error(`[relay] Failed to send /new: ${err.message}`);
        });
      }
      return Promise.resolve(pages);
    },

    onGetSessions() {
      return sessionService.getSessions();
    },

    onSwitchSession(sessionKey) {
      return sessionService.switchToSession(sessionKey).then((pages) => {
        clearCurrentSessionModelConfigSnapshot("switch_session");
        if (upstreamRuntime && typeof upstreamRuntime.clearTyping === "function") {
          upstreamRuntime.clearTyping("switch_session");
        }
        if (upstreamRuntime && typeof upstreamRuntime.handleSessionChanged === "function") {
          upstreamRuntime.handleSessionChanged("switch_session");
        }
        return pages;
      });
    },

    async onNewSession() {

      clearSimulateStreamTimersForSession(sessionService.ensureSessionKey());
      const result = await sessionService.newSession();

      if (result && typeof result.sessionKey === "string" && result.sessionKey.trim()) {
        stablePromptSnapshots.evict(result.sessionKey);
        sessionService.clearDisplayToggleStates(result.sessionKey);
      }
      clearCurrentSessionModelConfigSnapshot("new_session");
      if (upstreamRuntime && typeof upstreamRuntime.clearTyping === "function") {
        upstreamRuntime.clearTyping("new_session");
      }
      if (upstreamRuntime && typeof upstreamRuntime.handleSessionChanged === "function") {
        upstreamRuntime.handleSessionChanged("new_session");
      }
      const sessionModelConfig = await seedOcuClawSessionConfigForNewSession(
        result && result.sessionKey,
      );
      return sessionModelConfig
        ? {
            ...result,
            sessionModelConfig,
          }
        : result;
    },

    onGetModelsCatalog() {
      return upstreamRuntime
        ? upstreamRuntime.getModelsCatalogSnapshot()
        : Promise.resolve({ models: [], fetchedAtMs: Date.now(), stale: true });
    },

    onGetSkillsCatalog() {
      return upstreamRuntime
        ? upstreamRuntime.getSkillsCatalogSnapshot()
        : Promise.resolve({ skills: [], fetchedAtMs: Date.now(), stale: true });
    },

    onGetAgentsCatalog() {
      return upstreamRuntime
        ? upstreamRuntime.getAgentsCatalogSnapshot()
        : Promise.resolve({
            agents: [],
            defaultId: null,
            mainKey: null,
            scope: null,
            fetchedAtMs: Date.now(),
            stale: true,
            unsupported: true,
          });
    },

    onGetProviderUsageSnapshot() {
      return upstreamRuntime
        ? upstreamRuntime.getProviderUsageSnapshot()
        : Promise.resolve({
            sessionKey: null,
            provider: null,
            displayName: null,
            limitingWindowKey: null,
            windows: [],
            fetchedAtMs: Date.now(),
            stale: true,
          });
    },

    onGetSonioxModels() {
      return getSonioxModelsSnapshot();
    },

    onGetStatus() {
      return buildStatusObject({ includeDownstreamReadiness: true });
    },

    onGetSessionModelConfig() {
      return sessionService.getCurrentSessionModelConfig();
    },

    async onSetSessionModelConfig(patch) {
      const result = await sessionService.setCurrentSessionModelConfig(patch || {});
      if (
        result &&
        result.status === "accepted" &&
        result.config &&
        isActiveSessionModelConfig(result.config)
      ) {
        currentSessionModelConfigSnapshot = result.config;
        server.broadcast(handler.formatSessionModelConfig(result.config));
      }
      return result;
    },

    onSetSessionAgent(patch) {
      const sessionKey = sessionService.ensureSessionKey();
      const result = sessionService.setSessionAgentId(
        sessionKey,
        (patch && patch.agentId) || "",
      );
      if (!result || result.ok !== true) {
        return {
          status: "rejected",
          error: (result && result.reason) || "invalid session agent",
        };
      }

      if (typeof sessionService.primeSessionModelConfig === "function") {
        const config = sessionService.primeSessionModelConfig(sessionKey, {});
        if (config && isActiveSessionModelConfig(config)) {
          currentSessionModelConfigSnapshot = config;
          if (server) {
            server.broadcast(handler.formatSessionModelConfig(config));
          }
        }
      }
      broadcastSessions();
      return { status: "accepted" };
    },

    onGetEvenAiSettings() {
      return evenAiSettingsStore.getSnapshot();
    },

    onGetOcuClawSettings() {
      return ocuClawSettingsStore.getSnapshot();
    },

    async onGetEvenAiSessions() {
      return buildEvenAiSessionsSnapshot();
    },

    async onSetEvenAiSettings(patch) {
      const result = await evenAiSettingsStore.setSettings(patch || {});
      if (result && result.status === "accepted" && result.settings && server) {
        server.broadcast(handler.formatEvenAiSettings(result.settings));
      }
      return result;
    },

    async onSetOcuClawSettings(patch) {
      const result = await ocuClawSettingsStore.setSettings(patch || {});
      if (result && result.status === "accepted" && result.settings && server) {
        server.broadcast(handler.formatOcuClawSettings(result.settings));
      }
      return result;
    },

    onSlashCommand(command) {
      emitDebug(
        "relay.protocol",
        "slash_command",
        "debug",
        { sessionKey: sessionService.ensureSessionKey() },
        () => ({ command }),
      );
      if (command === "/reset") {
        sessionService.invalidateSessionsCache();
        resetActivityStatusAdapter();
        clearSimulateStreamTimersForSession(sessionService.ensureSessionKey());
        conversationState.clear();
        if (upstreamRuntime && typeof upstreamRuntime.clearTyping === "function") {
          upstreamRuntime.clearTyping("slash_reset");
        }
        conversationState.setAgentName(
          (upstreamRuntime ? upstreamRuntime.getAgentName() : null) || "Agent",
        );
        broadcastPages();
      }

      if (command === "/new" || command === "/reset") {
        const resetKey = sessionService.ensureSessionKey();
        stablePromptSnapshots.evict(resetKey);

        sessionService.clearLogicalSessionState(resetKey);
      }
      if (upstreamRuntime && upstreamRuntime.isConnected()) {

        const outboundCommand =
          command === "/reset"
            ? `/reset ${NEW_SESSION_GREETING_PROMPT}`
            : command;
        return gatewayBridge.sendMessage(
          outboundCommand,
          sessionService.ensureSessionKey(),
        );
      }
      return Promise.resolve();
    },

    isUpstreamConnected() {
      return true;
    },

    onConsoleLog(level, message) {
      writeConsoleLog(level, message);
      if (level === "event") {
        emitDebug(
          "sdk.events",
          "event_debug",
          "debug",
          { sessionKey: sessionService.ensureSessionKey() },
          () => ({
            level,
            message,
          }),
        );
      }
    },

    onEventDebug(clientId, payload) {
      if (!payload || typeof payload !== "object") return;
      const cat = payload.cat;
      const forceStore = isForcedReadinessProofEvent(payload);
      if (!forceStore && !debugStore.isEnabled(cat)) return;
      emitDebug(
        cat,
        payload.event,
        payload.severity || "debug",
        {
          sessionKey: payload.sessionKey || sessionService.ensureSessionKey(),
          runId: payload.runId || null,
          screen: payload.screen || null,
        },
        () => ({
          clientId,
          ...(payload.data || {}),
        }),
        { force: forceStore },
      );
    },

    onApprovalResolve(id, decision) {
      return gatewayBridge.resolveApproval(id, decision);
    },

    onRequestSonioxTemporaryKey(clientId, request) {
      return mintSonioxTemporaryKey(clientId, request);
    },

    onRequestCartesiaAccessToken(clientId, request) {
      return mintCartesiaAccessToken(clientId, request);
    },

    onDebugSet(clientId, request) {
      return applyDebugSet(clientId, request);
    },

    onTraceLogSet(clientId, request) {
      return applyTraceLogSet(clientId, request);
    },
    onTraceLogGet() {
      return { ok: true, enabled: liveUiTraceLogEnabled, persistedPath: liveUiTraceFlagPath };
    },

    onDebugDump(clientId, request) {
      const result = debugStore.dump(request);
      if (!result.ok) {
        throw new Error(result.error || "debug-dump failed");
      }

      emitDebug(
        "relay.protocol",
        "debug_dump",
        "debug",
        { sessionKey: sessionService.ensureSessionKey() },
        () => ({
          clientId,
          categories: result.categories,
          redaction: result.redaction,
          limit: result.limit,
          returned: result.returned,
          totalMatched: result.totalMatched,
        }),
      );

      return result;
    },

    onRemoteControl(clientId, request) {
      const now = Date.now();
      const requestId =
        (typeof request.requestId === "string" && request.requestId.trim()) ||
        `rc-${now}-${Math.random().toString(16).slice(2, 8)}`;
      const isDebugCloseAppClientAction =
        request &&
        request.action === "relay-action" &&
        request.relayAction === "debug-close-app-client";
      const recipientEstimate = server ? server.getConnectedAppCount(clientId) : 0;

      emitDebug(
        "relay.protocol",
        "remote_control_requested",
        "info",
        { sessionKey: sessionService.ensureSessionKey() },
        () => ({
          clientId,
          requestId,
          action: request.action || "unknown",
          recipientEstimate,
        }),
      );

      if (recipientEstimate <= 0) {
        return {
          ok: false,
          requestId,
          message: "No downstream app clients connected",
          detail: { recipientEstimate },
        };
      }

      if (isDebugCloseAppClientAction) {
        if (!server || typeof server.closeConnectedAppClients !== "function") {
          return {
            ok: false,
            requestId,
            message: "Downstream close hook unavailable",
            detail: { recipientEstimate },
          };
        }
        const closeResult = server.closeConnectedAppClients({
          excludeClientId: clientId,
          reason: "debug_close_app_client",
        });
        emitDebug(
          "relay.protocol",
          "remote_control_server_action_applied",
          "warn",
          { sessionKey: sessionService.ensureSessionKey() },
          () => ({
            clientId,
            requestId,
            action: request.action || "unknown",
            relayAction: request.relayAction || null,
            recipientEstimate,
            closedCount: closeResult.closedCount,
            closedClientIds: closeResult.closedClientIds,
            reason: closeResult.reason,
          }),
        );
        return {
          ok: closeResult.closedCount > 0,
          requestId,
          message:
            closeResult.closedCount > 0
              ? `Closed ${closeResult.closedCount} app client(s)`
              : "No downstream app clients connected",
          detail: {
            recipientEstimate,
            closedCount: closeResult.closedCount,
            closedClientIds: closeResult.closedClientIds,
            reason: closeResult.reason,
          },
        };
      }

      const control = {
        ...request,
        requestId,
        issuedAtMs: now,
        issuedByClientId: clientId,
      };

      emitDebug(
        "relay.protocol",
        "remote_control_dispatched",
        "info",
        { sessionKey: sessionService.ensureSessionKey() },
        () => ({
          clientId,
          requestId,
          action: control.action || "unknown",
          recipientEstimate,
        }),
      );

      return {
        ok: true,
        requestId,
        message: `Dispatched to ${recipientEstimate} client(s)`,
        detail: { recipientEstimate },
        control,
      };
    },

    onReadinessProbe(clientId, request) {
      const now = Date.now();
      const requestId =
        (typeof request.requestId === "string" && request.requestId.trim()) ||
        `readiness-${now}-${Math.random().toString(16).slice(2, 8)}`;
      const sinceMs = Number.isFinite(Number(request && request.sinceMs))
        ? Math.max(0, Math.floor(Number(request.sinceMs)))
        : now;
      const snapshot =
        server && typeof server.getReadinessSnapshot === "function"
          ? server.getReadinessSnapshot()
          : {
              connectedClientCount: 0,
              fanoutRecipientCount: 0,
              clients: [],
            };
      const targetClientId =
        snapshot &&
        snapshot.connectedClientCount === 1 &&
        snapshot.fanoutRecipientCount === 1 &&
        Array.isArray(snapshot.clients) &&
        snapshot.clients.length === 1 &&
        typeof snapshot.clients[0].clientId === "string"
          ? snapshot.clients[0].clientId
          : null;

      emitDebug(
        "relay.protocol",
        "readiness_probe_requested",
        "info",
        { sessionKey: sessionService.ensureSessionKey() },
        () => ({
          clientId,
          requestId,
          sinceMs,
          requestedSessionKey:
            typeof request.sessionKey === "string" && request.sessionKey.trim()
              ? request.sessionKey.trim()
              : null,
          connectedClientCount:
            snapshot && Number.isFinite(snapshot.connectedClientCount)
              ? snapshot.connectedClientCount
              : 0,
          fanoutRecipientCount:
            snapshot && Number.isFinite(snapshot.fanoutRecipientCount)
              ? snapshot.fanoutRecipientCount
              : 0,
        }),
      );

      if (
        !snapshot ||
        snapshot.connectedClientCount <= 0 ||
        snapshot.fanoutRecipientCount <= 0
      ) {
        return {
          ok: false,
          requestId,
          reasonCode: "no_downstream_client",
          message: "No downstream app clients connected",
        };
      }

      if (
        snapshot.connectedClientCount > 1 ||
        snapshot.fanoutRecipientCount > 1 ||
        !targetClientId
      ) {
        return {
          ok: false,
          requestId,
          reasonCode: "multi_recipient_fanout",
          message: "Multiple downstream app clients connected",
        };
      }

      emitDebug(
        "relay.protocol",
        "readiness_probe_dispatched",
        "info",
        { sessionKey: sessionService.ensureSessionKey() },
        () => ({
          clientId,
          requestId,
          targetClientId,
          sinceMs,
        }),
      );

      return {
        ok: true,
        requestId,
        targetClientId,
        probe: {
          requestId,
          sinceMs,
          sessionKey:
            typeof request.sessionKey === "string" && request.sessionKey.trim()
              ? request.sessionKey.trim()
              : null,
        },
      };
    },

    onAutomationState(clientId, request) {

      const now = Date.now();
      const requestId =
        (typeof request.requestId === "string" && request.requestId.trim()) ||
        `automation-${now}-${Math.random().toString(16).slice(2, 8)}`;
      const requestedSessionKey =
        typeof request.sessionKey === "string" && request.sessionKey.trim()
          ? request.sessionKey.trim()
          : null;
      const snapshot =
        server && typeof server.getReadinessSnapshot === "function"
          ? server.getReadinessSnapshot()
          : {
              connectedClientCount: 0,
              fanoutRecipientCount: 0,
              clients: [],
            };
      const targetEntry =
        snapshot &&
        snapshot.connectedClientCount === 1 &&
        snapshot.fanoutRecipientCount === 1 &&
        Array.isArray(snapshot.clients) &&
        snapshot.clients.length === 1
          ? snapshot.clients[0]
          : null;
      const targetClientId =
        targetEntry && typeof targetEntry.clientId === "string"
          ? targetEntry.clientId
          : null;

      const readinessPublished =
        !!(
          targetEntry &&
          targetEntry.readinessSnapshot &&
          Number.isFinite(targetEntry.readinessSnapshot.emittedAtMs)
        );

      emitDebug(
        "relay.protocol",
        "automation_state_requested",
        "info",
        { sessionKey: sessionService.ensureSessionKey() },
        () => ({
          clientId,
          requestId,
          requestedSessionKey,
          connectedClientCount:
            snapshot && Number.isFinite(snapshot.connectedClientCount)
              ? snapshot.connectedClientCount
              : 0,
          fanoutRecipientCount:
            snapshot && Number.isFinite(snapshot.fanoutRecipientCount)
              ? snapshot.fanoutRecipientCount
              : 0,
        }),
      );

      if (
        !snapshot ||
        snapshot.connectedClientCount <= 0 ||
        snapshot.fanoutRecipientCount <= 0
      ) {
        return {
          ok: false,
          requestId,
          reasonCode: "no_downstream_client",
          message: "No downstream app clients connected",
        };
      }

      if (
        snapshot.connectedClientCount > 1 ||
        snapshot.fanoutRecipientCount > 1 ||
        !targetClientId
      ) {
        return {
          ok: false,
          requestId,
          reasonCode: "multi_recipient_fanout",
          message: "Multiple downstream app clients connected",
        };
      }

      if (!readinessPublished) {
        return {
          ok: false,
          requestId,
          reasonCode: "snapshot_unavailable",
          message: "Automation state snapshot is unavailable",
        };
      }

      emitDebug(
        "relay.protocol",
        "automation_state_dispatched",
        "info",
        { sessionKey: sessionService.ensureSessionKey() },
        () => ({
          clientId,
          requestId,
          targetClientId,
        }),
      );

      return {
        ok: true,
        requestId,
        targetClientId,
        request: {
          requestId,
          sessionKey: requestedSessionKey,
        },
      };
    },
  });

  const pluginVersionService = createPluginVersionService();

  const glassesBackpressureLatch = createGlassesBackpressureLatch({
    emitDebug: (event, severity, data) =>
      emitDebug("relay.health", event, severity, null, () => data || {}),
  });

  server = createRelayWorkerSupervisor({
    pluginId: "ocuclaw",
    getPluginVersion: () => pluginVersionService.getPluginVersion(),
    getRequiresClientVersion: () => pluginVersionService.getRequiresClientVersion(),
    logger,
    handler,
    operationRegistry: relayOperationRegistry,
    host: opts.host,
    port: opts.port,
    token: opts.token,
    onWorkerBackpressure: (message) => glassesBackpressureLatch.report(message),
    externalDebugToolsEnabled,
    evenAiRequestTimeoutMs: opts.evenAiRequestTimeoutMs,
    evenAiMaxBodyBytes: opts.evenAiMaxBodyBytes,
    evenAiMaxResponseBytes: opts.evenAiMaxResponseBytes,
    getCurrentPages() {
      return cachedPages;
    },
    getCurrentStatus() {
      return cachedStatus;
    },
    getCurrentDebugConfig() {
      return handler.formatDebugConfigSnapshot(debugStore.getSnapshot());
    },
    getCurrentResumeState() {
      return {
        pagesRevision: pagesRevision || 0,
        statusRevision: statusRevision || 0,
      };
    },
    getAgentAvatarHash: () =>
      upstreamRuntime && typeof upstreamRuntime.getAgentAvatarHash === "function"
        ? upstreamRuntime.getAgentAvatarHash()
        : null,
    getAgentAvatarDataUriByHash: (hash) =>
      upstreamRuntime && typeof upstreamRuntime.getAgentAvatarDataUriByHash === "function"
        ? upstreamRuntime.getAgentAvatarDataUriByHash(hash)
        : null,
    handleBufferedEvenAiHttpRequest(envelope) {
      return handleBufferedEvenAiHttpRequest(envelope);
    },
    cancelBufferedEvenAiHttpRequest(envelope) {
      return cancelBufferedEvenAiHttpRequest(envelope);
    },
    getActiveSessionKey() {
      return sessionService.peekSessionKey() || null;
    },
    onAppClientDisconnect(sessionKey) {
      dispatchAppClientDisconnect(sessionKey);
    },
    emitDebug(category, event, severity, context, payloadFactory, options) {
      emitDebug(category, event, severity, context, payloadFactory, options);
    },
  });

  function buildStatusObject(options = {}) {
    const includeDownstreamReadiness = options.includeDownstreamReadiness === true;
    const status = {
      openclaw:
        upstreamRuntime && upstreamRuntime.isConnected()
          ? "connected"
          : "disconnected",
      agent: upstreamRuntime ? upstreamRuntime.getAgentName() : null,
      agentEmoji: upstreamRuntime ? upstreamRuntime.getAgentEmoji() : null,
      agentAvatarHash: upstreamRuntime ? upstreamRuntime.getAgentAvatarHash() : null,
      session: sessionService.ensureSessionKey(),
      evenAiEnabled: opts.evenAiEnabled === true,
    };
    if (includeDownstreamReadiness) {
      status.downstreamReadiness =
        server && typeof server.getReadinessSnapshot === "function"
          ? server.getReadinessSnapshot()
          : {
              connectedClientCount: 0,
              fanoutRecipientCount: 0,
              updatedAtMs: null,
              clients: [],
            };
    }
    return status;
  }

  function cachePages(pages) {
    const nextRevision = pagesRevision + 1;
    const next = handler.formatPages(pages, { revision: nextRevision });
    if (next !== cachedPages) {
      cachedPages = next;
      pagesRevision = nextRevision;
    }
    return cachedPages;
  }

  function cacheStatus(statusObj) {
    const nextRevision = statusRevision + 1;
    const next = handler.formatStatus(statusObj, { revision: nextRevision });
    if (next !== cachedStatus) {
      cachedStatus = next;
      statusRevision = nextRevision;
    }
    return cachedStatus;
  }

  function broadcastPages() {
    const pages = conversationState.getPages();
    const next = cachePages(pages);
    if (next !== null) {
      server.broadcast(next);
    }
  }

  function broadcastSessions() {
    sessionService
      .getSessions()
      .then((sessions) => {
        server.broadcast(handler.formatSessions(sessions));
      })
      .catch((err) => {
        emitDebug(
          "relay.session",
          "session_broadcast_failed",
          "debug",
          { sessionKey: sessionService.peekSessionKey() || undefined },
          () => ({ message: err && err.message ? err.message : String(err) }),
        );
      });
  }

  async function buildEvenAiSessionsSnapshot() {
    const dedicatedKey =
      evenAiRouter && typeof evenAiRouter.getDedicatedSessionKey === "function"
        ? evenAiRouter.getDedicatedSessionKey()
        : opts.evenAiDedicatedSessionKey;
    const dedicatedEvenAiKey = normalizeEvenAiSessionKeyForLookup(dedicatedKey);
    const trackedThrowawayKeys =
      typeof evenAiSettingsStore.getTrackedThrowawayKeys === "function"
        ? evenAiSettingsStore.getTrackedThrowawayKeys()
        : [];
    const normalizedTrackedThrowawayKeys = dedupeNormalizedSessionKeys(
      trackedThrowawayKeys,
    );
    const resolvedSessions = await sessionService.getSessionsByExactKeys([
      ...normalizedTrackedThrowawayKeys,
      ...(dedicatedEvenAiKey ? [dedicatedEvenAiKey] : []),
    ]);
    const normalizedDedicatedKey = dedicatedEvenAiKey.toLowerCase();
    const sessions = [];
    let dedicatedIncluded = false;
    for (const session of resolvedSessions) {
      if (
        !dedicatedIncluded &&
        session &&
        typeof session.key === "string" &&
        session.key.trim().toLowerCase() === normalizedDedicatedKey
      ) {
        sessions.push(session);
        dedicatedIncluded = true;
        continue;
      }
      sessions.push(session);
    }
    if (!dedicatedIncluded && dedicatedEvenAiKey) {
      sessions.unshift({
        key: dedicatedEvenAiKey,
        updatedAt: 0,
        preview: "",
        firstUserMessage: "",
      });
    }
    return { sessions, dedicatedKey };
  }

  function broadcastEvenAiSessions() {
    if (!server) return;
    buildEvenAiSessionsSnapshot()
      .then((payload) => {
        server.broadcast(handler.formatEvenAiSessions(payload));
      })
      .catch((err) => {
        emitDebug(
          "relay.session",
          "session_broadcast_failed",
          "debug",
          { sessionKey: sessionService.peekSessionKey() || undefined },
          () => ({
            kind: "evenai",
            message: err && err.message ? err.message : String(err),
          }),
        );
      });
  }

  function broadcastStatus() {
    const next = cacheStatus(buildStatusObject());
    if (next !== null) {
      server.broadcast(next);
    }
    if (server && typeof server.notifyAgentAvatarChanged === "function") {
      const hash =
        upstreamRuntime && typeof upstreamRuntime.getAgentAvatarHash === "function"
          ? upstreamRuntime.getAgentAvatarHash()
          : null;
      const dataUri =
        hash &&
        upstreamRuntime &&
        typeof upstreamRuntime.getAgentAvatarDataUriByHash === "function"
          ? upstreamRuntime.getAgentAvatarDataUriByHash(hash)
          : null;
      server.notifyAgentAvatarChanged(hash, dataUri);
    }
  }

  upstreamRuntime = createUpstreamRuntime({
    logger,
    stateDir: opts.stateDir,
    gatewayBridge,
    conversationState,
    sessionService,
    handler,
    emitDebug,
    broadcastPages,
    broadcastStatus,
    broadcastActivity,
    broadcastProviderUsageSnapshot,
    broadcastAgentsCatalog,
    operationRegistry: relayOperationRegistry,
    getCurrentSessionModelConfigSnapshot() {
      return currentSessionModelConfigSnapshot;
    },
    resetActivityStatusAdapter,
    modelsCacheTtlMs: opts.modelsCacheTtlMs,
    getServer() {
      return server;
    },
    getVoiceRuntime() {
      return null;
    },
    gatewayUrl: opts.gatewayUrl,
    gatewayToken: opts.gatewayToken,
    fetchAgentAvatar: opts.fetchAgentAvatar,
  });

  async function shouldSeedSessionScopedDefaultForRoute(route) {
    const routingMode =
      route && typeof route.routingMode === "string"
        ? route.routingMode.trim().toLowerCase()
        : "active";
    const sessionKey =
      route && typeof route.sessionKey === "string" ? route.sessionKey.trim() : "";
    if (!sessionKey || routingMode === "active") {
      return false;
    }
    if (routingMode === "background_new") {
      return true;
    }
    if (routingMode !== "background") {
      return false;
    }
    try {
      const existingSessions = await sessionService.getSessionsByExactKeys([sessionKey]);
      return existingSessions.length === 0;
    } catch {
      return false;
    }
  }

  if (opts.evenAiEnabled === true) {
    evenAiRouter = createEvenAiRouter({
      sessionService,
      getRoutingMode() {
        return evenAiSettingsStore.getSnapshot().routingMode;
      },
      dedicatedSessionKey: opts.evenAiDedicatedSessionKey,
    });
    evenAiRunWaiter = createEvenAiRunWaiter({
      gatewayBridge,
      logger,
      emitDebug,
    });
    evenAiEndpoint = createEvenAiEndpoint({
      logger,
      httpServer: sharedHttpServer,
      enabled: true,
      externallyRouted: true,
      token: opts.evenAiToken,
      getSettingsSnapshot() {
        return evenAiSettingsStore.getSnapshot();
      },
      getSystemPrompt() {
        return evenAiSettingsStore.getSnapshot().systemPrompt;
      },
      requestTimeoutMs: opts.evenAiRequestTimeoutMs,
      maxBodyBytes: opts.evenAiMaxBodyBytes,
      dedupWindowMs: opts.evenAiDedupWindowMs,
      gatewayBridge,
      router: evenAiRouter,
      runWaiter: evenAiRunWaiter,
      emitDebug,
      dispatchOcuClawUserSend(params) {
        return dispatchOcuClawUserSend(params);
      },
      emitListenInterceptRecovery(params) {
        return emitListenInterceptRecovery(params);
      },
      emitListenInterceptBroadcast(params) {
        return emitListenInterceptBroadcast(params);
      },
      hasConnectedAppClient() {
        return server ? server.getConnectedAppCount() > 0 : false;
      },
      recordFirstSentUserMessage(sessionKey, text) {
        sessionService.recordFirstSentUserMessage(sessionKey, text);
      },
      onSessionRouted(route) {
        if (!route || route.routingMode !== "background_new") {
          return;
        }
        if (
          typeof evenAiSettingsStore.recordTrackedThrowawayKey === "function" &&
          typeof route.sessionKey === "string"
        ) {
          evenAiSettingsStore.recordTrackedThrowawayKey(route.sessionKey);
        }
      },
      async shouldSeedThinkingForRoute(params) {
        const route = params && params.route ? params.route : params;
        const thinkingLevel =
          params && typeof params.thinkingLevel === "string"
            ? params.thinkingLevel.trim().toLowerCase()
            : "";
        if (!thinkingLevel) {
          return false;
        }
        return shouldSeedSessionScopedDefaultForRoute(route);
      },
      async seedFastModeForRoute(params) {
        const route = params && params.route ? params.route : params;
        const settings = evenAiSettingsStore.getSnapshot();
        if (!settings || settings.defaultFastMode !== true) {
          return false;
        }
        if (!(await shouldSeedSessionScopedDefaultForRoute(route))) {
          return false;
        }
        const result = await sessionService.setSessionModelConfig(
          route.sessionKey.trim(),
          { fastMode: true },
        );
        return !!(result && result.status === "accepted");
      },
      resolveAgentForRoute(params) {
        const route = params && params.route ? params.route : params;
        const routingMode =
          (route && typeof route.routingMode === "string"
            ? route.routingMode.trim().toLowerCase()
            : "") || "active";
        const sessionKey =
          route && typeof route.sessionKey === "string"
            ? route.sessionKey.trim()
            : "";

        if (routingMode === "active") {
          return sessionKey ? sessionService.getSessionAgentId(sessionKey) : "";
        }
        const evenAiDefault = normalizeEvenAiDefaultAgent(
          evenAiSettingsStore.getSnapshot().defaultAgent,
        );
        if (sessionKey && evenAiDefault) {

          sessionService.setSessionAgentId(sessionKey, evenAiDefault);
        }
        return evenAiDefault;
      },
      onSessionActivated(route) {
        if (!route || !route.sessionChanged) {
          return;
        }
        server.broadcast(handler.formatSessionSwitched(route.sessionKey));
        if (cachedPages !== null) {
          server.broadcast(cachedPages);
        }
      },
      isUpstreamConnected() {
        return upstreamRuntime ? upstreamRuntime.isConnected() : false;
      },
    });
  }

  async function handleBufferedEvenAiHttpRequest(envelope) {
    if (!evenAiEndpoint || typeof evenAiEndpoint.handleRequest !== "function") {
      return {
        statusCode: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
        body: Buffer.from("not found"),
      };
    }
    const req = createBufferedHttpRequest(envelope);
    const res = createBufferedHttpResponse(opts.evenAiMaxResponseBytes || 262_144);
    const requestId =
      envelope && typeof envelope.requestId === "string" ? envelope.requestId : null;
    if (requestId) {
      pendingBufferedEvenAiResponses.set(requestId, { req, res });
    }
    try {
      await Promise.resolve(evenAiEndpoint.handleRequest(req, res));
      if (!res.writableEnded) {
        res.statusCode = 404;
        res.setHeader("content-type", "text/plain; charset=utf-8");
        res.end("not found");
      }
      return res.toResult();
    } finally {
      if (requestId) {
        pendingBufferedEvenAiResponses.delete(requestId);
      }
    }
  }

  function cancelBufferedEvenAiHttpRequest(envelope) {
    const requestId =
      envelope && typeof envelope.requestId === "string" ? envelope.requestId : null;
    if (!requestId) {
      return false;
    }
    const pending = pendingBufferedEvenAiResponses.get(requestId);
    if (!pending) {
      return false;
    }
    pending.res.emit("close");
    pending.req.emit("close");
    return true;
  }

  relayApi = {

    emitGlassesUiLifecycle(event, severity, data) {
      emitDebug("glasses.lifecycle", event, severity, {}, () => data || {});
    },

    start() {

      if (!bundleCacheSweepTimer) {
        bundleCacheSweepTimer = setInterval(() => bundleCache.sweep(), 60_000);
        if (typeof bundleCacheSweepTimer.unref === "function") bundleCacheSweepTimer.unref();
      }

      if (!stablePromptSweepTimer) {
        stablePromptSweepTimer = setInterval(
          () => stablePromptSnapshots.sweep(),
          60 * 60 * 1000,
        );
        if (typeof stablePromptSweepTimer.unref === "function") {
          stablePromptSweepTimer.unref();
        }
      }

      if (!uploadCaptureArmingDisposer) {
        uploadCaptureArmingDisposer = startUploadCaptureArming({
          gatesOn: () => externalDebugToolsEnabled && allowDebugUpload,
          armCategories: (cats, ttlMs) =>
            applyDebugSet("upload-capture-arming", { enable: cats, ttlMs }),
          maxTtlMs: debugStore.getConfig().maxTtlMs,

          preset: opts.debugUploadCapturePreset,
          onArmError: (err) =>
            logger.warn(
              `[relay] upload-capture arming failed (preset override?): ${err && err.message}`,
            ),
          setInterval,
          clearInterval,
        });
      }
      const startGateway = () => Promise.resolve(gatewayBridge.start()).then(() => {
        prefetchSonioxModels("relay_start").catch((err) => {
          logger.warn(`[relay] Soniox models prefetch failed: ${err.message}`);
        });
        if (upstreamRuntime && typeof upstreamRuntime.start === "function") {
          return upstreamRuntime.start();
        }
      });
      if (server && typeof server.start === "function") {
        return Promise.resolve(server.start()).then(startGateway);
      }
      return startGateway();
    },

    stop() {
      clearSimulateStreamTimers();
      if (bundleCacheSweepTimer) {
        clearInterval(bundleCacheSweepTimer);
        bundleCacheSweepTimer = null;
      }
      if (stablePromptSweepTimer) {
        clearInterval(stablePromptSweepTimer);
        stablePromptSweepTimer = null;
      }
      if (uploadCaptureArmingDisposer) {
        uploadCaptureArmingDisposer();
        uploadCaptureArmingDisposer = null;
      }
      if (evenAiEndpoint) {
        evenAiEndpoint.close();
      }
      if (evenAiRunWaiter) {
        evenAiRunWaiter.close();
      }
      if (upstreamRuntime) {
        upstreamRuntime.stop();
      }
      relayHealth.stop();
      gatewayBridge.stop();
      return Promise.all([
        sessionService.flushFirstSentUserMessageCache(),
        Promise.resolve(server.close()),
      ]).then(() => undefined);
    },

    handleEvenAiHttpRequest(req, res) {
      if (!evenAiEndpoint || typeof evenAiEndpoint.handleRequest !== "function") {
        return Promise.resolve(false);
      }
      return Promise.resolve(evenAiEndpoint.handleRequest(req, res));
    },

    handleBufferedEvenAiHttpRequest,

    get server() {
      return server;
    },

    get workerReadyForTest() {
      return server && server.readyPromise ? server.readyPromise : Promise.resolve();
    },

    get debugStoreForTest() {
      return debugStore;
    },

    get liveUiTraceLogEnabledForTest() {
      return liveUiTraceLogEnabled;
    },
    __onTraceLogSetForTest(clientId, request) {
      return applyTraceLogSet(clientId, request);
    },
    __onDebugSetForTest(clientId, request) {
      return applyDebugSet(clientId, request);
    },

    get operationRegistryForTest() {
      return relayOperationRegistry;
    },

    relayHealth,

    get httpServer() {
      return sharedHttpServer;
    },

    getEvenAiSettingsSnapshot() {
      return evenAiSettingsStore.getSnapshot();
    },

    getSessionTitle(sessionKey) {
      return sessionService.getSessionTitle(sessionKey);
    },

    hasRecordedUserMessage(sessionKey) {
      return sessionService.hasRecordedFirstUserMessage(sessionKey);
    },

    isNeuralSessionNamesEnabled(sessionKey) {
      return sessionService.isNeuralSessionNamesEnabled(sessionKey);
    },

    isSessionUserLocked(sessionKey) {
      return sessionService.isSessionUserLocked(sessionKey);
    },

    getDisplayStartStates(sessionKey) {
      return sessionService.getDisplayStartStates(sessionKey);
    },

    getDisplayCurrentStates(sessionKey) {
      return sessionService.getDisplayCurrentStates(sessionKey);
    },

    getSessionTitleRecord(sessionKey) {
      return sessionService.getSessionTitleRecord(sessionKey);
    },
    isEvenAiSessionKey(sessionKey) {
      return sessionService.isEvenAiSessionKey(sessionKey);
    },
    getRawMessages() {
      return conversationState.getRawMessages();
    },
    getDistillerBudget() {
      return sessionService.getDistillerBudget();
    },

    deleteDistillerSession(sessionKey) {
      return sessionService.deleteSessions("ocuclaw", [sessionKey]);
    },
    getStateDir() {
      return opts.stateDir;
    },
    emitDebug(...args) {
      return emitDebug(...args);
    },
    gatewayRequest(method, params, requestOpts) {
      return gatewayBridge.request(method, params, requestOpts);
    },
    onGatewayEvent(eventName, listener) {
      return gatewayBridge.on(eventName, listener);
    },

    peekSessionKey() {
      return sessionService.peekSessionKey();
    },

    flushFirstSentUserMessageCache() {
      return sessionService.flushFirstSentUserMessageCache();
    },

    recordNeuralSessionNamesEnabled(sessionKey, enabled) {
      sessionService.recordNeuralSessionNamesEnabled(sessionKey, enabled);
    },

    setSessionTitle(sessionKey, title, opts) {
      const result = sessionService.setSessionTitle(sessionKey, title, opts);
      if (result && result.ok) {
        broadcastSessions();
      }
      return result;
    },

    _dispatchOcuClawUserSend(params) {
      return dispatchOcuClawUserSend(params || {});
    },

    _clearLogicalSessionState(sessionKey) {
      sessionService.clearLogicalSessionState(sessionKey);
    },

    sendGlassesUiRender(params) {
      sendGlassesUiRender(params);
    },

    sendGlassesUiSurfaceUpdate(params) {
      sendGlassesUiSurfaceUpdate(params);
    },

    dispatchGlassesWake(params) {
      const sessionKey =
        params && typeof params.sessionKey === "string" && params.sessionKey
          ? params.sessionKey
          : sessionService.ensureSessionKey();
      const message = params && typeof params.message === "string" ? params.message : "";
      if (!message) {
        return Promise.reject(new Error("dispatchGlassesWake requires a message"));
      }
      const idempotencyKey =
        params && typeof params.idempotencyKey === "string" && params.idempotencyKey
          ? params.idempotencyKey
          : null;
      agentTurnTracker.markBusy(sessionKey);
      emitDebug(
        "relay.protocol",
        "glasses_wake_dispatch",
        "info",
        { sessionKey },
        () => ({
          idempotencyKey,
          messageChars: message.length,
        }),
      );
      const requestParams = { message, sessionKey };
      if (idempotencyKey) requestParams.idempotencyKey = idempotencyKey;
      return gatewayBridge.request("agent", requestParams, { expectFinal: false });
    },

    isAgentTurnBusy(sessionKey) {
      return agentTurnTracker.isBusy(sessionKey);
    },

    onGlassesUiResult(handler) {
      return onGlassesUiResult(handler);
    },

    onGlassesUiNavEvent(handler) {
      return onGlassesUiNavEvent(handler);
    },

    sendDeviceInfoRequest(params) {
      sendDeviceInfoRequest(params);
    },

    onDeviceInfoResponse(handler) {
      return onDeviceInfoResponse(handler);
    },

    hasConnectedAppClient() {
      return server ? server.getConnectedAppCount() > 0 : false;
    },

    isGlassesSendBufferOverHighWater() {
      return glassesBackpressureLatch.isOverHighWater();
    },

    onAppClientDisconnect(handler) {
      return onAppClientDisconnect(handler);
    },
  };
  return relayApi;
}

const createRelayCore = createRelay;

export { createRelayCore, createRelay };
