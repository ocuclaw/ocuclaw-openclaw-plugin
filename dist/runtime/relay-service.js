import { createRuntimeConfig } from "../config/runtime-config.js";
import { createPluginOpenclawClient } from "../gateway/openclaw-client.js";
import {
  composeContainerLoopbackWarning,
  isContainerEnvironment,
  isLoopbackBindAddress,
} from "./container-env.js";
import { createRelay as createPluginOwnedRelay } from "./relay-core.js";

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

function resolveCreateRelay(createRelayOverride) {
  if (typeof createRelayOverride === "function") {
    return createRelayOverride;
  }
  return createPluginOwnedRelay;
}
function resolveOpenclawClient(openclawClientOverride, runtimeConfig, logger, stateDir) {
  if (openclawClientOverride) {
    return openclawClientOverride;
  }
  return createPluginOpenclawClient({
    gatewayUrl: runtimeConfig.gatewayUrl,
    gatewayToken: runtimeConfig.gatewayToken,
    logger,
    stateDir,
  });
}

const SHARED_RELAY_SYMBOL = Symbol.for("ocuclaw.shared.relay");

function getSharedRelay() {
  return globalThis[SHARED_RELAY_SYMBOL] || null;
}

function setSharedRelay(relay) {
  globalThis[SHARED_RELAY_SYMBOL] = relay;
}

function clearSharedRelay(relay) {
  if (globalThis[SHARED_RELAY_SYMBOL] === relay) {
    globalThis[SHARED_RELAY_SYMBOL] = null;
  }
}

export function createOcuClawRelayService(opts = {}) {
  const baseLogger = normalizeLogger(opts.logger);
  let relay = null;
  let runtimeConfig = null;
  const pendingGlassesUiResultHandlers = [];
  const pendingGlassesUiNavEventHandlers = [];
  const pendingDeviceInfoResponseHandlers = [];
  const pendingAppClientDisconnectHandlers = [];

  function getRuntimeConfig() {
    if (!runtimeConfig) {
      runtimeConfig =
        opts.runtimeConfig ||
        createRuntimeConfig({
          env: opts.env || process.env,
          pluginConfig: opts.pluginConfig,
          openclawConfig: opts.openclawConfig,
        });
    }
    return runtimeConfig;
  }

  async function start(startOpts = {}) {
    if (relay) {
      return relay;
    }

    const logger = normalizeLogger(startOpts.logger || baseLogger);
    const config = getRuntimeConfig();
    const stateDir = startOpts.stateDir || opts.stateDir;
    const createRelay = resolveCreateRelay(opts.createRelay);
    const openclawClient = resolveOpenclawClient(
      opts.openclawClient,
      config,
      logger,
      stateDir,
    );
    if (typeof openclawClient.setLogger === "function") {
      openclawClient.setLogger(logger);
    }
    const nextRelay = createRelay({
      gatewayUrl: config.gatewayUrl,
      gatewayToken: config.gatewayToken,
      httpServer: startOpts.httpServer || opts.httpServer,
      port: config.wsPort,
      host: config.wsBind,
      token: config.relayToken,
      sessionLimit: config.sessionLimit,
      sonioxApiKey: config.sonioxApiKey,
      cartesiaApiKey: config.cartesiaApiKey,
      debugNoisyPolicies: config.debugNoisyPolicies,
      externalDebugToolsEnabled: config.externalDebugToolsEnabled,
      allowDebugUpload: config.allowDebugUpload,
      debugUploadMaxZipBytes: config.debugUploadMaxZipBytes,
      debugUploadCapturePreset: config.debugUploadCapturePreset,
      debugBundleSaveDir: config.debugBundleSaveDir,
      evenAiEnabled: config.evenAiEnabled,
      evenAiToken: config.evenAiToken,
      evenAiSystemPrompt: config.evenAiSystemPrompt,
      evenAiRequestTimeoutMs: config.evenAiRequestTimeoutMs,
      evenAiMaxBodyBytes: config.evenAiMaxBodyBytes,
      evenAiDedupWindowMs: config.evenAiDedupWindowMs,
      evenAiRoutingMode: config.evenAiRoutingMode,
      evenAiDedicatedSessionKey: config.evenAiDedicatedSessionKey,
      stateDir,
      evenAiExternalHttpRouting: opts.evenAiExternalHttpRouting === true,
      openclawClient,
      logger,
      consoleLogPath: opts.consoleLogPath,
      activityStatusAdapter: {
        freshnessWindowMs: config.freshnessWindowMs,
        now: () => Date.now(),
      },
    });

    relay = nextRelay;
    setSharedRelay(nextRelay);
    if (typeof nextRelay.onGlassesUiResult === "function" && pendingGlassesUiResultHandlers.length > 0) {
      for (const handler of pendingGlassesUiResultHandlers) {
        nextRelay.onGlassesUiResult(handler);
      }
    }
    if (typeof nextRelay.onGlassesUiNavEvent === "function" && pendingGlassesUiNavEventHandlers.length > 0) {
      for (const handler of pendingGlassesUiNavEventHandlers.splice(0)) {
        nextRelay.onGlassesUiNavEvent(handler);
      }
    }
    if (typeof nextRelay.onDeviceInfoResponse === "function" && pendingDeviceInfoResponseHandlers.length > 0) {

      for (const handler of pendingDeviceInfoResponseHandlers.splice(0)) {
        nextRelay.onDeviceInfoResponse(handler);
      }
    }
    if (typeof nextRelay.onAppClientDisconnect === "function" && pendingAppClientDisconnectHandlers.length > 0) {
      for (const handler of pendingAppClientDisconnectHandlers.splice(0)) {
        nextRelay.onAppClientDisconnect(handler);
      }
    }
    try {
      await Promise.resolve(nextRelay.start());
      logger.info(
        `[ocuclaw] relay service started on ws://${config.wsBind}:${config.wsPort}`,
      );
      const containerEnvProbe =
        typeof opts.isContainerEnvironment === "function"
          ? opts.isContainerEnvironment
          : isContainerEnvironment;
      if (isLoopbackBindAddress(config.wsBind) && containerEnvProbe()) {
        logger.warn(composeContainerLoopbackWarning(config.wsBind, config.wsPort));
      }
      return nextRelay;
    } catch (err) {
      clearSharedRelay(nextRelay);
      relay = null;
      throw err;
    }
  }

  async function stop(stopOpts = {}) {
    if (!relay) {
      return;
    }

    const logger = normalizeLogger(stopOpts.logger || baseLogger);
    const activeRelay = relay;
    relay = null;
    clearSharedRelay(activeRelay);
    await Promise.resolve(activeRelay.stop());
    logger.info("[ocuclaw] relay service stopped");
  }

  function resolveLiveRelay() {

    return relay || getSharedRelay();
  }
  return {
    getRuntimeConfig,
    getRelay() {
      return resolveLiveRelay();
    },
    sendGlassesUiRender(params) {
      const liveRelay = resolveLiveRelay();
      if (!liveRelay || typeof liveRelay.sendGlassesUiRender !== "function") {
        throw new Error("ocuclaw relay not started");
      }
      liveRelay.sendGlassesUiRender(params);
    },
    sendGlassesUiSurfaceUpdate(params) {
      const liveRelay = resolveLiveRelay();
      if (!liveRelay || typeof liveRelay.sendGlassesUiSurfaceUpdate !== "function") {
        throw new Error("ocuclaw relay not started");
      }
      liveRelay.sendGlassesUiSurfaceUpdate(params);
    },

    emitGlassesUiLifecycle(event, severity, data) {
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.emitGlassesUiLifecycle === "function") {
        liveRelay.emitGlassesUiLifecycle(event, severity, data);
      }
    },
    onGlassesUiResult(handler) {
      if (typeof handler !== "function") {
        return () => {};
      }
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.onGlassesUiResult === "function") {
        return liveRelay.onGlassesUiResult(handler);
      }

      pendingGlassesUiResultHandlers.push(handler);
      return () => {
        const idx = pendingGlassesUiResultHandlers.indexOf(handler);
        if (idx !== -1) pendingGlassesUiResultHandlers.splice(idx, 1);
      };
    },
    onGlassesUiNavEvent(handler) {
      if (typeof handler !== "function") return () => {};
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.onGlassesUiNavEvent === "function") {
        return liveRelay.onGlassesUiNavEvent(handler);
      }
      pendingGlassesUiNavEventHandlers.push(handler);
      return () => {
        const idx = pendingGlassesUiNavEventHandlers.indexOf(handler);
        if (idx !== -1) pendingGlassesUiNavEventHandlers.splice(idx, 1);
      };
    },
    onAppClientDisconnect(handler) {
      if (typeof handler !== "function") return () => {};
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.onAppClientDisconnect === "function") {
        return liveRelay.onAppClientDisconnect(handler);
      }

      pendingAppClientDisconnectHandlers.push(handler);
      return () => {
        const idx = pendingAppClientDisconnectHandlers.indexOf(handler);
        if (idx !== -1) pendingAppClientDisconnectHandlers.splice(idx, 1);
      };
    },
    sendDeviceInfoRequest(params) {
      const liveRelay = resolveLiveRelay();
      if (!liveRelay || typeof liveRelay.sendDeviceInfoRequest !== "function") {
        throw new Error("ocuclaw relay not started");
      }
      liveRelay.sendDeviceInfoRequest(params);
    },
    onDeviceInfoResponse(handler) {
      if (typeof handler !== "function") {
        return () => {};
      }
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.onDeviceInfoResponse === "function") {
        return liveRelay.onDeviceInfoResponse(handler);
      }

      pendingDeviceInfoResponseHandlers.push(handler);
      return () => {
        const idx = pendingDeviceInfoResponseHandlers.indexOf(handler);
        if (idx !== -1) pendingDeviceInfoResponseHandlers.splice(idx, 1);
      };
    },
    getEvenAiSettingsSnapshot() {
      if (relay && typeof relay.getEvenAiSettingsSnapshot === "function") {
        return relay.getEvenAiSettingsSnapshot();
      }
      const config = getRuntimeConfig();
      return {
        routingMode: config.evenAiRoutingMode,
        systemPrompt: config.evenAiSystemPrompt,
        defaultModel: "",
        defaultThinking: "",
        listenEnabled: false,
        trackedThrowawayKeys: [],
      };
    },

    getSessionTitle(sessionKey) {
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.getSessionTitle === "function") {
        return liveRelay.getSessionTitle(sessionKey);
      }
      return null;
    },
    hasRecordedUserMessage(sessionKey) {
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.hasRecordedUserMessage === "function") {
        return liveRelay.hasRecordedUserMessage(sessionKey);
      }

      return false;
    },
    isNeuralSessionNamesEnabled(sessionKey) {
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.isNeuralSessionNamesEnabled === "function") {
        return liveRelay.isNeuralSessionNamesEnabled(sessionKey);
      }
      return true;
    },
    isSessionUserLocked(sessionKey) {
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.isSessionUserLocked === "function") {
        return liveRelay.isSessionUserLocked(sessionKey);
      }
      return false;
    },
    getDisplayStartStates(sessionKey) {
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.getDisplayStartStates === "function") {
        return liveRelay.getDisplayStartStates(sessionKey);
      }
      return { emoji: false, pace: false };
    },
    getDisplayCurrentStates(sessionKey) {
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.getDisplayCurrentStates === "function") {
        return liveRelay.getDisplayCurrentStates(sessionKey);
      }
      return { emoji: false, pace: false };
    },

    getSessionTitleRecord(sessionKey) {
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.getSessionTitleRecord === "function") {
        return liveRelay.getSessionTitleRecord(sessionKey);
      }
      return null;
    },
    isEvenAiSessionKey(sessionKey) {
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.isEvenAiSessionKey === "function") {
        return liveRelay.isEvenAiSessionKey(sessionKey);
      }
      return false;
    },
    getRawMessages() {
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.getRawMessages === "function") {
        return liveRelay.getRawMessages();
      }
      return [];
    },
    getDistillerBudget() {
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.getDistillerBudget === "function") {
        return liveRelay.getDistillerBudget();
      }
      return null;
    },
    deleteDistillerSession(sessionKey) {
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.deleteDistillerSession === "function") {
        return liveRelay.deleteDistillerSession(sessionKey);
      }
      return Promise.resolve(null);
    },
    getStateDir() {
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.getStateDir === "function") {
        return liveRelay.getStateDir();
      }
      return opts.stateDir;
    },
    emitDebug(...args) {
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.emitDebug === "function") {
        return liveRelay.emitDebug(...args);
      }
      return undefined;
    },
    gatewayRequest(method, params, requestOpts) {
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.gatewayRequest === "function") {
        return liveRelay.gatewayRequest(method, params, requestOpts);
      }
      return Promise.reject(new Error("relay_not_running"));
    },
    onGatewayEvent(eventName, listener) {
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.onGatewayEvent === "function") {
        return liveRelay.onGatewayEvent(eventName, listener);
      }
      return () => {};
    },
    peekSessionKey() {

      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.peekSessionKey === "function") {
        return liveRelay.peekSessionKey();
      }
      return null;
    },
    recordNeuralSessionNamesEnabled(sessionKey, enabled) {
      if (relay && typeof relay.recordNeuralSessionNamesEnabled === "function") {
        relay.recordNeuralSessionNamesEnabled(sessionKey, enabled);
      }
    },
    setSessionTitle(sessionKey, title, opts) {
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.setSessionTitle === "function") {
        return liveRelay.setSessionTitle(sessionKey, title, opts);
      }
      return { ok: false, code: "relay_not_running" };
    },
    hasConnectedAppClient() {
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.hasConnectedAppClient === "function") {
        return liveRelay.hasConnectedAppClient();
      }
      return false;
    },
    isGlassesSendBufferOverHighWater() {

      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.isGlassesSendBufferOverHighWater === "function") {
        return liveRelay.isGlassesSendBufferOverHighWater();
      }
      return false;
    },

    dispatchGlassesWake(params) {
      const liveRelay = resolveLiveRelay();
      if (!liveRelay || typeof liveRelay.dispatchGlassesWake !== "function") {

        return Promise.reject(new Error("ocuclaw relay not started"));
      }
      return liveRelay.dispatchGlassesWake(params);
    },
    isAgentTurnBusy(sessionKey) {
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.isAgentTurnBusy === "function") {
        return liveRelay.isAgentTurnBusy(sessionKey);
      }

      return false;
    },
    start,
    stop,
  };
}
