import * as http from "node:http";

import { stdin, stdout, stderr, env } from "node:process";

import process from "node:process";
import { PAIRING_CONTROL_PATH } from "../domain/pairing/pairing-endpoint-address.js";
import { PAIRING_CONTROL_AUTH_HEADER, PAIRING_CONTROL_SECRET_HEADER } from "../domain/pairing/pairing-control-service.js";
import { terminalAllowsColor, terminalText } from "./terminal-text.js";

class PairingControlError extends Error {
           reason                                           ;
  constructor(reason                                           ) {
    super("Pairing control unavailable.");
    this.reason = reason;
  }
}

export function pairingControlRequest(connection                           , body                         , secret = "", timeoutMs = 3000)                               {
  return new Promise((resolve, reject) => {
    const fail = () => reject(new Error("Pairing control unavailable."));
    if (!Number.isInteger(connection.port) || connection.port < 1 || connection.port > 65535) return fail();
    const payload = JSON.stringify({ v: 1, ...body });
    const request = http.request({
      hostname: "127.0.0.1", port: connection.port, path: PAIRING_CONTROL_PATH,
      method: "POST", agent: false,
      headers: { "content-type": "application/json", [PAIRING_CONTROL_AUTH_HEADER]: connection.relayCredential,
        ...(secret ? { [PAIRING_CONTROL_SECRET_HEADER]: secret } : {}) },
    }, (response     ) => {
      let data = "";
      response.setEncoding("utf8");
      response.on("data", (chunk        ) => {
        data += chunk;
        if (data.length > 65536) request.destroy(new Error("Pairing control unavailable."));
      });
      response.on("error", fail);
      response.on("end", () => {
        clearTimeout(timer);
        try {
          const parsed = JSON.parse(data);
          if (response.statusCode === 409) return reject(new PairingControlError("busy"));
          if (response.statusCode === 401) return reject(new PairingControlError("authentication"));
          if (response.statusCode !== 200 || parsed?.v !== 1 || Array.isArray(parsed)) return fail();
          resolve(parsed);
        } catch { fail(); }
      });
    });
    const timer = setTimeout(() => request.destroy(new Error("Pairing control unavailable.")), timeoutMs);
    request.on("error", () => { clearTimeout(timer); fail(); });
    request.on("close", () => { clearTimeout(timer); });
    request.end(payload);
  }).catch((error) => { throw error instanceof PairingControlError ? error : new PairingControlError("unavailable"); })                                ;
}

export function localeAllowsUnicode(locale         )          {
  const value = String(locale ?? "").trim();
  const dot = value.indexOf(".");
  if (dot < 0) return true;
  const codeset = value.slice(dot + 1).split("@")[0].replace(/[-_]/g, "").toLowerCase();
  return codeset === "" || codeset === "utf8";
}

const PROBE_CHAR = "é";

const PROBE_TIMEOUT_MS = 300;

const CURSOR_REPORT = /\u001b\[[0-9]+;([0-9]+)R/;

function probeTerminalUnicode(input     , output     , timeoutMs = PROBE_TIMEOUT_MS)                          {
  return new Promise((resolve) => {
    if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== "function") return resolve(null);
    const wasRaw = input.isRaw;
    const wasPaused = input.isPaused();
    let reply = "";
    let done = false;
    const finish = (answer                ) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      input.off("data", onData);
      input.off("error", onFailure);
      input.off("end", onFailure);
      try { input.setRawMode(Boolean(wasRaw)); } catch {  }
      if (wasPaused) input.pause();

      try { output.write("\r\u001b[2K"); } catch {  }
      resolve(answer);
    };
    const onFailure = () => finish(null);
    const onData = (chunk         ) => {
      reply += String(chunk);

      if (reply.includes("\u0003")) {
        finish(null);
        try { process.kill(process.pid, "SIGINT"); } catch {  }
        return;
      }
      const match = CURSOR_REPORT.exec(reply);
      if (match) {
        const advance = Number(match[1]) - 1;
        finish(advance === 1 ? true : advance === 2 ? false : null);
        return;
      }
      if (reply.length > 64) finish(null);
    };
    const timer = setTimeout(onFailure, timeoutMs);
    input.on("data", onData);
    input.on("error", onFailure);
    input.on("end", onFailure);
    try {
      input.setRawMode(true);
      input.resume();
      output.write("\r\u001b[2K" + PROBE_CHAR + "\u001b[6n");
    } catch { finish(null); }
  });
}

const PAIRING_ANSWER_PROMPT = "Type approve, refuse, or cancel: ";
const APPROVE_ANSWERS = ["yes", "approve", "approved"];
const DENY_ANSWERS = ["no", "refuse", "refused", "deny"];
const CANCEL_ANSWERS = ["cancel"];

function editDistance(a        , b        )         {
  const row = Array.from({ length: b.length + 1 }, (_unused, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = row[j];
      row[j] = next;
    }
  }
  return row[b.length];
}

export function classifyPairingAnswer(raw        )                                                                     {
  const answer = raw.trim().toLowerCase();
  if (APPROVE_ANSWERS.includes(answer)) return { kind: "approve" };
  if (DENY_ANSWERS.includes(answer)) return { kind: "deny" };
  if (CANCEL_ANSWERS.includes(answer)) return { kind: "cancel" };
  let near                    ;
  let nearDistance = 99;
  if (answer.length >= 2) {
    for (const word of [...APPROVE_ANSWERS, ...DENY_ANSWERS, ...CANCEL_ANSWERS]) {
      const distance = editDistance(answer, word);
      if (distance <= (word.length <= 3 ? 1 : 2) && distance < nearDistance) { near = word; nearDistance = distance; }
    }
  }
  return { kind: "unclear", near };
}

function pairingWordsBox(line        , unicode         )         {
  const [tl, tr, bl, br, h, v] = unicode ? "\u250c\u2510\u2514\u2518\u2500\u2502" : "++++-|";
  const inner = `   ${line}   `;
  return `  ${tl}${h.repeat(inner.length)}${tr}\n  ${v}${inner}${v}\n  ${bl}${h.repeat(inner.length)}${br}`;
}

export async function runPairingTerminal(connection                           , io                    = {})                                 {
  const input = io.input ?? stdin;
  const output = io.output ?? stdout;
  const error = io.error ?? stderr;
  const result                        = { exitCode: 1, outcome: "failed", credentialDelivery: "not-observed", phoneConnection: "not-observed" };
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== "function") {
    error.write("Run pairing directly in an interactive terminal.\nPiped or redirected input/output cannot approve pairing.\n");
    return { ...result, exitCode: 2, outcome: "terminal-required" };
  }
  const request = io.request ?? pairingControlRequest;
  const pollMs = io.pollMs ?? 1000;
  const deadline = Date.now() + Math.min(io.deadlineMs ?? 135000, 135000);
  let secret = "";
  let exchangeId = "";
  let finished = false;
  let cancelled = false;
  let armed = false;
  let answer = "";
  let decision                = null;
  const wasRaw = input.isRaw;
  const wasPaused = input.isPaused();
  const stop = () => { cancelled = true; };

  let held = "";
  const withoutCursorReports = (chunk        ) => {

    if (armed) { held = ""; return chunk.replace(/\u001b\[[0-9]+;[0-9]+R/g, ""); }
    const text = held + chunk;
    held = "";
    const stripped = text.replace(/\u001b\[[0-9]+;[0-9]+R/g, "");
    const partial = /\u001b\[[0-9;]*$/.exec(stripped);
    if (!partial) return stripped;
    held = partial[0];
    return stripped.slice(0, partial.index);
  };

  const onData = (chunk         ) => {

    const text = withoutCursorReports(String(chunk));

    if (text.length > 1 && text.startsWith("\u001b")) return;
    for (const char of text) {
      if (char === "\u0003" || char === "\u0004" || char === "\u001b") { stop(); return; }
      if (!armed || decision !== null) continue;
      if (char === "\r" || char === "\n") { decision = answer; armed = false; answer = ""; }
      else if (char === "\u007f" || char === "\b") {
        if (answer.length) { answer = answer.slice(0, -1); output.write("\b \b"); }
      }
      else if (char >= " " && answer.length < 256) { answer += char; output.write(char); }

    }
  };
  const pause = () => new Promise      ((resolve) => setTimeout(resolve, pollMs));
  const call = (op        , extra                          = {}) => request(connection, { op, ...extra }, secret);

  const probed = await probeTerminalUnicode(input, output, io.probeTimeoutMs);
  const unicode = probed === null
    ? localeAllowsUnicode(env.LC_ALL || env.LC_CTYPE || env.LANG || "")
    : probed;
  input.on("data", onData);
  input.on("end", stop);
  input.on("close", stop);
  input.on("error", stop);
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    input.setRawMode(true);
    input.resume();
    const created = await call("create", { address: connection.phoneAddress, lightTerminal: connection.lightTerminal === true,
      terminal: { unicode,
        color: terminalAllowsColor(output, env), columns: output.columns || 0, rows: output.rows || 0 } });
    if (typeof created.controlSecret !== "string" || !created.controlSecret || typeof created.exchangeId !== "string") throw new Error("Invalid control response");
    secret = created.controlSecret;
    exchangeId = created.exchangeId;
    if (cancelled) {
      result.outcome = "cancelled";
      output.write("\nPairing cancelled. Start pairing again to retry.\n");
      return result;
    }
    if (typeof created.bootstrapBlock !== "string") throw new Error("Invalid bootstrap");
    output.write(terminalText("\nPair your phone\n", "heading", output));
    output.write(terminalText("Keep the pairing code and words private. Do not paste them into chats or logs.\n", "detail", output));
    output.write(created.bootstrapBlock);
    output.write("Waiting for the phone. Ctrl-C cancels.\n");
    result.phase = "waiting-for-phone";
    let prompted = false;
    while (!cancelled && Date.now() < deadline) {
      const state = await call("state");
      if (cancelled || Date.now() >= deadline) break;
      if (state.exchangeId !== exchangeId) throw new Error("Exchange changed");
      if (state.state === "awaiting-approval" || state.prompt) result.phase = "awaiting-approval";
      if (state.state === "awaiting-phone-completion") result.phase = "awaiting-phone-connection";
      if (state.state === "failed") { finished = true; result.outcome = state.failure?.reason === "expired" ? "expired" : "failed"; break; }
      if (state.state === "completed") {
        finished = true;

        if (state.credentialExposure === "delivered") {
          result.outcome = "connection-observed";
          result.credentialDelivery = "delivered";
          result.phoneConnection = "new-authenticated-connection-observed";
        }
        break;
      }
      if (state.prompt && !prompted) {
        const words = state.prompt.safetyPhrase;
        if (state.prompt.exchangeId !== exchangeId || !Array.isArray(words) || words.length !== 4 || !words.every((word         ) => typeof word === "string" && /^[a-z]+$/.test(word))) throw new Error("Invalid comparison");

        const phoneLabel = typeof state.prompt.phoneLabel === "string" && state.prompt.phoneLabel.trim()
          ? state.prompt.phoneLabel.trim()
          : "Unknown device";

        output.write(`\nPhone: ${phoneLabel}\nCheck these words match your phone, in this order:\n${pairingWordsBox(words.join("   "), unicode)}\nIf they differ, refuse.\n`);
        output.write(terminalText(PAIRING_ANSWER_PROMPT, "action", output));

        await new Promise      ((resolve) => setTimeout(resolve, 0));
        if (cancelled || Date.now() >= deadline) break;
        answer = "";
        armed = true;
        prompted = true;
      }
      if (decision !== null) {
        if (cancelled || Date.now() >= deadline) break;
        const choice = classifyPairingAnswer(decision);
        if (choice.kind === "unclear") {

          output.write("\nNot approved. ");
          output.write(terminalText(PAIRING_ANSWER_PROMPT, "action", output));
          decision = null;
          answer = "";
          armed = true;
          await pause();
          continue;
        }
        const approve = choice.kind === "approve";
        const op = approve ? "approve" : choice.kind === "cancel" ? "cancel" : "deny";

        if (approve) { result.credentialDelivery = "uncertain"; result.phase = "awaiting-phone-connection"; }
        const response = await call(op);
        if (!approve) { finished = true; result.outcome = op === "cancel" ? "cancelled" : "refused"; break; }
        if (response.credentialExposure === "delivered") result.credentialDelivery = "delivered";
        if (!response.ok) throw new Error("Decision refused");
        if (response.state === "completed" && response.credentialExposure === "delivered") {
          finished = true;
          result.outcome = "connection-observed";
          result.phoneConnection = "new-authenticated-connection-observed";
          break;
        }
        output.write("\nApproved. Waiting for your phone to connect.\n");
        decision = null;
      }
      await pause();
    }
    if (!finished) result.outcome = cancelled ? "cancelled" : "expired";
  } catch (error) {

    result.outcome = "failed";
    if (error instanceof PairingControlError && error.reason === "busy") output.write("\nAnother pairing request may be active.\nLet its owner finish or cancel it, then try pairing again.\n");
    else if (error instanceof PairingControlError && error.reason === "authentication") output.write("\nPairing authentication was refused.\nRun the setup checks, then try pairing again.\n");
  } finally {
    armed = false;
    if (secret && !finished) { try { await call("cancel"); } catch {  } }
    secret = "";
    input.off("data", onData);
    input.off("end", stop);
    input.off("close", stop);
    input.off("error", stop);
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    try { input.setRawMode(Boolean(wasRaw)); } catch {  }
    if (wasPaused) input.pause();
  }
  if (result.credentialDelivery === "delivered") {
    result.exitCode = 0;
    output.write(result.phoneConnection === "new-authenticated-connection-observed"
      ? "\nPaired. Your phone is connected.\n"
      : "\nEncrypted credential delivery completed. This phone's authenticated connection has not been observed; check the phone before retrying.\n");
  } else if (io.driven === true && result.outcome === "expired") {
    output.write("\n");
  } else {
    output.write(`\nPairing ${result.outcome}. ${result.credentialDelivery === "uncertain" ? "Credential delivery is uncertain; check the phone before retrying." : "No credential delivery was observed. Start pairing again to retry."}\n`);
  }
  return result;
}
