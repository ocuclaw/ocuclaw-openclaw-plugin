export const HERMES_SESSION_KEY_PREFIX = "hermes:";

export const DEFAULT_HERMES_NAMESPACE = "main";

export function hermesProfileIdForNamespace(namespace) {
  const normalized = normalizeSegment(namespace);
  return normalized === DEFAULT_HERMES_NAMESPACE ? "default" : normalized;
}

export const HERMES_FOREIGN_KEY_MARKER = "x";

export const OCUCLAW_PLATFORM_SEGMENT = "ocuclaw";
export const OCUCLAW_CHAT_TYPE_SEGMENT = "dm";

const AGENT_KEY_PREFIX = "agent:";

export function isHermesSessionKey(key) {
  return (
    typeof key === "string" &&
    key.toLowerCase().startsWith(HERMES_SESSION_KEY_PREFIX)
  );
}

export function isForeignHermesSessionKey(key) {
  if (typeof key !== "string") return false;
  const segments = key.trim().toLowerCase().split(":");
  return (
    segments.length >= 4 &&
    segments[0] === "hermes" &&
    segments[2] === HERMES_FOREIGN_KEY_MARKER
  );
}

export const ADOPTABLE_FOREIGN_SOURCES = Object.freeze(["desktop", "cli", "tui"]);

export function isAdoptableHermesSessionKey(key) {
  if (!isForeignHermesSessionKey(key)) return false;
  const segments = key.trim().toLowerCase().split(":");
  return (
    segments.length === 5 &&
    ADOPTABLE_FOREIGN_SOURCES.includes(segments[3]) &&
    segments[4].length > 0
  );
}

export const ADOPT_CHAT_ID_PREFIX = "adopt-";

export function isAdoptedHermesSessionKey(key) {
  const parsed = parseHermesPublicKey(typeof key === "string" ? key.trim() : "");
  return !!(
    parsed &&
    parsed.kind === "minted" &&
    typeof parsed.chatId === "string" &&
    parsed.chatId.toLowerCase().startsWith(ADOPT_CHAT_ID_PREFIX) &&
    parsed.chatId.length > ADOPT_CHAT_ID_PREFIX.length
  );
}

export function mintedHermesSessionKey(chatId, namespace) {
  const ns = normalizeSegment(namespace) || DEFAULT_HERMES_NAMESPACE;
  const chat = typeof chatId === "string" ? chatId.trim() : "";
  if (!chat || chat.includes(":") || chat === HERMES_FOREIGN_KEY_MARKER) {
    throw new Error(
      `minted hermes chatId must be a single non-marker segment; got ${JSON.stringify(chatId)}`,
    );
  }
  return `${HERMES_SESSION_KEY_PREFIX}${ns}:${chat}`;
}

export function hermesDefaultSessionKeyPrefix(namespace) {
  const ns = normalizeSegment(namespace) || DEFAULT_HERMES_NAMESPACE;
  return `${HERMES_SESSION_KEY_PREFIX}${ns}:`;
}

export function hermesSupportedSessionKeyPrefixes() {
  return [HERMES_SESSION_KEY_PREFIX];
}

export function stripAgentNamespace(sessionKey) {
  if (typeof sessionKey !== "string") return null;
  if (!sessionKey.startsWith(AGENT_KEY_PREFIX)) return null;
  const rest = sessionKey.slice(AGENT_KEY_PREFIX.length);
  const sep = rest.indexOf(":");
  if (sep <= 0 || sep === rest.length - 1) return null;
  return { namespace: rest.slice(0, sep), remainder: rest.slice(sep + 1) };
}

export function deriveHermesPublicKey(row) {
  if (!row || typeof row !== "object") return null;
  const stripped = stripAgentNamespace(row.sessionKey);
  if (stripped) {
    const segments = stripped.remainder.split(":");
    if (
      segments.length === 3 &&
      segments[0] === OCUCLAW_PLATFORM_SEGMENT &&
      segments[1] === OCUCLAW_CHAT_TYPE_SEGMENT &&
      segments[2] &&
      segments[2] !== HERMES_FOREIGN_KEY_MARKER
    ) {
      return {
        key: `${HERMES_SESSION_KEY_PREFIX}${stripped.namespace}:${segments[2]}`,
        kind: "minted",
      };
    }

    return {
      key: `${HERMES_SESSION_KEY_PREFIX}${stripped.namespace}:${HERMES_FOREIGN_KEY_MARKER}:${stripped.remainder}`,
      kind: "foreign",
    };
  }

  const source = normalizeSegment(row.source);
  const rootId = normalizeSegment(row.lineageRootId) || normalizeSegment(row.id);
  if (!source || !rootId || source.includes(":")) return null;
  return {
    key: `${HERMES_SESSION_KEY_PREFIX}${DEFAULT_HERMES_NAMESPACE}:${HERMES_FOREIGN_KEY_MARKER}:${source}:${rootId}`,
    kind: "externalRoot",
  };
}

export function parseHermesPublicKey(key) {
  if (typeof key !== "string") return null;
  if (!key.toLowerCase().startsWith(HERMES_SESSION_KEY_PREFIX)) return null;
  const rest = key.slice(HERMES_SESSION_KEY_PREFIX.length);
  const sep = rest.indexOf(":");
  if (sep <= 0 || sep === rest.length - 1) return null;
  const namespace = rest.slice(0, sep);
  const tail = rest.slice(sep + 1);
  if (tail.startsWith(`${HERMES_FOREIGN_KEY_MARKER}:`)) {
    const remainder = tail.slice(HERMES_FOREIGN_KEY_MARKER.length + 1);
    if (!remainder) return null;
    return { namespace, kind: "foreign", remainder };
  }
  if (!tail || tail.includes(":") || tail === HERMES_FOREIGN_KEY_MARKER) {

    return null;
  }
  return { namespace, kind: "minted", chatId: tail };
}

function normalizeSegment(value) {
  return typeof value === "string" ? value.trim() : "";
}
