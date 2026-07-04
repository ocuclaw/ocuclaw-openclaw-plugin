import { composeChannelTwoFragment } from "../domain/prompt-channel-fragments.js";

export function createChannelTwoHook(service, opts = {}) {
  const emitDebug = typeof opts.emitDebug === "function" ? opts.emitDebug : () => {};
  return function channelTwoBeforePromptBuild(_event, ctx) {
    const sessionKey =
      ctx && typeof ctx.sessionKey === "string" && ctx.sessionKey.trim()
        ? ctx.sessionKey
        : null;
    if (!sessionKey) return undefined;
    try {
      const fragment = composeChannelTwoFragment({
        startEnabled: service.getDisplayStartStates(sessionKey),
        currentEnabled: service.getDisplayCurrentStates(sessionKey),
        glassesConnected:
          typeof service.hasConnectedAppClient === "function"
            ? service.hasConnectedAppClient()
            : true,
      });
      if (!fragment) return undefined;
      emitDebug("relay.session", "channel_two_fragment_injected", "debug",
        { sessionKey }, () => ({ chars: fragment.length }));
      return { appendSystemContext: fragment };
    } catch (_err) {

      return undefined;
    }
  };
}

export default createChannelTwoHook;
