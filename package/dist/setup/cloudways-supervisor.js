import {
  clearNeedsAuthorizationMarker,
  daemonState,
  detect,
  DETECT_CLOUDWAYS,
  readCloudwaysState,
  RECEIPT_PROVISIONER,
  resolveLayout,
  startDaemon,
  STATE_NEEDS_AUTH,
  STATE_RUNNING,
} from "./cloudways.js";
import { readTailscaleCliReceipt } from "./private-route.js";

export const SUPERVISOR_INTERVAL_MS = 60000;

export const SUPERVISED_PROVISIONERS = [RECEIPT_PROVISIONER];

export function supervisionDecision(layout     ) {
  const receipt = readTailscaleCliReceipt(layout.hostStateDir);
  if (receipt === null) return { supervise: false, reason: "no-tailscale-cli-receipt" };
  const state = readCloudwaysState(layout);
  if (state === null) return { supervise: false, reason: "no-cloudways-state" };
  if (state.enabled === false) return { supervise: false, reason: "supervision-disabled" };
  if (!SUPERVISED_PROVISIONERS.includes(receipt.provisioner)) {
    return { supervise: false, reason: `receipt-provisioned-by-${receipt.provisioner}` };
  }
  return { supervise: true, reason: "receipt-and-state-agree" };
}

export async function superviseOnce(deps      = {}) {
  const layout = deps.layout || resolveLayout(deps.layoutOptions || {});
  const decide = typeof deps.decide === "function" ? deps.decide : supervisionDecision;
  const decision = decide(layout);
  if (!decision.supervise) return { action: "skipped", reason: decision.reason };
  const observe = typeof deps.daemonState === "function" ? deps.daemonState : daemonState;
  const observed = await observe(layout, deps);
  if (observed.state === STATE_RUNNING) {

    const cleared = typeof deps.clearNeedsAuthorizationMarker === "function"
      ? deps.clearNeedsAuthorizationMarker(layout)
      : clearNeedsAuthorizationMarker(layout);
    return { action: "kept", reason: "daemon-running", state: observed.state, markerCleared: cleared };
  }
  if (observed.state === STATE_NEEDS_AUTH) {

    return { action: "needs-authorization", reason: "daemon-awaiting-authorization", state: observed.state };
  }
  const start = typeof deps.startDaemon === "function" ? deps.startDaemon : startDaemon;
  const result = await start(layout, deps);
  return { action: result.action, reason: "daemon-not-answering", state: result.state, detail: result.detail || "" };
}

export function createCloudwaysSupervisor(options      = {}) {
  const logger = options.logger || { info() {}, warn() {}, error() {} };
  const intervalMs = Number.isFinite(options.intervalMs) && options.intervalMs > 0
    ? options.intervalMs
    : SUPERVISOR_INTERVAL_MS;
  const schedule = typeof options.setInterval === "function" ? options.setInterval : setInterval;
  const unschedule = typeof options.clearInterval === "function" ? options.clearInterval : clearInterval;
  const pass = typeof options.superviseOnce === "function" ? options.superviseOnce : superviseOnce;
  const detectHost = typeof options.detect === "function" ? options.detect : detect;
  let timer      = null;
  let running = false;
  let last      = null;

  async function onCloudwaysHost() {
    try {
      const detected = await detectHost(options);
      return detected && detected.verdict === DETECT_CLOUDWAYS;
    } catch (error     ) {
      logger.warn(`[ocuclaw] cloudways detection failed: ${String((error && error.message) || error)}`);
      return false;
    }
  }

  async function tick(reason     ) {

    if (running) return last;
    running = true;
    try {
      last = await pass(options);
      if (last.action === "started") {
        logger.info(`[ocuclaw] cloudways supervisor started tailscaled (${reason}): ${last.state}`);
      } else if (last.action === "start-failed" || last.action === "refused") {
        logger.warn(`[ocuclaw] cloudways supervisor could not start tailscaled: ${last.detail || last.reason}`);
      } else if (last.action === "needs-authorization") {
        logger.warn("[ocuclaw] cloudways tailscaled needs authorization: run `openclaw ocuclaw cloudways retry`");
      }
      return last;
    } catch (error     ) {

      logger.warn(`[ocuclaw] cloudways supervisor pass failed: ${String((error && error.message) || error)}`);
      last = { action: "failed", reason: String((error && error.message) || error) };
      return last;
    } finally {
      running = false;
    }
  }

  return {
    async start() {
      if (timer) return last;
      const first = await tick("relay-service-start");

      if (first && first.action === "skipped" && !(await onCloudwaysHost())) return first;
      timer = schedule(() => { void tick("interval"); }, intervalMs);
      if (timer && typeof timer.unref === "function") timer.unref();
      return first;
    },
    stop() {

      if (!timer) return;
      unschedule(timer);
      timer = null;
    },
    get lastResult() { return last; },
    get supervising() { return timer !== null; },
  };
}
