import {
  createRuntimeConfig,
  createRuntimeConfigOverview,
  OPENCLAW_BUNDLE_DEFAULT_WS_PORT,
  resolveGlassesUiLive,
} from "../config/runtime-config.js";
import {
  hasExplicitWsPort,
  persistRelayPortMarker,
  resolveRelayPortDecision,
} from "../config/relay-port-default.js";
import { createPluginOpenclawClient } from "../gateway/openclaw-client.js";
import {
  composeContainerLoopbackNotice,
  isContainerEnvironment,
  isLoopbackBindAddress,
} from "./container-env.js";
import { createRelay as createPluginOwnedRelay } from "./relay-core.js";
import { normalizeLogger } from "../domain/logger-adapter.js";

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
  let setupConfig = null;

  const facadeSubscriptionChannels = {
    onGlassesUiResult: { registry: new Set(), liveUnsubs: new Map() },
    onGlassesUiNavEvent: { registry: new Set(), liveUnsubs: new Map() },

    onGlassesUiRenderReceipt: { registry: new Set(), liveUnsubs: new Map() },

    onGlassesUiClientFailure: { registry: new Set(), liveUnsubs: new Map() },
    onDeviceInfoResponse: { registry: new Set(), liveUnsubs: new Map() },
    onGlassesPresenceChanged: { registry: new Set(), liveUnsubs: new Map() },
    onLocationResponse: { registry: new Set(), liveUnsubs: new Map() },
    onAppClientDisconnect: { registry: new Set(), liveUnsubs: new Map() },
    onLogicalSessionReset: { registry: new Set(), liveUnsubs: new Map() },
    onAgentTurnChanged: { registry: new Set(), liveUnsubs: new Map() },
  };
  function attachFacadeHandler(method, channel, handler, relayInstance) {
    if (!relayInstance || typeof relayInstance[method] !== "function") return;
    const unsub = relayInstance[method](handler);
    if (typeof unsub === "function") channel.liveUnsubs.set(handler, unsub);
  }
  function subscribeFacadeChannel(method, handler) {
    if (typeof handler !== "function") return () => {};
    const channel = facadeSubscriptionChannels[method];
    channel.registry.add(handler);
    attachFacadeHandler(method, channel, handler, resolveLiveRelay());
    return () => {
      channel.registry.delete(handler);
      const unsub = channel.liveUnsubs.get(handler);
      channel.liveUnsubs.delete(handler);
      if (typeof unsub === "function") {
        try {
          unsub();
        } catch (_) {

        }
      }
    };
  }
  function attachFacadeSubscriptions(relayInstance) {
    for (const [method, channel] of Object.entries(facadeSubscriptionChannels)) {
      channel.liveUnsubs.clear();
      for (const handler of channel.registry) {
        attachFacadeHandler(method, channel, handler, relayInstance);
      }
    }
  }

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

  function getSetupConfig() {
    if (runtimeConfig) {
      return runtimeConfig;
    }
    if (opts.runtimeConfig) {
      return opts.runtimeConfig;
    }
    if (!setupConfig) {
      setupConfig = createRuntimeConfigOverview({
        pluginConfig: opts.pluginConfig,
        openclawConfig: opts.openclawConfig,
      });
    }
    return setupConfig;
  }

  async function start(startOpts = {}) {
    if (relay) {
      return relay;
    }

    const logger = normalizeLogger(startOpts.logger || baseLogger);
    const readiness = getSetupConfig();
    const missingRequiredSecrets = [];
    if (!readiness.relayToken) missingRequiredSecrets.push("relayToken");
    if (!readiness.gatewayToken) missingRequiredSecrets.push("gatewayToken");
    if (missingRequiredSecrets.length > 0) {
      logger.warn(
        `[ocuclaw] relay service not started: ${missingRequiredSecrets.join(" and ")} ` +
          "must be configured first; no relay listener was opened",
      );
      return null;
    }
    const config = getRuntimeConfig();
    const stateDir = startOpts.stateDir || opts.stateDir;

    let effectiveWsPort = config.wsPort;
    const wsPortViewAmbiguous =
      hasExplicitWsPort(opts.pluginConfig) &&
      opts.pluginConfig.wsPort === OPENCLAW_BUNDLE_DEFAULT_WS_PORT;
    if (
      !opts.runtimeConfig &&
      (!hasExplicitWsPort(opts.pluginConfig) || wsPortViewAmbiguous)
    ) {
      const portDecision = resolveRelayPortDecision({
        stateDir,
        fsImpl: opts.relayPortFs,
      });
      if (portDecision.origin === "fresh-default") {

        let writeResult = null;
        if (typeof opts.persistFreshWsPortConfig === "function") {
          try {
            writeResult = await opts.persistFreshWsPortConfig(portDecision.port);
          } catch (err) {
            writeResult = {
              written: false,
              reason: `mutation-failed: ${err && err.message}`,
            };
          }
        } else {
          writeResult = { written: false, reason: "no-config-writer" };
        }
        if (writeResult && writeResult.written === true) {
          effectiveWsPort = portDecision.port;
          logger.info(
            `[ocuclaw] relay wsPort not set in config: using ${portDecision.port} (fresh-default)`,
          );
          logger.info(
            `[ocuclaw] fresh-install relay port ${portDecision.port} written to plugin config`,
          );
          persistRelayPortMarker({
            stateDir,
            decision: portDecision,
            logger,
            fsImpl: opts.relayPortFs,
          });
        } else if (writeResult && writeResult.reason === "already-set") {

          effectiveWsPort = Number.isInteger(writeResult.existingPort)
            ? writeResult.existingPort
            : config.wsPort;
          logger.info(
            `[ocuclaw] relay wsPort ${effectiveWsPort} confirmed explicit in config; fresh default not applied`,
          );
        } else {

          logger.warn(
            `[ocuclaw] could not confirm fresh-install relay port in config (${
              (writeResult && writeResult.reason) || "unknown"
            }); keeping ${effectiveWsPort} for this start`,
          );
        }
      } else {
        effectiveWsPort = portDecision.port;
        logger.info(
          `[ocuclaw] relay wsPort not set in config: using ${portDecision.port} (${portDecision.origin})`,
        );
        if (portDecision.persistMarker) {
          persistRelayPortMarker({
            stateDir,
            decision: portDecision,
            logger,
            fsImpl: opts.relayPortFs,
          });
        }
      }
    }
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
      port: effectiveWsPort,
      host: config.wsBind,
      token: config.relayToken,
      sessionLimit: config.sessionLimit,
      sonioxApiKey: config.sonioxApiKey,
      cartesiaApiKey: config.cartesiaApiKey,
      debugNoisyPolicies: config.debugNoisyPolicies,
      externalDebugToolsEnabled: config.externalDebugToolsEnabled,
      debugAutoArm: config.debugAutoArm,
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
      getGlassesUiLiveConfig: () => {
        const serviceOpts = opts;
        const current = getRuntimeConfig();
        if (serviceOpts.runtimeConfig) {
          return current && current.glassesUiLive ? current.glassesUiLive : undefined;
        }

        return resolveGlassesUiLive(
          serviceOpts.pluginConfig && serviceOpts.pluginConfig.glassesUiLive,
          serviceOpts.openclawConfig,
          logger,
        );
      },
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

    try {
      nextRelay.effectiveWsPort = effectiveWsPort;
    } catch (_) {

    }

    try {
      nextRelay.relayLifecycle = "starting";
    } catch (_) {

    }
    setSharedRelay(nextRelay);

    attachFacadeSubscriptions(nextRelay);
    logger.info(
      `[ocuclaw] relay inbound subscriptions attached: ${Object.entries(facadeSubscriptionChannels)
        .map(([method, ch]) => `${method}=${ch.registry.size}`)
        .join(" ")}`,
    );
    try {
      await Promise.resolve(nextRelay.start());
      try {
        nextRelay.relayLifecycle = "listening";
      } catch (_) {

      }
      logger.info(
        `[ocuclaw] relay service started on ws://${config.wsBind}:${effectiveWsPort}`,
      );
      const containerEnvProbe =
        typeof opts.isContainerEnvironment === "function"
          ? opts.isContainerEnvironment
          : isContainerEnvironment;
      if (isLoopbackBindAddress(config.wsBind) && containerEnvProbe()) {
        logger.info(composeContainerLoopbackNotice(config.wsBind, effectiveWsPort));
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
    getSetupConfig,
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
    broadcastPushMessage(params) {
      const liveRelay = resolveLiveRelay();
      if (!liveRelay || typeof liveRelay.broadcastPushMessage !== "function") {
        throw new Error("ocuclaw relay not started");
      }
      return liveRelay.broadcastPushMessage(params);
    },

    emitGlassesUiLifecycle(event, severity, data) {
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.emitGlassesUiLifecycle === "function") {
        liveRelay.emitGlassesUiLifecycle(event, severity, data);
      }
    },

    onGlassesUiResult(handler) {
      return subscribeFacadeChannel("onGlassesUiResult", handler);
    },
    onGlassesUiNavEvent(handler) {
      return subscribeFacadeChannel("onGlassesUiNavEvent", handler);
    },
    onGlassesUiRenderReceipt(handler) {
      return subscribeFacadeChannel("onGlassesUiRenderReceipt", handler);
    },
    onGlassesUiClientFailure(handler) {
      return subscribeFacadeChannel("onGlassesUiClientFailure", handler);
    },
    onAppClientDisconnect(handler) {
      return subscribeFacadeChannel("onAppClientDisconnect", handler);
    },
    onLogicalSessionReset(handler) {
      return subscribeFacadeChannel("onLogicalSessionReset", handler);
    },
    onAgentTurnChanged(handler) {
      return subscribeFacadeChannel("onAgentTurnChanged", handler);
    },
    sendDeviceInfoRequest(params) {
      const liveRelay = resolveLiveRelay();
      if (!liveRelay || typeof liveRelay.sendDeviceInfoRequest !== "function") {
        throw new Error("ocuclaw relay not started");
      }
      liveRelay.sendDeviceInfoRequest(params);
    },
    onDeviceInfoResponse(handler) {
      return subscribeFacadeChannel("onDeviceInfoResponse", handler);
    },
    onGlassesPresenceChanged(handler) {
      return subscribeFacadeChannel("onGlassesPresenceChanged", handler);
    },
    sendLocationRequest(params) {
      const liveRelay = resolveLiveRelay();
      if (!liveRelay || typeof liveRelay.sendLocationRequest !== "function") {
        throw new Error("ocuclaw relay not started");
      }
      liveRelay.sendLocationRequest(params);
    },
    onLocationResponse(handler) {
      return subscribeFacadeChannel("onLocationResponse", handler);
    },
    isLocationAccessEnabled() {
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.isLocationAccessEnabled === "function") {
        return liveRelay.isLocationAccessEnabled();
      }
      return false;
    },
    getEvenAiSettingsSnapshot() {
      if (relay && typeof relay.getEvenAiSettingsSnapshot === "function") {
        return relay.getEvenAiSettingsSnapshot();
      }
      const config = runtimeConfig;
      return {
        routingMode: config ? config.evenAiRoutingMode : "active",
        systemPrompt: config ? config.evenAiSystemPrompt : "",
        defaultModel: "",
        defaultThinking: "",
        listenEnabled: false,
        trackedThrowawayKeys: [],
      };
    },
    getEvenAiDedicatedSessionKey() {
      return runtimeConfig ? runtimeConfig.evenAiDedicatedSessionKey : "ocuclaw:even-ai";
    },
    getSessionTitleModel() {
      return runtimeConfig ? runtimeConfig.sessionTitleModel || "" : "";
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
    consumePromptTurnOwnership(sessionKey, identity = null) {
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.consumePromptTurnOwnership === "function") {
        return liveRelay.consumePromptTurnOwnership(sessionKey, identity);
      }
      return null;
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
    getConnectedAppClientVersion() {
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.getConnectedAppClientVersion === "function") {
        return liveRelay.getConnectedAppClientVersion();
      }
      return null;
    },
    hasConnectedAppClientCapability(capability) {
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.hasConnectedAppClientCapability === "function") {
        return liveRelay.hasConnectedAppClientCapability(capability);
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

      return null;
    },

    currentAgentRunId(sessionKey) {
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.currentAgentRunId === "function") {
        return liveRelay.currentAgentRunId(sessionKey);
      }
      return { runId: null, active: false, atMs: null };
    },
    start,
    stop,
  };
}
