import { createOcuClawRelayService } from "./runtime/relay-service.js";
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
} from "./setup/setup-controller.js";
import { registerOcuClawSetupTool } from "./setup/overview-tool.js";
import { registerOcuClawSetupCli } from "./setup/overview-cli.js";
import { createRuntimeConfigOverview } from "./config/runtime-config.js";
import { createFreshWsPortConfigWriter } from "./config/relay-port-default.js";
import {
  createRelayPortApprovalHook,
  createRelayPortMutation,
} from "./setup/relay-port-mutation.js";
import { warnTaskIndexPromptInjectionDisabledOnce } from "./runtime/task-index-prompt-injection.js";
import { projectLiveuiTaskIndexRows } from "./tools/glasses-ui-task-index.js";

export default function register(api) {
  if (api && api.registrationMode === "cli-metadata") {
    const config = createRuntimeConfigOverview({
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
      isSetupToolRegistered: () => false,
    });
    registerOcuClawSetupCli(api, controller);
    return;
  }
  if (!api || typeof api.registerService !== "function") {
    throw new Error("OcuClaw plugin requires api.registerService()");
  }

  const setupConfig = createRuntimeConfigOverview({
    pluginConfig: api.pluginConfig,
    openclawConfig: api.config,
  });
  const relayTokenConfigured = !!setupConfig.relayToken;
  warnTaskIndexPromptInjectionDisabledOnce(api.config, api.logger);

  const service = createOcuClawRelayService({
    logger: api.logger,
    pluginConfig: api.pluginConfig,
    openclawConfig: api.config,
    persistFreshWsPortConfig: createFreshWsPortConfigWriter(api),
  });
  let setupToolRegistered = false;
  const registration = classifySetupRegistration(api.registrationMode);
  const controller = createSetupController({
    api,
    service,
    isSetupToolRegistered: () => setupToolRegistered,
    ...registration,
  });
  registerOcuClawSetupCli(api, controller);

  if (typeof api.on === "function") {
    api.on("before_tool_call", createRelayPortApprovalHook());
  }
  if (relayTokenConfigured && typeof api.on === "function") {
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

  let glassesUiDispose = null;
  let deviceInfoDispose = null;
  let locationDispose = null;
  let distillerDispose = null;
  if (typeof api.registerTool === "function") {
    registerOcuClawSetupTool(api, controller, createRelayPortMutation(api));
    setupToolRegistered = true;
    if (relayTokenConfigured) {
      glassesUiDispose = registerGlassesUiTool(api, service);
      registerSessionTitleTool(api, service);
      deviceInfoDispose = registerDeviceInfoTool(api, service);
      locationDispose = registerLocationTool(api, service);
      distillerDispose = registerSessionTitleDistiller(api, service);
    }
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
