export const UPLOAD_CAPTURE_PRESET = [
  "sdk.frames", "render.header_animation", "render.virtual_pager.diagnostics", "render.ownership",
  "screen.nav", "app.lifecycle", "voice.timeline", "voice.transport",
  "relay.session", "relay.protocol", "relay.health", "relay.worker.health", "relay.operation", "relay.transport",
  "glasses.lifecycle", "openclaw.run", "openclaw.message", "evenai",
];

export function startUploadCaptureArming(deps) {
  if (!deps.gatesOn()) return () => {};

  const preset =
    deps.preset && Array.isArray(deps.preset) && deps.preset.length ? deps.preset : UPLOAD_CAPTURE_PRESET;

  const armSafely = () => {
    try {
      deps.armCategories(preset, deps.maxTtlMs);
    } catch (err) {
      if (deps.onArmError) deps.onArmError(err);
    }
  };
  armSafely();
  const handle = deps.setInterval(() => {
    if (deps.gatesOn()) armSafely();
  }, Math.round(0.8 * deps.maxTtlMs));
  handle.unref();
  return () => deps.clearInterval(handle);
}
