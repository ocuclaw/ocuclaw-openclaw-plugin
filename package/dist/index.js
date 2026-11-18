import { createOcuClawRelayService } from "./runtime/relay-service.js";
import { configuredOpenReplyRoute, configuredReplyModels, createModelTokenPriceLookup, createReplyModelPriceLookup, probeLlmCompleteOptions, runtimeOnlyModelMatcher } from "./gateway/input-prediction-openclaw.js";
import { registerOpenclawRunSignalHooks } from "./gateway/openclaw-run-signals.js";
import { createClaudeCodeThinkingDisplay } from "./gateway/claude-code-thinking-display.js";
import { saveInputPredictionModelAllow } from "./setup/optional-credential-store.js";
import { createEvenAiModelHook } from "./even-ai/even-ai-model-hook.js";
import { createEvenAiAskUserGuard } from "./even-ai/even-ai-ask-user-guard.js";
import { createChannelTwoHook } from "./runtime/channel-two-hook.js";
import {
  getRegisteredLiveuiGlassesLibraryController,
  registerGlassesUiTool,
} from "./tools/glasses-ui-tool.js";
import { registerSessionTitleTool } from "./tools/session-title-tool.js";
import { cardAskGame, cardAskGate, cardAskPlan, registerCardAskTool, spendCardAsk } from "./tools/program-card-ask-tool.js";
import { useOpenClawRunCommand } from "./tools/host-process.js";
import { registerDeviceInfoTool } from "./tools/device-info-tool.js";
import { registerPhoneSettingsTools } from "./tools/phone-settings-tool.js";
import { registerLocationTool } from "./tools/location-tool.js";
import { registerSaveGlassesCardTool } from "./tools/save-glasses-card-tool.js";
import { prepareProgramCardFrameIdea, registerProgramCardTool, resolveToolSessionKey } from "./tools/program-card-tool.js";
import { cardStudioRecordingApi } from "./tools/card-studio-record.js";
import { programCardImageModel } from "./tools/program-card-look.js";
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
import { configuredPhoneAddress } from "./setup/custom-route.js";
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
  createRelayCredentialReloadAfterMint,
  MINT_ON_LOAD_AFTER_WRITE,
  mintOnLoadSupported,
} from "./setup/relay-credential-mint-on-load.js";
import { createHostConfigWriteGate } from "./setup/host-config-write-gate.js";
import {
  conversationAccessOwedAtLoad,
  createConversationAccessGrantOnLoad,
} from "./setup/conversation-access.js";
import { createSetupApprovalHook } from "./setup/setup-approval.js";
import { createSetupChatApprovals } from "./setup/setup-chat-approvals.js";
import { createSetupNext } from "./setup/setup-next.js";
import { createAutomationRunGuardHook, cronJobOfSessionKey } from "./runtime/openclaw-automation-run-guard.js";
import { createTaskToolResultObserver, createTaskUsesGuardHook } from "./runtime/openclaw-task-uses-guard.js";
import { createOpenClawTaskReadMarks } from "./runtime/openclaw-task-read-marks.js";
import { registerSetupFirstUseControl, registerSetupWelcomeControl, createFirstUseTool, createFirstUseWakeGuardHook } from "./setup/first-use-command.js";
import { warnTaskIndexPromptInjectionDisabledOnce } from "./runtime/task-index-prompt-injection.js";
import { projectLiveuiTaskIndexRows } from "./tools/glasses-ui-task-index.js";
import { createTokenUsageTelemetry } from "./runtime/token-usage-telemetry.js";
import { createOpenClawProgramCardMcpHost } from "./runtime/program-card-mcp-hosts.js";
import { createOpenClawProgramCardModelHost } from "./runtime/program-card-model-hosts.js";
import { ensureCodexRequestCompressionOff } from "./setup/codex-request-compression.js";

function gatewayProcessEnv() {
  const runtime      = globalThis;
  return runtime.process && runtime.process.env ? runtime.process.env : {};
}

export default function register(api) {

  useOpenClawRunCommand(api);
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

  let optionalSetupService      = null;
  const service = createOcuClawRelayService({

    readPhoneAddress: () => configuredPhoneAddress(api),
    optionalSetup: {
      handle: (request     , context     ) => optionalSetupService?.handle(request, context),
      disconnect: (connectionId     ) => optionalSetupService?.disconnect(connectionId),
    },
    setupStateDir: resolveSetupStateDir(api),

    programCardMcpHost: createOpenClawProgramCardMcpHost(api),
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

    reloadAfterRelayCredentialMint:
      !relayTokenConfigured && mintOnLoadSupported(api)
        ? createRelayCredentialReloadAfterMint(api)
        : undefined,

    grantConversationAccessAtLoad: conversationAccessOwedAtLoad(api, api.config)
      ? createConversationAccessGrantOnLoad(api)
      : undefined,

    createConfigWriteGate:
      typeof api?.runtime?.config?.current === "function"
        ? (startedConfig     ) =>
            createHostConfigWriteGate({
              readLive: () => api.runtime.config.current(),
              startedConfig,
            })
        : undefined,
    onRelayCredentialAdopted: () => {
      relayCredentialAdopted = true;
      registerCredentialGatedSurfaces();
    },

    programCardModelHost: createOpenClawProgramCardModelHost(api),
    inputPrediction: {

      reviewImageModel: (actual     ) => {
        const config = typeof api?.runtime?.config?.current === "function" ? api.runtime.config.current() : api.config;

        const selected = programCardImageModel(config, { provider: actual?.provider, model: actual?.model },
          (provider        , model        ) => service.getHostModelInput?.(provider, model) ?? null);
        return { provider: actual?.provider, model: actual?.model, modelInput: selected.input };
      },

      reviewModelPrice: createModelTokenPriceLookup({ getConfig: () => api.config }),
      completionRoute: (identity     ) => configuredOpenReplyRoute(api.config, identity),

      configuredModels: (identity     ) => configuredReplyModels(api.config, identity),

      allowModel: (ref     ) => saveInputPredictionModelAllow(api, ref),

      providerAuth: async (provider     ) => {
        const modelAuth = api && api.runtime && api.runtime.modelAuth;
        if (!modelAuth || typeof modelAuth.resolveApiKeyForProvider !== "function") return null;
        try {
          const auth = await modelAuth.resolveApiKeyForProvider({ provider, cfg: api.config });
          return Boolean(auth && ((typeof auth.apiKey === "string" && auth.apiKey) || auth.mode === "aws-sdk"));
        } catch {
          return false;
        }
      },

      authExemptModel: (ref     , identity     ) => runtimeOnlyModelMatcher(api.config, identity)(ref),

      modelPrice: createReplyModelPriceLookup({ getConfig: () => api.config }),
      logger: api.logger,
      llmComplete: (() => {
        const llm = api && api.runtime && api.runtime.llm;
        if (!llm || typeof llm.complete !== "function") return undefined;
        return (params     ) => llm.complete(params);
      })(),
      optionSupport: (() => {
        const llm = api && api.runtime && api.runtime.llm;
        return llm && typeof llm.complete === "function"
          ? probeLlmCompleteOptions(llm.complete)
          : undefined;
      })(),
      policy: () => {
        const cfg = api?.runtime?.config?.current?.() || api.config;
        const entries = cfg?.plugins?.entries;
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

  const cardSetup = () => (typeof service.programCardSetupCheck === "function" ? service.programCardSetupCheck() : null);
  registerOcuClawSetupCli(api, controller, createTerminalPairingCommand(api, controller), cardSetup);

  optionalSetupService = createOptionalSetupService(api, {
    readLoaded: () => service.getRelay() ? service.getRuntimeConfig() : null,
    readCardSwitches: () => service.programCardSwitches(),
    applyCardSwitches: (values     ) => service.applyProgramCardSwitches(values),
    applyLiveuiJev: (values     ) => service.applyLiveuiJev(values),
    readFirstUse: () => createFirstUseStore(resolveSetupStateDir(api)).read(),
    readJourney: () => controller("journey", { surface: "phone" }),
  });

  const evenAiAskUserGuard = createEvenAiAskUserGuard({
    onBlocked: ({ runId, sessionKey }     ) =>
      service.emitDebug("evenai", "ask_user_blocked", "info", { sessionKey, runId }),
  });

  const automationRunGuard = createAutomationRunGuardHook({
    enabled: () => service.openClawTaskSchedulesOn?.() === true,
    onRefused: ({ toolName, jobId }     ) =>
      service.emitDebug("glasses.lifecycle", "automation_glasses_refused", "info", null, () => ({ toolName, jobId })),
  });

  const taskUsesGuard = createTaskUsesGuardHook(api, service, {
    readMarks: createOpenClawTaskReadMarks(api),
    onRefused: ({ toolName, taskId, mode }     ) =>
      service.emitDebug("glasses.lifecycle", "task_step_refused", "info", null, () => ({ toolName, taskId, mode })),
  });

  if (typeof api.on === "function") {
    api.on("before_tool_call", createSetupApprovalHook([
      createFirstUseWakeGuardHook(service),
      evenAiAskUserGuard.beforeToolCall,
      automationRunGuard,
      taskUsesGuard,

    ], { stateDir: () => resolveSetupStateDir(api) }));
  }

  let glassesUiDispose      = null;
  let deviceInfoDispose      = null;
  let locationDispose      = null;
  let programCardDispose      = null;
  let distillerDispose      = null;
  let credentialGatedSurfacesRegistered = false;

  function registerCredentialGatedSurfaces() {
    if (credentialGatedSurfacesRegistered) return;
    credentialGatedSurfacesRegistered = true;
    if (typeof api.on === "function") {

      const tokenUsage = createTokenUsageTelemetry({
        emitDebug: (...a     ) => service.emitDebug(...a),
      });
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

            isAutomationRun: (k     ) => service.openClawTaskSchedulesOn?.() === true && cronJobOfSessionKey(k) !== null,
            hasSecretEntryClient: () => service.hasConnectedAppClientCapability("secretEntryV1") === true,

            isAgentBootstrapPending: () => service.isAgentBootstrapPending?.() === true,
            consumePromptTurnOwnership: evenAiAskUserGuard.observePromptTurnOwnership(
              (k     , identity     ) => service.consumePromptTurnOwnership(k, identity),
            ),

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
          {
            emitDebug: (...a) => service.emitDebug(...a),
            getStableContextPlacement: () =>
              service.getRuntimeConfig?.()?.tokenEfficiency?.stableContextPlacement,
            getSessionHarness: (k     , p     , m     ) => tokenUsage.harnessFor(k, p, m),
          },
        ),
      );

      api.on("llm_output", tokenUsage.onLlmOutput);
      let detailedTelemetry = false;
      try {
        detailedTelemetry = service.getRuntimeConfig?.()?.tokenEfficiency?.detailedTelemetry === true;
      } catch (_err) {

      }
      if (detailedTelemetry) {
        api.on("llm_input", tokenUsage.onLlmInput);
        api.on("after_tool_call", tokenUsage.onAfterToolCall);
      }

      api.on("before_message_write", createTaskToolResultObserver(api, service));

      registerOpenclawRunSignalHooks(api, () => service.getRelay());

      api.on("cron_reconciled", (event     ) => {
        service.noteOpenClawCronEnabled?.(event && event.enabled);
      });

      api.on("before_agent_finalize", (event     , ctx     ) => {
        service.noteOpenClawAgentFinalize?.(event, ctx);
        return undefined;
      });
      api.on("cron_changed", (event     ) => {
        service.noteOpenClawCronChanged?.(event);
      });

      const claudeCodeThinkingDisplay = createClaudeCodeThinkingDisplay(process.env);
      api.on("before_prompt_build", (event     , ctx     ) => {
        try {
          service.noteOpenClawRunModel?.(ctx);
          claudeCodeThinkingDisplay(ctx);
          return service.openClawTaskRunContext?.(event, ctx);
        } catch (_err) {

          return undefined;
        }
      });
    }
    if (typeof api.registerTool === "function") {

      glassesUiDispose = registerGlassesUiTool(api, service, {
        isEvenAiRun: evenAiAskUserGuard.isEvenAiRun,
      });
      registerSessionTitleTool(api, service);

      const cardStudioApi = cardStudioRecordingApi(api, service, (ctx     ) => resolveToolSessionKey(ctx, service));

      registerCardAskTool(cardStudioApi, service, { onGameYes: (sessionKey        , game     ) => { prepareProgramCardFrameIdea(sessionKey, game); } });
      deviceInfoDispose = registerDeviceInfoTool(api, service);
      registerPhoneSettingsTools(api, service);
      locationDispose = registerLocationTool(api, service);
      registerSaveGlassesCardTool(cardStudioApi, service);

      programCardDispose = registerProgramCardTool(cardStudioApi, service, {
        askGate: cardAskGate,
        askPlan: (sessionKey        ) => cardAskPlan(sessionKey),
        askGame: (sessionKey        ) => cardAskGame(sessionKey),
        onCardWritten: (sessionKey        ) => spendCardAsk(sessionKey),
      });
      distillerDispose = registerSessionTitleDistiller(api, service);
    }
  }

  if (typeof api.registerTool === "function") {
    const firstUseTool = createFirstUseTool(api, undefined, service);
    registerOcuClawSetupTool(
      api,
      controller,
      createRelayPortMutation(api),

      createRelayCredentialProvision(api, {
        relayCredentialLoadedAtBoot: () => relayCredentialAdopted,
      }),
      firstUseTool,

      (ctx     , operation     ) => {
        const session = firstUseSetupSessionFromContext(ctx);
        if (session) service.getRelay?.()?.noteSetupSession?.(operation === "next" ? { ...session, via: "next" } : session);
      },

      createSetupChatApprovals(api, controller, {
        adoptedRelayCredential: () => {
          if (!relayCredentialAdopted || !service.getRelay()) return null;
          const token = service.getRuntimeConfig()?.relayToken;
          return typeof token === "string" && token ? token : null;
        },
      }),

      createSetupNext(api, controller, firstUseTool, {

        readJevSnapshot: () => optionalSetupService?.statusSnapshot() ?? null,

        readCardTools: (opts     ) => (typeof service.programCardToolsSetup === "function" ? service.programCardToolsSetup(opts) : null),
      }),
      cardSetup,
    );
    setupToolRegistered = true;
  }
  if (relayTokenConfigured) {
    registerCredentialGatedSurfaces();
  }

  api.registerService({
    id: "ocuclaw-relay",
    start: (ctx) => {

      void ensureCodexRequestCompressionOff(api, ctx && ctx.stateDir).then((result     ) => {
        if (result && result.status === "set") api.logger?.info?.("[ocuclaw] Codex request compression turned off for OpenClaw's Codex engine (#7156)");
      });
      return service.start({
        logger: ctx && ctx.logger,
        stateDir: ctx && ctx.stateDir,
        config: ctx && ctx.config,
      });
    },
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
      if (typeof programCardDispose === "function") {
        try {
          programCardDispose();
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
