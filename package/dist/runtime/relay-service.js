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
import { createCloudwaysSupervisor } from "../setup/cloudways-supervisor.js";
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

function readInputPredictionTimeoutMs(pluginConfig) {
  const raw = pluginConfig && pluginConfig.inputPredictionTimeoutMs;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

export function createOcuClawRelayService(opts = {}) {
  const baseLogger = normalizeLogger(opts.logger);
  let relay = null;

  let cloudwaysSupervisor = null;
  let runtimeConfig = null;
  let setupConfig = null;

  let adoptedRelayToken = null;

  let relayCredentialLoad = {
    origin: null,
    mintOnLoad: { status: "not-attempted", code: null, detail: null },
  };
  let relayCredentialAdoptionAnnounced = false;
  const optsAny0 = opts;
  function effectivePluginConfig() {
    if (adoptedRelayToken === null) return optsAny0.pluginConfig;
    const base = optsAny0.pluginConfig && typeof optsAny0.pluginConfig === "object"
      ? optsAny0.pluginConfig
      : {};
    return { ...base, relayToken: adoptedRelayToken };
  }
  function recordRelayCredentialLoad(origin, mint) {
    relayCredentialLoad = {
      origin,
      mintOnLoad: {
        status: mint && typeof mint.status === "string" ? mint.status : "not-attempted",
        code: mint && typeof mint.code === "string" ? mint.code : null,
        detail: mint && typeof mint.detail === "string" ? mint.detail : null,
      },
    };
  }
  function announceRelayCredentialAdopted() {
    if (relayCredentialAdoptionAnnounced) return;
    relayCredentialAdoptionAnnounced = true;
    if (typeof optsAny0.onRelayCredentialAdopted !== "function") return;
    try {
      optsAny0.onRelayCredentialAdopted(relayCredentialLoad);
    } catch (err) {
      baseLogger.warn(
        `[ocuclaw] relay credential adoption hook failed: ${err && err.message ? err.message : String(err)}`,
      );
    }
  }

  const facadeSubscriptionChannels = {
    onGlassesUiResult: { registry: new Set(), liveUnsubs: new Map() },
    onGlassesUiNavEvent: { registry: new Set(), liveUnsubs: new Map() },

    onGlassesUiRenderReceipt: { registry: new Set(), liveUnsubs: new Map() },

    onGlassesUiClientFailure: { registry: new Set(), liveUnsubs: new Map() },
    onDeviceInfoResponse: { registry: new Set(), liveUnsubs: new Map() },
    onGlassesPresenceChanged: { registry: new Set(), liveUnsubs: new Map() },
    onLocationResponse: { registry: new Set(), liveUnsubs: new Map() },
    onAppClientDisconnect: { registry: new Set(), liveUnsubs: new Map() },
    onAppClientSessionLeft: { registry: new Set(), liveUnsubs: new Map() },
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
          pluginConfig: effectivePluginConfig(),
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
        env: opts.env || process.env,
        pluginConfig: effectivePluginConfig(),
        openclawConfig: opts.openclawConfig,
      });
    }
    return setupConfig;
  }

  async function resolveRelayCredentialAtStart(logger) {
    const boot = getSetupConfig();
    if (boot.relayToken) {
      if (relayCredentialLoad.origin === null) {
        recordRelayCredentialLoad("pre-existing", { status: "not-needed", code: "credential-loaded-at-boot" });
      }
      return true;
    }
    if (typeof optsAny0.mintRelayCredentialAtLoad !== "function") {
      recordRelayCredentialLoad(null, { status: "not-attempted", code: "no-minter" });
      return false;
    }
    let outcome;
    try {
      outcome = await optsAny0.mintRelayCredentialAtLoad();
    } catch (err) {
      outcome = {
        status: "failed",
        code: typeof err?.code === "string" ? err.code : "mint_failed",
        detail: typeof err?.message === "string" ? err.message : String(err),
      };
    }
    const credential = outcome && typeof outcome.credential === "string" && outcome.credential.length > 0
      ? outcome.credential
      : null;

    recordRelayCredentialLoad(credential ? outcome.origin : null, outcome);
    if (!credential) {
      logger.warn(
        `[ocuclaw] relay credential not minted at load (${
          (outcome && outcome.code) || "unknown"
        }): ${(outcome && outcome.detail) || "no detail"}`,
      );
      return false;
    }
    adoptedRelayToken = credential;
    runtimeConfig = null;
    setupConfig = null;
    logger.info(
      outcome.status === "minted"
        ? "[ocuclaw] relay credential minted by this host at plugin load and adopted in-process; pair a phone with `openclaw ocuclaw pair`"
        : `[ocuclaw] relay credential adopted in-process at start (${outcome.code})`,
    );
    return true;
  }

  async function start(startOpts = {}) {
    if (relay) {
      return relay;
    }

    const logger = normalizeLogger(startOpts.logger || baseLogger);
    await resolveRelayCredentialAtStart(logger);
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
    const optsAny = opts;
    const nextRelay = createRelay({
      optionalSetupCommandsVersion: 1,
      optionalSetupEvenAiCommands: true,
      optionalSetup: optsAny.optionalSetup,
      setupStateDir: optsAny.setupStateDir,
      gatewayUrl: config.gatewayUrl,
      gatewayToken: config.gatewayToken,

      inputPrediction: optsAny.inputPrediction,

      inputPredictionTimeoutMs: readInputPredictionTimeoutMs(optsAny.pluginConfig),

      silentInputJev: config.silentInputJev,
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
      startCloudwaysSupervisor(logger, startOpts);

      if (adoptedRelayToken !== null) announceRelayCredentialAdopted();
      return nextRelay;
    } catch (err) {
      clearSharedRelay(nextRelay);
      relay = null;
      throw err;
    }
  }

  function getRelayCredentialLoadState() {
    return {
      origin: relayCredentialLoad.origin,
      adoptedInProcess: adoptedRelayToken !== null,
      mintOnLoad: { ...relayCredentialLoad.mintOnLoad },
    };
  }

  function startCloudwaysSupervisor(logger, startOpts) {
    if (cloudwaysSupervisor) return;
    if (opts.cloudwaysSupervisor === false || startOpts.cloudwaysSupervisor === false) return;
    try {
      const create = typeof opts.createCloudwaysSupervisor === "function"
        ? opts.createCloudwaysSupervisor
        : createCloudwaysSupervisor;
      cloudwaysSupervisor = create({ logger });
      Promise.resolve(cloudwaysSupervisor.start()).catch((error) => {
        logger.warn(`[ocuclaw] cloudways supervisor start failed: ${String((error && error.message) || error)}`);
      });
    } catch (error) {
      cloudwaysSupervisor = null;
      logger.warn(`[ocuclaw] cloudways supervisor unavailable: ${String((error && error.message) || error)}`);
    }
  }

  function stopCloudwaysSupervisor() {
    if (!cloudwaysSupervisor) return;
    const supervisor = cloudwaysSupervisor;
    cloudwaysSupervisor = null;

    try { supervisor.stop(); } catch (_) {  }
  }

  async function stop(stopOpts = {}) {
    if (!relay) {
      stopCloudwaysSupervisor();
      return;
    }

    const logger = normalizeLogger(stopOpts.logger || baseLogger);
    const activeRelay = relay;
    relay = null;
    clearSharedRelay(activeRelay);
    stopCloudwaysSupervisor();
    await Promise.resolve(activeRelay.stop());
    logger.info("[ocuclaw] relay service stopped");
  }

  function resolveLiveRelay() {

    return relay || getSharedRelay();
  }
  return {
    getRuntimeConfig,
    getSetupConfig,
    getRelayCredentialLoadState,
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
    onAppClientSessionLeft(handler) {
      return subscribeFacadeChannel("onAppClientSessionLeft", handler);
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

    getAppViewedSessionKeys() {
      const liveRelay = resolveLiveRelay();
      if (liveRelay && typeof liveRelay.getAppViewedSessionKeys === "function") {
        return liveRelay.getAppViewedSessionKeys();
      }
      return null;
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
