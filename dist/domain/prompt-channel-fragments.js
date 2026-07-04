const EMOJI_STOP =
  "The emoji reactor is off for the rest of this session — do not use " +
  "<emoji:X>…</emoji> spans, even if earlier replies did.";
const PACE_STOP =
  "The pace modulator is off for the rest of this session — do not use " +
  "<dwell>…</dwell> or <skim>…</skim> spans, even if earlier replies did.";
const RENDER_GATE =
  "No glasses display is connected right now; do not call render_glasses_ui.";

export function composeChannelTwoFragment(input) {
  const start = (input && input.startEnabled) || { emoji: false, pace: false };
  const current = (input && input.currentEnabled) || { emoji: false, pace: false };
  const glassesConnected = !!(input && input.glassesConnected);

  const parts = [];

  if (start.emoji && !current.emoji) parts.push(EMOJI_STOP);
  if (start.pace && !current.pace) parts.push(PACE_STOP);
  if (!glassesConnected) parts.push(RENDER_GATE);

  if (parts.length === 0) return undefined;
  return parts.join("\n\n");
}
