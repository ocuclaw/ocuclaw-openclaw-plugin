import { isDeepStrictEqual } from "node:util";

export const HOST_CONFIG_WRITE_GATE_DEFAULTS = Object.freeze({
  pollMs: 200,
  settleMs: 1500,
  maxWaitMs: 20000,
});

function pluginsBranch(config) {
  return config && typeof config === "object" ? config.plugins : undefined;
}

export function createHostConfigWriteGate(options = {}) {
  const readLive = typeof options.readLive === "function" ? options.readLive : null;
  const startedPlugins = pluginsBranch(options.startedConfig);
  const pollMs = Number.isFinite(options.pollMs) && options.pollMs > 0
    ? options.pollMs
    : HOST_CONFIG_WRITE_GATE_DEFAULTS.pollMs;
  const settleMs = Number.isFinite(options.settleMs) && options.settleMs >= 0
    ? options.settleMs
    : HOST_CONFIG_WRITE_GATE_DEFAULTS.settleMs;
  const maxWaitMs = Number.isFinite(options.maxWaitMs) && options.maxWaitMs >= 0
    ? options.maxWaitMs
    : HOST_CONFIG_WRITE_GATE_DEFAULTS.maxWaitMs;
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const setTimer = typeof options.setTimer === "function" ? options.setTimer : setTimeout;
  const clearTimer = typeof options.clearTimer === "function" ? options.clearTimer : clearTimeout;

  let timer = null;
  let cancelled = false;
  let settled = null;
  let resolveSettled = null;

  function liveMatchesStarted() {
    if (!readLive) return true;
    try {
      return isDeepStrictEqual(pluginsBranch(readLive()), startedPlugins);
    } catch (_) {

      return true;
    }
  }

  function finish(outcome) {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
    const resolve = resolveSettled;
    resolveSettled = null;
    if (resolve) resolve(outcome);
  }

  function whenSettled() {
    if (settled) return settled;
    settled = new Promise((resolve) => {
      resolveSettled = resolve;
    });
    const startedAt = now();
    const matchedAtStart = liveMatchesStarted();
    let matchingSince = matchedAtStart ? startedAt : null;
    const tick = () => {
      timer = null;
      if (cancelled) return;
      const at = now();
      const waitedMs = at - startedAt;
      if (liveMatchesStarted()) {
        if (matchingSince === null) matchingSince = at;
        if (at - matchingSince >= settleMs) {
          finish({
            settled: true,
            reason: matchedAtStart ? "live-config-current" : "activation-committed",
            waitedMs,
          });
          return;
        }
      } else {
        matchingSince = null;
      }
      if (waitedMs >= maxWaitMs) {
        finish({ settled: false, reason: "max-wait-elapsed", waitedMs });
        return;
      }
      timer = setTimer(tick, pollMs);
    };
    timer = setTimer(tick, Math.min(pollMs, settleMs) || 0);
    return settled;
  }

  function cancel() {
    cancelled = true;
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
    resolveSettled = null;
  }

  return { whenSettled, cancel };
}
