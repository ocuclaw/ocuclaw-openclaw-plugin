export const MODEL_MAX_TRIANGLES = 2_000_000;

export const MODEL_MAX_POINTS = 4_000_000;
export const MODEL_MAX_LINES = 2_000_000;

export const MODEL_MAX_VERTICES = 6_000_000;

export const MODEL_MAX_ACCESSOR_BYTES = 256 * 1024 * 1024;

export const MODEL_TARGET_TRIANGLES = 10_000;

export const MODEL_TARGET_POINTS = 12_000;
export const MODEL_TARGET_LINES = 6_000;

export const MODEL_MAX_INFLATED_BYTES = 256 * 1024 * 1024;

export const MODEL_MAX_ZIP_ENTRIES = 10_000;

export const MODEL_ZIP_CROWDED = "zip has too many entries";

export const MODEL_MAX_MAIN_JSON_BYTES = 1024 * 1024;

export const MODEL_CONVERT_TIMEOUT_MS = 30_000;

export const GLASS_MESH_TYPE = "model/x-ocuclaw-glass-mesh";

export const MODEL_CODES = {
  formatUnsupported: "model_format_unsupported",
  tooBig: "model_too_big",
  unreadable: "model_unreadable",
  empty: "model_empty",

  needsLogin: "model_needs_login",
  needsDownload: "model_needs_download",
  needsReconnect: "model_needs_reconnect",
  downloadUnavailable: "model_download_unavailable",
  rateLimited: "model_rate_limited",
  providerUnavailable: "model_provider_unavailable",
  scopeRefused: "model_scope_refused",
  importCancelled: "model_import_cancelled",
}         ;

export class ModelError extends Error {
  code        ;
  format                    ;
  constructor(code        , detail        , format         ) {
    super(detail);
    this.code = code;
    this.format = format;
  }
}
