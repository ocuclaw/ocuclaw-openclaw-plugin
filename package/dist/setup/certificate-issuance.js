import { spawn } from "node:child_process";

import fs from "node:fs";

import os from "node:os";

import path from "node:path";

import process from "node:process";

export const ISSUANCE_AVAILABLE = "available";
export const ISSUANCE_UNAVAILABLE = "unavailable";
export const ISSUANCE_UNKNOWN = "unknown";
export const ISSUANCE_PENDING = "pending";

const UNAVAILABLE_SIGNATURES = [
  "does not support getting tls certs",
  "https must be enabled in the admin panel",
  "https is not enabled",
];

const OUTPUT_LIMIT = 4096;
const CERT_DIR_PREFIX = "ocuclaw-cert-";

const STALE_DIR_MS = 15 * 60 * 1000;

function sweepStaleDirs(tmpRoot) {
  try {
    const uid = typeof process.getuid === "function" ? process.getuid() : null;
    for (const name of fs.readdirSync(tmpRoot)) {
      if (!name.startsWith(CERT_DIR_PREFIX)) continue;
      const folder = path.join(tmpRoot, name);
      const info = fs.lstatSync(folder);
      if (!info.isDirectory() || (uid !== null && info.uid !== uid)) continue;
      if (Date.now() - info.mtimeMs < STALE_DIR_MS) continue;
      fs.rmSync(folder, { recursive: true, force: true });
    }
  } catch (_) {  }
}

export function certificateCommand(tailscaleArgv, dnsName, dir) {
  const prefix = Array.isArray(tailscaleArgv) && tailscaleArgv.length > 0
    ? tailscaleArgv.slice()
    : ["tailscale"];
  return prefix.concat([
    "cert",
    "--cert-file",
    path.join(dir, "cert.pem"),
    "--key-file",
    path.join(dir, "key.pem"),
    dnsName,
  ]);
}

export function certificateOutcome(code, output) {
  if (code === 0) return ISSUANCE_AVAILABLE;
  const lowered = String(output || "").toLowerCase();
  if (UNAVAILABLE_SIGNATURES.some((signature) => lowered.includes(signature))) {
    return ISSUANCE_UNAVAILABLE;
  }
  return ISSUANCE_UNKNOWN;
}

export function startCertificateIssuance(tailscaleArgv, dnsName, budgetMs, deps = {}) {
  const spawnFn = typeof deps.spawn === "function" ? deps.spawn : spawn;
  const tmpRoot = typeof deps.tmpDir === "string" && deps.tmpDir ? deps.tmpDir : os.tmpdir();
  let outcome = null;
  let output = "";
  let child = null;
  let timer = null;
  let dir = null;
  const startedAt = Date.now();
  let ranMs = null;

  const removeFiles = () => {
    const folder = dir;
    dir = null;
    if (!folder) return;
    try { fs.rmSync(folder, { recursive: true, force: true }); } catch (_) {  }
  };
  const settle = (value) => {
    if (outcome === null) {
      outcome = value;
      ranMs = Date.now() - startedAt;
    }
    if (timer) { clearTimeout(timer); timer = null; }
  };
  const stopChild = () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      try { child.kill("SIGTERM"); } catch (_) {  }
    }
  };

  sweepStaleDirs(tmpRoot);
  try {
    dir = fs.mkdtempSync(path.join(tmpRoot, CERT_DIR_PREFIX));
    const argv = certificateCommand(tailscaleArgv, dnsName, dir);
    child = spawnFn(argv[0], argv.slice(1), { stdio: ["ignore", "pipe", "pipe"] });
  } catch (_) {
    settle(ISSUANCE_UNKNOWN);
    removeFiles();
    return { poll: () => outcome, ranMs: () => ranMs, stop: () => {} };
  }

  const collect = (chunk) => {
    if (output.length < OUTPUT_LIMIT) output += String(chunk);
  };
  if (child.stdout) child.stdout.on("data", collect);
  if (child.stderr) child.stderr.on("data", collect);
  child.once("error", () => {
    settle(ISSUANCE_UNKNOWN);
    removeFiles();
  });
  child.once("close", (code) => {
    settle(certificateOutcome(code, output));
    removeFiles();
  });
  const budget = Number(budgetMs) > 0 ? Number(budgetMs) : 0;
  timer = setTimeout(() => {
    settle(ISSUANCE_PENDING);
    stopChild();
  }, budget);

  return {
    poll: () => outcome,

    ranMs: () => ranMs,

    stop: () => {
      settle(ISSUANCE_PENDING);
      stopChild();
      removeFiles();
    },
  };
}
