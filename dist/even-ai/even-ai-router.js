import { normalizeEvenAiRoutingMode } from "./even-ai-settings-store.js";

export const DEFAULT_EVEN_AI_DEDICATED_SESSION_KEY = "ocuclaw:even-ai";

function normalizeSessionKey(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeDedicatedSessionKey(value) {
  const normalized = normalizeSessionKey(value);
  if (!normalized) {
    return DEFAULT_EVEN_AI_DEDICATED_SESSION_KEY;
  }
  return normalized.toLowerCase().startsWith("ocuclaw:")
    ? normalized
    : DEFAULT_EVEN_AI_DEDICATED_SESSION_KEY;
}

export function createEvenAiRouter(opts = {}) {
  const sessionService = opts.sessionService;
  if (!sessionService || typeof sessionService.ensureSessionKey !== "function") {
    throw new Error("Even AI router requires sessionService.ensureSessionKey()");
  }

  const getRoutingMode =
    typeof opts.getRoutingMode === "function"
      ? opts.getRoutingMode
      : () => opts.routingMode;
  const dedicatedSessionKey = normalizeDedicatedSessionKey(
    opts.dedicatedSessionKey,
  );

  async function resolveTargetSession() {
    const routingMode = normalizeEvenAiRoutingMode(getRoutingMode());
    const previousSessionKey =
      typeof sessionService.peekSessionKey === "function"
        ? normalizeSessionKey(sessionService.peekSessionKey())
        : null;

    if (routingMode === "background") {
      return {
        routingMode,
        sessionKey: dedicatedSessionKey,
        previousSessionKey,
        sessionChanged: false,
      };
    }

    if (routingMode === "background_new") {
      if (typeof sessionService.createDetachedSessionKey !== "function") {
        throw new Error(
          "Even AI router requires sessionService.createDetachedSessionKey()",
        );
      }
      const sessionKey = normalizeSessionKey(
        await Promise.resolve(
          sessionService.createDetachedSessionKey("ocuclaw:even-ai:"),
        ),
      );
      if (!sessionKey) {
        throw new Error("Even AI router failed to create a detached session key.");
      }
      return {
        routingMode,
        sessionKey,
        previousSessionKey,
        sessionChanged: false,
      };
    }

    return {
      routingMode: normalizeEvenAiRoutingMode(),
      sessionKey: normalizeSessionKey(sessionService.ensureSessionKey()) || "main",
      previousSessionKey,
      sessionChanged: false,
    };
  }

  return {
    getRoutingMode() {
      return normalizeEvenAiRoutingMode(getRoutingMode());
    },

    getDedicatedSessionKey() {
      return dedicatedSessionKey;
    },

    resolveActiveSession() {
      return normalizeSessionKey(sessionService.ensureSessionKey()) || "main";
    },

    resolveTargetSession,
  };
}

export default createEvenAiRouter;
