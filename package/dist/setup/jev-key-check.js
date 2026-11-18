import { fetch as undiciFetch } from "undici";
import { createJevClient } from "../domain/glasses-ui-jev-client.js";
import { JEV_MODEL_ID } from "../domain/glasses-ui-surface-decision.js";
import { JEV_CHECK_RESULTS } from "./optional-setup-protocol.js";

export { JEV_CHECK_RESULTS };

export const JEV_CHECK_BUDGET_MS = 10_000;

export const JEV_CHECK_MAX_INFLIGHT = 4;

export const JEV_CHECK_FILE = "jev-check.json";

export const JEV_CHECK_QUESTION = "setup_check";

export const JEV_CHECK_QUESTIONS = Object.freeze({
  [JEV_CHECK_QUESTION]: Object.freeze({
    type: "choice",
    instructions: Object.freeze({
      question: "Is this message a short setup test?",
      inspect: "message",
    }),
    criteria: Object.freeze({
      yes: "the message is a short setup test",
      no: "the message is anything else",
    }),
  }),
});

export const JEV_CHECK_STATE = Object.freeze({ message: "OcuClaw setup check" });

export function jevCheckResultFor(outcome     , status      = null) {
  if (outcome && outcome.ok === true) return "working";
  if (status === 401 || status === 403) return "key_rejected";
  if (outcome && outcome.reason === "http_401") return "key_rejected";
  return "unreachable";
}

export function savedTypesafeState(snapshot     ) {
  const row = snapshot && snapshot.capabilities && snapshot.capabilities.typesafe;
  if (!row || typeof row !== "object") return null;
  return { present: row.present === true, loaded: row.state === "available_to_test" };
}

export function createJevKeyCheck(deps      = {}) {
  const now = typeof deps.now === "function" ? deps.now : () => Date.now();
  const createClient = typeof deps.createClient === "function" ? deps.createClient : createJevClient;
  const baseFetch = typeof deps.fetchImpl === "function" ? deps.fetchImpl : undiciFetch;
  const budgetMs = Number.isFinite(deps.budgetMs) && deps.budgetMs > 0 ? deps.budgetMs : JEV_CHECK_BUDGET_MS;
  const inflight = new Set        ();

  function report(row     ) {
    try { if (typeof deps.emit === "function") deps.emit(row); } catch (_) {  }
    try { if (typeof deps.record === "function") deps.record(row); } catch (_) {  }
  }

  async function readSnapshot(connectionId        ) {
    try {
      return typeof deps.readSnapshot === "function" ? (await deps.readSnapshot(connectionId)) || null : null;
    } catch (_) { return null; }
  }

  async function ask(key        ) {

    let status                = null;
    const fetchImpl = async (url     , init     ) => {
      const response      = await baseFetch(url, init);
      status = response && Number.isFinite(response.status) ? response.status : null;
      return response;
    };
    const client = createClient({
      apiKey: key,
      enabled: true,
      model: JEV_MODEL_ID,
      questions: JEV_CHECK_QUESTIONS,
      fetchImpl,
      ...(deps.connection ? { connection: deps.connection } : {}),
    });
    try {
      const outcome = await client.decide({ ...JEV_CHECK_STATE }, { budgetMs, questions: JEV_CHECK_QUESTIONS });
      return { outcome, status };
    } catch (_) {

      return { outcome: { ok: false, reason: "network" }, status };
    } finally {
      try { if (client && typeof client.close === "function") await client.close(); } catch (_) {  }
    }
  }

  async function check(connectionId        ) {
    if (typeof connectionId !== "string" || !connectionId) return { status: "rejected", code: "not_connected" };
    if (inflight.has(connectionId) || inflight.size >= JEV_CHECK_MAX_INFLIGHT) return { status: "rejected", code: "busy" };
    inflight.add(connectionId);
    const startedAt = now();
    try {
      const snapshot = await readSnapshot(connectionId);
      const saved = savedTypesafeState(snapshot);
      let key = "";
      try { key = typeof deps.loadedKey === "function" ? String(deps.loadedKey() || "") : ""; } catch (_) { key = ""; }
      const answer = (result        , extra      = {}) => {
        report({ result, ms: Math.round(now() - startedAt), ...extra });
        return { status: "ok", jevCheck: { result }, ...(snapshot ? { snapshot } : {}) };
      };

      if (saved && saved.present && !saved.loaded) return answer("not_loaded");
      if (!key) return answer(saved && saved.present ? "not_loaded" : "no_key");
      const { outcome, status } = await ask(key);
      const result = jevCheckResultFor(outcome, status);
      return answer(result, {
        reason: outcome && typeof outcome.reason === "string" ? outcome.reason : null,
        httpStatus: Number.isFinite(status) ? status : null,
      });
    } finally {
      inflight.delete(connectionId);
    }
  }

  return { check, inflight: () => inflight.size };
}

export function writeJevCheckRecord(fsImpl     , file        , result        , checkedAtMs        ) {
  if (!JEV_CHECK_RESULTS.includes(result)) return false;

  const tmp = `${file}.${(globalThis       ).process?.pid || 0}.tmp`;
  fsImpl.writeFileSync(tmp, `${JSON.stringify({ v: 1, result, checkedAtMs })}\n`, { mode: 0o600 });
  fsImpl.renameSync(tmp, file);
  return true;
}

export function readJevCheckRecord(fsImpl     , file        ) {
  try {
    const parsed = JSON.parse(fsImpl.readFileSync(file, "utf8"));
    if (!parsed || parsed.v !== 1 || !JEV_CHECK_RESULTS.includes(parsed.result)
        || !Number.isFinite(parsed.checkedAtMs)) return null;
    return { result: parsed.result, checkedAtMs: parsed.checkedAtMs };
  } catch (_) { return null; }
}

export function clearJevCheckRecord(fsImpl     , file        ) {
  try { fsImpl.rmSync(file, { force: true }); } catch (_) {  }
}
