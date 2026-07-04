import { createOcuClawRelayService } from "./runtime/relay-service.js";
import { createEvenAiModelHook } from "./even-ai/even-ai-model-hook.js";
import { createChannelTwoHook } from "./runtime/channel-two-hook.js";
import { registerGlassesUiTool } from "./tools/glasses-ui-tool.js";
import { registerSessionTitleTool } from "./tools/session-title-tool.js";
import { registerDeviceInfoTool } from "./tools/device-info-tool.js";
import { registerSessionTitleDistiller } from "./runtime/register-session-title-distiller.js";

export default function register(api) {
  if (!api || typeof api.registerService !== "function") {
    throw new Error("OcuClaw plugin requires api.registerService()");
  }

  const service = createOcuClawRelayService({
    logger: api.logger,
    pluginConfig: api.pluginConfig,
    openclawConfig: api.config,
  });

  if (typeof api.on === "function") {
    api.on(
      "before_model_resolve",
      createEvenAiModelHook({
        getSettingsSnapshot() {
          return service.getEvenAiSettingsSnapshot();
        },
        getDedicatedSessionKey() {
          return service.getRuntimeConfig().evenAiDedicatedSessionKey;
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
        },
        { emitDebug: (...a) => service.emitDebug(...a) },
      ),
    );
  }

  let glassesUiDispose = null;
  let deviceInfoDispose = null;
  let distillerDispose = null;
  if (typeof api.registerTool === "function") {
    glassesUiDispose = registerGlassesUiTool(api, service);
    registerSessionTitleTool(api, service);
    deviceInfoDispose = registerDeviceInfoTool(api, service);
    distillerDispose = registerSessionTitleDistiller(api, service);
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
