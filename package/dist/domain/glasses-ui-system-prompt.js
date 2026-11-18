import { LIVEUI_RECORDS_BLOCK } from "./glasses-ui-records-block.generated.js";
import { withCodePlateLines } from "../tools/liveui-registry/components/draw.js";

const hostEnv = ()      => Reflect.get(globalThis, "process")?.env ?? {};

export function composeGlassesUiChannelOne(env      = hostEnv(), phoneCodePlate = false) {
  return phoneCodePlate || codePlateEnabled(env) ? withCodePlateLines(LIVEUI_RECORDS_BLOCK) : LIVEUI_RECORDS_BLOCK;
}

export function codePlateEnabled(env      = hostEnv()) {
  return env.OCUCLAW_LIVEUI_CODE_PLATE === "1";
}

export const CODE_PLATE_CAPABILITY = "liveuiCodePlateV1";

export const RETIRED_V1_CHANNEL_ONE_MARKER = "If render_glasses_ui is not in your current tool list";
