import { createOcuClawRelayService } from "./runtime/relay-service.js";
import { configuredOpenReplyRoute, configuredReplyModels, createReplyModelPriceLookup, probeLlmCompleteOptions, runtimeOnlyModelMatcher } from "./gateway/input-prediction-openclaw.js";
import { saveInputPredictionModelAllow } from "./setup/optional-credential-store.js";
import { createEvenAiModelHook } from "./even-ai/even-ai-model-hook.js";
import { createChannelTwoHook } from "./runtime/channel-two-hook.js";
import {
  getRegisteredLiveuiGlassesLibraryController,
  registerGlassesUiTool,
} from "./tools/glasses-ui-tool.js";
import { registerSessionTitleTool } from "./tools/session-title-tool.js";
import { registerDeviceInfoTool } from "./tools/device-info-tool.js";
import { registerLocationTool } from "./tools/location-tool.js";
import { registerSessionTitleDistiller } from "./runtime/register-session-title-distiller.js";
import {
  classifySetupRegistration,
  createSetupController,
  resolveSetupStateDir,
} from "./setup/setup-controller.js";
import { registerOcuClawSetupTool } from "./setup/overview-tool.js";
import { firstUseSetupSessionFromContext } from "./setup/first-use-relay-run.js";
import { registerOcuClawSetupCli } from "./setup/overview-cli.js";
import { createTerminalPairingCommand, terminalPairingCapability } from "./setup/pairing-command.js";
import { readLiveSetupJourney, readPrivateRoute, readTailnetDaemon, registerSetupJourneyReader } from "./setup/setup-live.js";
import { createRuntimeConfigOverview } from "./config/runtime-config.js";
import { createFreshWsPortConfigWriter } from "./config/relay-port-default.js";
import { createRelayPortMutation } from "./setup/relay-port-mutation.js";
import { createOptionalSetupService } from "./setup/optional-setup-service.js";
import { createFirstUseStore } from "./setup/first-use.js";
import {
  createRelayCredentialProvision,
  relayCredentialProvisioningCapability,
} from "./setup/relay-credential-provision.js";
import {
  createRelayCredentialMintOnLoad,
  MINT_ON_LOAD_AFTER_WRITE,
  mintOnLoadSupported,
} from "./setup/relay-credential-mint-on-load.js";
import { createSetupApprovalHook } from "./setup/setup-approval.js";
import { registerSetupFirstUseControl, registerSetupWelcomeControl, createFirstUseTool, createFirstUseWakeGuardHook } from "./setup/first-use-command.js";
import { warnTaskIndexPromptInjectionDisabledOnce } from "./runtime/task-index-prompt-injection.js";
import { projectLiveuiTaskIndexRows } from "./tools/glasses-ui-task-index.js";

function gatewayProcessEnv() {
  const runtime = globalThis;
  return runtime.process && runtime.process.env ? runtime.process.env : {};
}

export default function register(api) {
  if (api && api.registrationMode === "cli-metadata") {
    const config = createRuntimeConfigOverview({
      env: gatewayProcessEnv(),
      pluginConfig: api.pluginConfig,
      openclawConfig: api.config,
    });
    const registration = classifySetupRegistration(api.registrationMode);
    const controller = createSetupController({
      api,
      service: {
        getRuntimeConfig: () => config,
        getRelay: () => null,
        hasConnectedAppClient: () => false,
      },
      ...registration,
      readLiveJourney: readLiveSetupJourney,
      credentialProvisioning: relayCredentialProvisioningCapability(api),
      pairing: terminalPairingCapability(api),
      isSetupToolRegistered: () => false,
    });
    registerOcuClawSetupCli(api, controller, createTerminalPairingCommand(api, controller));
    return;
  }
  if (!api || typeof api.registerService !== "function") {
    throw new Error("OcuClaw plugin requires api.registerService()");
  }

  const setupConfig = createRuntimeConfigOverview({
    env: gatewayProcessEnv(),
    pluginConfig: api.pluginConfig,
    openclawConfig: api.config,
  });
  const relayTokenConfigured = !!setupConfig.relayToken;

  let relayCredentialAdopted = relayTokenConfigured;
  warnTaskIndexPromptInjectionDisabledOnce(api.config, api.logger);

  let optionalSetupService = null;
  const service = createOcuClawRelayService({
    optionalSetup: {
      handle: (request, context) => optionalSetupService?.handle(request, context),
      disconnect: (connectionId) => optionalSetupService?.disconnect(connectionId),
    },
    setupStateDir: resolveSetupStateDir(api),
    logger: api.logger,
    pluginConfig: api.pluginConfig,
    openclawConfig: api.config,
    persistFreshWsPortConfig: createFreshWsPortConfigWriter(api),

    mintRelayCredentialAtLoad:
      !relayTokenConfigured && mintOnLoadSupported(api)
        ? createRelayCredentialMintOnLoad(api, {
            provision: createRelayCredentialProvision(api, {
              relayCredentialLoadedAtBoot: false,
              afterWrite: MINT_ON_LOAD_AFTER_WRITE,
            }),
          })
        : undefined,
    onRelayCredentialAdopted: () => {
      relayCredentialAdopted = true;
      registerCredentialGatedSurfaces();
    },

    inputPrediction: {
      completionRoute: (identity) => configuredOpenReplyRoute(api.config, identity),

      configuredModels: (identity) => configuredReplyModels(api.config, identity),

      allowModel: (ref) => saveInputPredictionModelAllow(api, ref),

      providerAuth: async (provider) => {
        const modelAuth = api && api.runtime && api.runtime.modelAuth;
        if (!modelAuth || typeof modelAuth.resolveApiKeyForProvider !== "function") return null;
        try {
          const auth = await modelAuth.resolveApiKeyForProvider({ provider, cfg: api.config });
          return Boolean(auth && ((typeof auth.apiKey === "string" && auth.apiKey) || auth.mode === "aws-sdk"));
        } catch {
          return false;
        }
      },

      authExemptModel: (ref, identity) => runtimeOnlyModelMatcher(api.config, identity)(ref),

      modelPrice: createReplyModelPriceLookup({ getConfig: () => api.config }),
      logger: api.logger,
      llmComplete: (() => {
        const llm = api && api.runtime && api.runtime.llm;
        if (!llm || typeof llm.complete !== "function") return undefined;
        return (params) => llm.complete(params);
      })(),
      optionSupport: (() => {
        const llm = api && api.runtime && api.runtime.llm;
        return llm && typeof llm.complete === "function"
          ? probeLlmCompleteOptions(llm.complete)
          : undefined;
      })(),
      policy: () => {
        const entries = api && api.config && api.config.plugins && api.config.plugins.entries;
        const entry = entries && typeof entries === "object" ? entries.ocuclaw : null;
        const llmPolicy = entry && typeof entry === "object" && entry.llm && typeof entry.llm === "object" ? entry.llm : {};
        return {
          allowModelOverride: llmPolicy.allowModelOverride === true,
          allowedModels: Array.isArray(llmPolicy.allowedModels) ? llmPolicy.allowedModels : [],
        };
      },
      hostVersion:
        api && api.runtime && typeof api.runtime.version === "string"
          ? api.runtime.version
          : "",
    },
  });
  let setupToolRegistered = false;
  const registration = classifySetupRegistration(api.registrationMode);
  const controller = createSetupController({
    api,
    service,
    isSetupToolRegistered: () => setupToolRegistered,
    ...registration,
    readLiveJourney: readLiveSetupJourney,
    credentialProvisioning: relayCredentialProvisioningCapability(api),
    pairing: terminalPairingCapability(api),
    readPrivateRoute,
    readTailnetDaemon,
    firstUse: terminalPairingCapability(api) === "available" && typeof api.registerGatewayMethod === "function" ? "available" : "unavailable",
  });
  registerSetupJourneyReader(api, controller);
  registerSetupFirstUseControl(api, service);
  registerSetupWelcomeControl(api, service);
  registerOcuClawSetupCli(api, controller, createTerminalPairingCommand(api, controller));

  optionalSetupService = createOptionalSetupService(api, {
    readLoaded: () => service.getRelay() ? service.getRuntimeConfig() : null,
    readFirstUse: () => createFirstUseStore(resolveSetupStateDir(api)).read(),
    readJourney: () => controller("journey", { surface: "phone" }),
  });

  if (typeof api.on === "function") {
    api.on("before_tool_call", createSetupApprovalHook([createFirstUseWakeGuardHook(service)]));
  }

  let glassesUiDispose = null;
  let deviceInfoDispose = null;
  let locationDispose = null;
  let distillerDispose = null;
  let credentialGatedSurfacesRegistered = false;

  function registerCredentialGatedSurfaces() {
    if (credentialGatedSurfacesRegistered) return;
    credentialGatedSurfacesRegistered = true;
    if (typeof api.on === "function") {
      api.on(
        "before_model_resolve",
        createEvenAiModelHook({
          getSettingsSnapshot() {
            return service.getEvenAiSettingsSnapshot();
          },
          getDedicatedSessionKey() {
            return service.getEvenAiDedicatedSessionKey();
          },
        }),
      );
      api.on(
        "before_prompt_build",
        createChannelTwoHook(
          {
            getDisplayStartStates: (k) => service.getDisplayStartStates(k),
            getDisplayCurrentStates: (k) => service.getDisplayCurrentStates(k),
            hasConnectedAppClient: () => service.hasConnectedAppClient(),
            consumePromptTurnOwnership: (k, identity) =>
              service.consumePromptTurnOwnership(k, identity),

            getEvenAiSystemPrompt() {
              const snapshot = service.getEvenAiSettingsSnapshot();
              return snapshot && typeof snapshot.systemPrompt === "string"
                ? snapshot.systemPrompt
                : "";
            },
            getTaskIndexRows() {
              const library = getRegisteredLiveuiGlassesLibraryController();
              if (!library || typeof library.listTasksForPhone !== "function") return [];
              const snapshot = library.listTasksForPhone();
              return projectLiveuiTaskIndexRows(
                snapshot && snapshot.tasks,
                snapshot && snapshot.organization,
              );
            },
          },
          { emitDebug: (...a) => service.emitDebug(...a) },
        ),
      );
    }
    if (typeof api.registerTool === "function") {
      glassesUiDispose = registerGlassesUiTool(api, service);
      registerSessionTitleTool(api, service);
      deviceInfoDispose = registerDeviceInfoTool(api, service);
      locationDispose = registerLocationTool(api, service);
      distillerDispose = registerSessionTitleDistiller(api, service);
    }
  }

  if (typeof api.registerTool === "function") {
    registerOcuClawSetupTool(
      api,
      controller,
      createRelayPortMutation(api),

      createRelayCredentialProvision(api, {
        relayCredentialLoadedAtBoot: () => relayCredentialAdopted,
      }),
      createFirstUseTool(api, undefined, service),

      (ctx) => {
        const session = firstUseSetupSessionFromContext(ctx);
        if (session) service.getRelay?.()?.noteSetupSession?.(session);
      },
    );
    setupToolRegistered = true;
  }
  if (relayTokenConfigured) {
    registerCredentialGatedSurfaces();
  }

  api.registerService({
    id: "ocuclaw-relay",
    start: (ctx) =>
      service.start({
        logger: ctx && ctx.logger,
        stateDir: ctx && ctx.stateDir,
      }),
    stop: (ctx) => {
      if (typeof glassesUiDispose === "function") {
        try {
          glassesUiDispose();
        } catch (_) {

        }
      }
      if (typeof deviceInfoDispose === "function") {
        try {
          deviceInfoDispose();
        } catch (_) {

        }
      }
      if (typeof locationDispose === "function") {
        try {
          locationDispose();
        } catch (_) {

        }
      }
      if (typeof distillerDispose === "function") {
        try {
          distillerDispose();
        } catch (_) {

        }
      }
      return service.stop({ logger: ctx && ctx.logger });
    },
  });
}
