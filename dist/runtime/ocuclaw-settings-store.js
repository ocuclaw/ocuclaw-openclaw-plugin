import * as fs from "node:fs";
import * as path from "node:path";

const STORE_VERSION = 1;
const STORE_FILENAME = "ocuclaw-settings.json";
const PERSIST_DEBOUNCE_MS = 250;

function normalizeLogger(logger) {
  if (!logger || typeof logger !== "object") {
    return console;
  }
  return {
    info: typeof logger.info === "function" ? logger.info.bind(logger) : console.log,
    warn: typeof logger.warn === "function" ? logger.warn.bind(logger) : console.warn,
    error: typeof logger.error === "function" ? logger.error.bind(logger) : console.error,
    debug:
      typeof logger.debug === "function" ? logger.debug.bind(logger) : console.debug,
  };
}

function normalizeTrimmedString(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

export function normalizeOcuClawSystemPrompt(value) {
  return normalizeTrimmedString(value);
}

export function normalizeOcuClawDefaultModel(value) {
  return normalizeTrimmedString(value);
}

export function normalizeOcuClawDefaultThinking(value) {
  const normalized = normalizeTrimmedString(value).toLowerCase();
  if (
    normalized === "" ||
    normalized === "off" ||
    normalized === "minimal" ||
    normalized === "low" ||
    normalized === "medium" ||
    normalized === "high" ||
    normalized === "xhigh"
  ) {
    return normalized;
  }
  return "";
}

export function normalizeOcuClawDefaultFastMode(value) {
  return value === true;
}

export function normalizeOcuClawDefaultAgent(value) {
  return normalizeTrimmedString(value);
}

function isStoredSnapshotCanonical(value, snapshot) {
  if (!value || typeof value !== "object") {
    return false;
  }
  return (
    normalizeTrimmedString(value.systemPrompt) === snapshot.systemPrompt &&
    normalizeTrimmedString(value.defaultModel) === snapshot.defaultModel &&
    normalizeOcuClawDefaultThinking(value.defaultThinking) === snapshot.defaultThinking &&
    normalizeOcuClawDefaultFastMode(value.defaultFastMode) === snapshot.defaultFastMode &&
    normalizeOcuClawDefaultAgent(value.defaultAgent) === snapshot.defaultAgent
  );
}

export function normalizeOcuClawSettingsSnapshot(value = {}) {
  return {
    systemPrompt: normalizeOcuClawSystemPrompt(value.systemPrompt),
    defaultModel: normalizeOcuClawDefaultModel(value.defaultModel),
    defaultThinking: normalizeOcuClawDefaultThinking(value.defaultThinking),
    defaultFastMode: normalizeOcuClawDefaultFastMode(value.defaultFastMode),
    defaultAgent: normalizeOcuClawDefaultAgent(value.defaultAgent),
  };
}

function hasOwn(obj, key) {
  return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

export function createOcuClawSettingsStore(opts = {}) {
  const logger = normalizeLogger(opts.logger);
  const emitDebug = typeof opts.emitDebug === "function" ? opts.emitDebug : () => {};
  const now = typeof opts.now === "function" ? opts.now : () => Date.now();
  const defaults = normalizeOcuClawSettingsSnapshot(opts.defaults || {});
  const statePath =
    typeof opts.statePath === "string" && opts.statePath.trim()
      ? opts.statePath.trim()
      : typeof opts.stateDir === "string" && opts.stateDir.trim()
        ? path.join(opts.stateDir.trim(), STORE_FILENAME)
        : null;

  let pendingWrite = null;
  let pendingWriteTimer = null;
  let writeInFlight = false;

  async function writeSnapshotToDisk(snapshot, reason) {
    const payload =
      JSON.stringify(
        {
          version: STORE_VERSION,
          updatedAtMs: now(),
          settings: snapshot,
        },
        null,
        2,
      ) + "\n";
    const tmpPath = `${statePath}.tmp`;
    try {
      await fs.promises.mkdir(path.dirname(statePath), { recursive: true });
      await fs.promises.writeFile(tmpPath, payload);
      await fs.promises.rename(tmpPath, statePath);
      emitDebug(
        "settings.loadsave",
        "ocuclaw_settings_persisted",
        "info",
        null,
        () => ({
          reason,
          statePath,
          systemPromptChars: snapshot.systemPrompt.length,
          defaultModel: snapshot.defaultModel,
          defaultThinking: snapshot.defaultThinking,
          defaultFastMode: snapshot.defaultFastMode,
        }),
      );
    } catch (err) {
      logger.error(
        `[ocuclaw] failed to persist OcuClaw settings: ${err && err.message ? err.message : err}`,
      );
      emitDebug(
        "settings.loadsave",
        "ocuclaw_settings_persist_failed",
        "warn",
        null,
        () => ({
          reason,
          statePath,
          message: err && err.message ? err.message : String(err),
        }),
      );
    }
  }

  function flushPendingWrite() {
    if (writeInFlight || !pendingWrite) {
      return;
    }
    const { snapshot, reason } = pendingWrite;
    pendingWrite = null;
    writeInFlight = true;
    writeSnapshotToDisk(snapshot, reason).finally(() => {
      writeInFlight = false;
      if (pendingWrite) {
        flushPendingWrite();
      }
    });
  }

  function persistSnapshot(snapshot, reason) {
    if (!statePath) {
      emitDebug(
        "settings.loadsave",
        "ocuclaw_settings_persist_skipped",
        "debug",
        null,
        () => ({
          reason,
          systemPromptChars: snapshot.systemPrompt.length,
          defaultModel: snapshot.defaultModel,
          defaultThinking: snapshot.defaultThinking,
          defaultFastMode: snapshot.defaultFastMode,
        }),
      );
      return;
    }

    pendingWrite = { snapshot, reason };
    if (pendingWriteTimer) {
      clearTimeout(pendingWriteTimer);
    }
    pendingWriteTimer = setTimeout(() => {
      pendingWriteTimer = null;
      flushPendingWrite();
    }, PERSIST_DEBOUNCE_MS);
  }

  function loadInitialSnapshot() {
    if (!statePath || !fs.existsSync(statePath)) {
      persistSnapshot(defaults, "seed_defaults");
      return { ...defaults };
    }

    try {
      const raw = fs.readFileSync(statePath, "utf8");
      const parsed = JSON.parse(raw);
      const storedSettings =
        parsed && parsed.settings && typeof parsed.settings === "object"
          ? parsed.settings
          : null;
      const loaded =
        parsed && parsed.version === STORE_VERSION && storedSettings
          ? normalizeOcuClawSettingsSnapshot(storedSettings)
          : defaults;
      emitDebug(
        "settings.loadsave",
        "ocuclaw_settings_loaded",
        "info",
        null,
        () => ({
          statePath,
          systemPromptChars: loaded.systemPrompt.length,
          defaultModel: loaded.defaultModel,
          defaultThinking: loaded.defaultThinking,
          defaultFastMode: loaded.defaultFastMode,
        }),
      );
      if (
        parsed.version !== STORE_VERSION ||
        !isStoredSnapshotCanonical(storedSettings, loaded)
      ) {
        persistSnapshot(loaded, "normalize_loaded_settings");
      }
      return loaded;
    } catch (err) {
      logger.warn(
        `[ocuclaw] failed to load OcuClaw settings, falling back to defaults: ${err && err.message ? err.message : err}`,
      );
      emitDebug(
        "settings.loadsave",
        "ocuclaw_settings_load_failed",
        "warn",
        null,
        () => ({
          statePath,
          message: err && err.message ? err.message : String(err),
        }),
      );
      persistSnapshot(defaults, "rewrite_after_load_failure");
      return { ...defaults };
    }
  }

  let snapshot = loadInitialSnapshot();

  return {
    getStatePath() {
      return statePath;
    },

    getSnapshot() {
      return { ...snapshot };
    },

    async setSettings(patch = {}) {
      const next = {
        systemPrompt: hasOwn(patch, "systemPrompt")
          ? normalizeOcuClawSystemPrompt(patch.systemPrompt)
          : snapshot.systemPrompt,
        defaultModel: hasOwn(patch, "defaultModel")
          ? normalizeOcuClawDefaultModel(patch.defaultModel)
          : snapshot.defaultModel,
        defaultThinking: hasOwn(patch, "defaultThinking")
          ? normalizeOcuClawDefaultThinking(patch.defaultThinking)
          : snapshot.defaultThinking,
        defaultFastMode: hasOwn(patch, "defaultFastMode")
          ? normalizeOcuClawDefaultFastMode(patch.defaultFastMode)
          : snapshot.defaultFastMode,
        defaultAgent: hasOwn(patch, "defaultAgent")
          ? normalizeOcuClawDefaultAgent(patch.defaultAgent)
          : snapshot.defaultAgent,
      };
      snapshot = next;
      persistSnapshot(snapshot, "set_settings");
      return {
        status: "accepted",
        settings: { ...snapshot },
      };
    },
  };
}

export default createOcuClawSettingsStore;
