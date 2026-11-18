import { Buffer } from "node:buffer";
import { GLASS_MESH_TYPE, MODEL_PICTURE_CODES, modelRefusedFormat,                    } from "../liveui-pictures/picture-model.js";

import { convertModelOffThread } from "./model-convert-client.js";
import { MODEL_CODES, MODEL_MAX_MAIN_JSON_BYTES, MODEL_MAX_TRIANGLES, MODEL_ZIP_CROWDED, ModelError } from "./model-limits.js";
import { listModelResources } from "./model-resources.js";
import { sniffModel, sniffModelHead } from "./model-sniff.js";
import { listZip, zipFiles, zipModel } from "./model-zip.js";

export function modelHeadOf(head        , length               )                                        {
  const sniff = sniffModelHead(head, length);
  if (sniff.kind === "refused") return { ok: false, code: MODEL_CODES.formatUnsupported, detail: sniff.format };
  if (sniff.kind !== "model") return null;
  if (typeof sniff.triangles === "number" && sniff.triangles > MODEL_MAX_TRIANGLES) return { ok: false, code: MODEL_CODES.tooBig, detail: "" };
  return "model";
}

export function modelSourceOf(bytes        )                              {
  const sniff = sniffModel(bytes);
  if (sniff.kind === "unknown") return null;
  if (sniff.kind === "refused") return { ok: false, code: MODEL_CODES.formatUnsupported, detail: sniff.format };
  let format         = sniff.format;
  if (format === "zip") {
    let held;
    try {
      held = zipModel(zipFiles(listZip(bytes)));
    } catch (err) {

      if (err instanceof ModelError && err.message === MODEL_ZIP_CROWDED) return { ok: false, code: MODEL_CODES.unreadable, detail: "" };
      return null;
    }
    if (held.kind === "none") return null;
    if (held.kind === "refused") return { ok: false, code: MODEL_CODES.formatUnsupported, detail: held.format };
    if (held.kind === "3mf") format = "3mf";
  }
  return { ok: true, bytes, mime: "application/octet-stream", type: format, width: 0, height: 0, model: format };
}

export async function convertModelSource(result                      , deps                   = {})                                {
  if (!result.ok || !result.model) return result;
  const convert = deps.convert || convertModelOffThread;
  const request = result.resources ? { bytes: result.bytes, resources: result.resources } : { bytes: result.bytes };
  const out = await convert(request, { trace: deps.trace, signal: deps.signal });
  if (out && out.ok === true && out.mesh instanceof Uint8Array && out.mesh.length > 0) {
    const mesh = Buffer.from(out.mesh.buffer, out.mesh.byteOffset, out.mesh.byteLength);
    return { ok: true, bytes: mesh, mime: GLASS_MESH_TYPE, type: String(out.format || result.model), width: 0, height: 0 };
  }
  const code = out && MODEL_PICTURE_CODES.includes(out.code) ? out.code : MODEL_CODES.unreadable;
  const format = code === MODEL_CODES.formatUnsupported ? modelRefusedFormat(String(out.format || out.detail || "")) : null;
  return { ok: false, code, detail: format || "" };
}

export function createPictureModels(opts                             = {})                {
  return {
    headOf: modelHeadOf,
    sourceOf: modelSourceOf,

    resourcesOf: (bytes) => listModelResources(bytes, MODEL_MAX_MAIN_JSON_BYTES),
    convert: (result, o) => convertModelSource(result, { convert: opts.convert, trace: o.trace, signal: o.signal }),
  };
}
