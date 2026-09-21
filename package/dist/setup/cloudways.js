import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as https from "node:https";
import * as os from "node:os";
import * as path from "node:path";

import process from "node:process";

import {
  detectionSignals,
  detectionVerdict,
  readProc1Cmdline,
  resolveHostname,
} from "./cloudways-host.js";
import {
  buildTailscaleCliBody,
  readJsonReceipt,
  readTailscaleCliReceipt,
  resolveHostStateDir,
  TAILSCALE_CLI_RECEIPT_FILENAME,
  writeJsonReceiptDurable,
} from "./private-route.js";

export const TAILSCALE_VERSION = "1.102.4";
export const TAILSCALE_TGZ_URL =
  `https://pkgs.tailscale.com/stable/tailscale_${TAILSCALE_VERSION}_amd64.tgz`;

export const TAILSCALE_TGZ_SHA256 = "50748df1045e60b5b695f19f4c56b0da36c019948b440fb456b6584a50f0d8b9";
export const TAILSCALE_TGZ_MEMBER_DIR = `tailscale_${TAILSCALE_VERSION}_amd64`;

export const SOCKS5_LISTEN = "127.0.0.1:1055";
export const RECEIPT_PROVISIONER = "openclaw ocuclaw cloudways";
export const CLOUDWAYS_STATE_FILENAME = "ocuclaw.cloudways.openclaw.json";
export const CLOUDWAYS_STATE_SCHEMA_VERSION = 1;

export const STATE_ABSENT = "absent";
export const STATE_STOPPED = "stopped";
export const STATE_STARTING = "starting";
export const STATE_NEEDS_AUTH = "needs-authorization";
export const STATE_RUNNING = "running";
export const STATE_UNKNOWN = "unknown";

const AUTH_URL_RE = /https:\/\/login\.tailscale\.com\/\S+/;
const CMD_TIMEOUT_MS = 20000;
const DOWNLOAD_TIMEOUT_MS = 120000;
const MAX_REDIRECTS = 5;
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;

export function resolveLayout(options      = {}) {
  let home = typeof options.home === "string" && options.home ? options.home : "";
  if (!home) {
    const envHome = process.env && typeof process.env.HOME === "string" ? process.env.HOME.trim() : "";
    home = envHome || os.homedir();
  }
  const hostStateDir = typeof options.hostStateDir === "string" && options.hostStateDir
    ? options.hostStateDir
    : resolveHostStateDir(process.env);
  const binDir = path.join(home, "bin");
  const stateDir = path.join(home, ".tailscale");
  const runDir = path.join(stateDir, "run");
  return {
    home,
    hostStateDir,
    binDir,
    tailscale: path.join(binDir, "tailscale"),
    tailscaled: path.join(binDir, "tailscaled"),
    stateDir,
    runDir,
    socketPath: path.join(runDir, "tailscaled.sock"),
    logDir: path.join(stateDir, "log"),
    logPath: path.join(stateDir, "log", "tailscaled.log"),
    needsAuthMarker: path.join(stateDir, "needs-authorization"),

    installReceipt: path.join(stateDir, "ocuclaw-install.json"),

    statePath: hostStateDir ? path.join(hostStateDir, CLOUDWAYS_STATE_FILENAME) : null,
    receiptPath: hostStateDir ? path.join(hostStateDir, TAILSCALE_CLI_RECEIPT_FILENAME) : null,
    legacySupervisorDir: path.join(home, ".local", "share", "tailscale"),
  };
}

export function cliArgv(layout     ) {
  return [layout.tailscale, `--socket=${layout.socketPath}`];
}

export function daemonArgv(layout     ) {
  return [
    layout.tailscaled,
    `--statedir=${layout.stateDir}`,
    `--socket=${layout.socketPath}`,
    "--tun=userspace-networking",
    `--socks5-server=${SOCKS5_LISTEN}`,
  ];
}

function text(value     ) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  return String(value);
}

export function defaultRunCommand(argv     , options      = {}) {
  return new Promise((resolve) => {
    execFile(
      argv[0],
      argv.slice(1),
      {
        timeout: Number.isFinite(options.timeoutMs) ? options.timeoutMs : CMD_TIMEOUT_MS,
        maxBuffer: 1024 * 1024,
        encoding: "utf8",
        env: options.env || process.env,
      },
      (error     , stdout     , stderr     ) => {
        if (error) {
          const killed = Boolean(error.killed) || error.signal === "SIGTERM" || error.code === "ETIMEDOUT";
          resolve({
            code: killed || typeof error.code !== "number" ? null : error.code,
            stdout: text(stdout),
            stderr: text(stderr) || (killed ? "timeout" : String(error.message || "spawn failed")),
            spawnFailed: typeof error.code === "string",
          });
          return;
        }
        resolve({ code: 0, stdout: text(stdout), stderr: text(stderr), spawnFailed: false });
      },
    );
  });
}

function runnerOf(deps     ) {
  return deps && typeof deps.run === "function" ? deps.run : defaultRunCommand;
}

export {
  CLOUDWAYS_HOSTNAME_SUFFIX,
  CLOUDWAYS_RESTART_NOTE,
  CLOUDWAYS_RESTART_RISK,
  DETECT_CLOUDWAYS,
  DETECT_LIKELY,
  DETECT_NO,
  detectSync,
  gatewayRestartAdvice,
  gatewayRestartRisk,
  hostIsCloudways,
  hostSummary,
  isCloudwaysManagedHost,
  mentionsGatewayRestart,
  resetHostSummaryCache,
} from "./cloudways-host.js";

export async function detect(options      = {}) {
  const hostname = resolveHostname(options);
  let proc1 = typeof options.proc1Cmdline === "string" ? options.proc1Cmdline : readProc1Cmdline();
  if (!proc1 && typeof options.proc1Cmdline !== "string") {

    const result      = await runnerOf(options)(["ps", "-o", "args=", "-p", "1"], { timeoutMs: 5000 });
    proc1 = result && result.code === 0 ? String(result.stdout || "").trim() : "";
  }
  const signals = detectionSignals(options, hostname, proc1);
  return { verdict: detectionVerdict(signals), signals, hostname: String(hostname || "") };
}

export function binariesPresent(layout     ) {
  try {
    return fs.statSync(layout.tailscale).isFile() && fs.statSync(layout.tailscaled).isFile();
  } catch (_) {
    return false;
  }
}

export async function daemonState(layout     , deps      = {}) {
  if (!binariesPresent(layout)) {
    return { state: STATE_ABSENT, detail: "tailscale binaries are not installed" };
  }
  const result      = await runnerOf(deps)(cliArgv(layout).concat(["status", "--json"]), { timeoutMs: 8000 });
  if (!result || result.code === null) {
    const why = result && result.stderr ? String(result.stderr).trim().slice(0, 200) : "no answer";
    return { state: STATE_STOPPED, detail: `tailscale status did not answer: ${why}` };
  }
  let document      = null;
  try {
    const raw = String(result.stdout || "").trim();
    document = raw ? JSON.parse(raw) : null;
  } catch (_) {
    document = null;
  }
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    const lowered = `${result.stdout || ""}${result.stderr || ""}`.toLowerCase();
    if (lowered.includes("doesn't appear to be running") || lowered.includes("failed to connect")) {
      return { state: STATE_STOPPED, detail: "socket is not answering" };
    }
    return { state: STATE_UNKNOWN, detail: String(result.stderr || result.stdout || "").trim().slice(0, 200) };
  }
  const backend = typeof document.BackendState === "string" ? document.BackendState : null;
  const self = document.Self && typeof document.Self === "object" ? document.Self : {};
  const report      = {
    state: STATE_UNKNOWN,
    backend,
    nodeName: typeof self.HostName === "string" ? self.HostName : null,
    dnsName: typeof self.DNSName === "string" ? self.DNSName.replace(/\.+$/, "") : null,
    online: typeof self.Online === "boolean" ? self.Online : null,
    keyExpiry: typeof self.KeyExpiry === "string" ? self.KeyExpiry : null,

    authUrl: typeof document.AuthURL === "string" && document.AuthURL ? document.AuthURL : null,
    detail: "",
  };
  if (backend === "Running") {
    report.state = STATE_RUNNING;
  } else if (backend === "NeedsLogin" || backend === "NeedsMachineAuth") {
    report.state = STATE_NEEDS_AUTH;
    report.detail = backend === "NeedsMachineAuth"
      ? "machine approval is pending in the tailnet admin console"
      : "the node must be authorized: run `openclaw ocuclaw cloudways retry`";
  } else if (backend === "NoState" || backend === "Starting") {
    report.state = STATE_STARTING;
  } else if (backend === "Stopped") {
    report.state = fileExists(layout.needsAuthMarker) ? STATE_NEEDS_AUTH : STATE_STOPPED;
    report.detail = "tailscaled is up but `tailscale up` has not been run";
  }
  return report;
}

function fileExists(target     ) {
  try { fs.accessSync(target); return true; } catch (_) { return false; }
}

export function clearNeedsAuthorizationMarker(layout     ) {
  try {
    fs.unlinkSync(layout.needsAuthMarker);
    return true;
  } catch (_) {
    return false;
  }
}

export async function daemonProcesses(layout     , deps      = {}) {
  const result      = await runnerOf(deps)(["pgrep", "-a", "-f", "tailscaled"], { timeoutMs: 5000 });
  const ours      = [];
  const foreign      = [];
  if (!result || result.code !== 0) return { ours, foreign };
  const wanted = `--statedir=${layout.stateDir}`;
  for (const line of String(result.stdout || "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const space = trimmed.indexOf(" ");
    if (space <= 0) continue;
    const pid = Number(trimmed.slice(0, space));
    const cmdline = trimmed.slice(space + 1);
    if (!Number.isInteger(pid) || pid <= 0) continue;
    if (pid === process.pid) continue;
    const tokens = cmdline.split(/\s+/);
    if (path.basename(tokens[0]) !== "tailscaled") continue;
    if (tokens.includes(wanted)) ours.push({ pid, cmdline: cmdline.slice(0, 200) });
    else foreign.push({ pid, cmdline: cmdline.slice(0, 200) });
  }
  return { ours, foreign };
}

export async function legacyInventory(layout     , deps      = {}) {
  const processes = await daemonProcesses(layout, deps);
  return {
    legacySupervisorDir: layout.legacySupervisorDir,
    legacySupervisorPresent: fileExists(path.join(layout.legacySupervisorDir, "supervisor.py")),
    foreignDaemonProcesses: processes.foreign.map((entry     ) => `${entry.pid} ${entry.cmdline}`),
    ownDaemonPids: processes.ours.map((entry     ) => entry.pid),
  };
}

export function refuseIfForeignSupervisor(inventory     ) {
  const foreign = (inventory && inventory.foreignDaemonProcesses) || [];
  if (foreign.length === 0) return null;
  return "another tailscaled is running; stop it first (never run two supervisors): "
    + foreign.join("; ");
}

export function readCloudwaysState(layout     ) {
  if (!layout.statePath) return null;
  const { record, status } = readJsonReceipt(layout.statePath);
  if (status !== "ok") return null;
  return record;
}

export function writeCloudwaysState(layout     , patch     ) {
  if (!layout.statePath) throw new Error("no host state directory");
  const known = readCloudwaysState(layout) || {};
  const body = {
    schemaVersion: CLOUDWAYS_STATE_SCHEMA_VERSION,
    enabled: patch.enabled === undefined ? known.enabled !== false : patch.enabled !== false,
    provisioner: RECEIPT_PROVISIONER,
    version: patch.version || known.version || null,
    stateDir: layout.stateDir,
    socket: layout.socketPath,
    socks5: SOCKS5_LISTEN,

    installed: Array.isArray(patch.installed) ? patch.installed : (known.installed || []),
    installedAt: known.installedAt || patch.installedAt || null,
    updatedAt: patch.updatedAt || new Date().toISOString(),
  };
  writeJsonReceiptDurable(layout.statePath, body);
  return body;
}

export function supervisionEnabled(layout     ) {
  const state = readCloudwaysState(layout);
  return Boolean(state && state.enabled !== false);
}

export function defaultFetch(url     , timeoutMs      = DOWNLOAD_TIMEOUT_MS, redirects      = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { timeout: timeoutMs }, (response     ) => {
      const status = response.statusCode;
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume();
        if (redirects >= MAX_REDIRECTS) { reject(new Error("too many redirects")); return; }
        resolve(defaultFetch(new URL(response.headers.location, url).toString(), timeoutMs, redirects + 1));
        return;
      }
      if (status !== 200) {
        response.resume();
        reject(new Error(`${url} answered HTTP ${status}`));
        return;
      }
      const chunks      = [];
      let size = 0;
      response.on("data", (chunk     ) => {
        size += chunk.length;
        if (size > MAX_ARCHIVE_BYTES) {
          response.destroy();
          reject(new Error("download exceeded the size ceiling"));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", reject);
    });
    request.on("timeout", () => { request.destroy(new Error("download timed out")); });
    request.on("error", reject);
  });
}

function mkdirHardened(target     ) {
  fs.mkdirSync(target, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(target, 0o700); } catch (_) {  }
}

export function prepareStateDirs(layout     ) {
  for (const directory of [layout.stateDir, layout.runDir, layout.logDir]) mkdirHardened(directory);
}

async function installedVersion(layout     , deps     ) {
  if (!binariesPresent(layout)) return null;
  const result      = await runnerOf(deps)([layout.tailscale, "version"], { timeoutMs: 8000 });
  if (!result || result.code !== 0) return null;
  const first = String(result.stdout || "").trim().split("\n")[0];
  return first ? first.trim() : null;
}

async function extractBinaries(layout     , archivePath     , deps     ) {
  const workDir = fs.mkdtempSync(path.join(layout.stateDir, "unpack-"));
  try {
    const argv = [
      "tar", "-xzf", archivePath, "-C", workDir,
      `${TAILSCALE_TGZ_MEMBER_DIR}/tailscale`,
      `${TAILSCALE_TGZ_MEMBER_DIR}/tailscaled`,
    ];
    const result      = await runnerOf(deps)(argv, { timeoutMs: 60000 });
    if (!result || result.code !== 0) {
      throw new Error(`tar could not extract the archive: ${String((result && result.stderr) || "").trim().slice(0, 200)}`);
    }
    mkdirHardened(layout.binDir);
    const installed      = [];
    for (const name of ["tailscale", "tailscaled"]) {
      const source = path.join(workDir, TAILSCALE_TGZ_MEMBER_DIR, name);
      if (!fileExists(source)) throw new Error(`archive did not contain ${name}`);
      const target = path.join(layout.binDir, name);
      const tmp = `${target}.tmp`;
      fs.copyFileSync(source, tmp);
      fs.chmodSync(tmp, 0o700);
      fs.renameSync(tmp, target);
      installed.push(target);
    }
    return installed;
  } finally {
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch (_) {  }
  }
}

export async function installBinaries(layout     , deps      = {}) {
  const fetch = typeof deps.fetch === "function" ? deps.fetch : defaultFetch;
  const version = await installedVersion(layout, deps);
  if (version === TAILSCALE_VERSION && !deps.forceDownload) {
    return { binaries: "adopted", version, installed: [layout.tailscale, layout.tailscaled] };
  }
  const payload      = await fetch(TAILSCALE_TGZ_URL, DOWNLOAD_TIMEOUT_MS);
  const buffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const digest = createHash("sha256").update(buffer).digest("hex");
  if (digest !== TAILSCALE_TGZ_SHA256) {
    throw new Error(`tailscale archive sha256 ${digest} does not match the pinned ${TAILSCALE_TGZ_SHA256}`);
  }
  const liveRaw      = await fetch(`${TAILSCALE_TGZ_URL}.sha256`, 30000);
  const live = String(Buffer.isBuffer(liveRaw) ? liveRaw.toString("utf8") : liveRaw).trim().split(/\s+/)[0];
  if (!live || live.toLowerCase() !== TAILSCALE_TGZ_SHA256) {
    throw new Error("the published .sha256 for the pinned archive does not match the pin");
  }
  mkdirHardened(layout.stateDir);
  const archivePath = path.join(layout.stateDir, `tailscale-${process.pid}-${Date.now().toString(36)}.tgz`);
  fs.writeFileSync(archivePath, buffer, { mode: 0o600 });
  let installed     ;
  try {
    installed = await extractBinaries(layout, archivePath, deps);
  } finally {
    try { fs.unlinkSync(archivePath); } catch (_) {  }
  }
  writeJsonReceiptDurable(layout.installReceipt, {
    schemaVersion: 1,
    version: TAILSCALE_VERSION,
    url: TAILSCALE_TGZ_URL,
    sha256: TAILSCALE_TGZ_SHA256,
    provisioner: RECEIPT_PROVISIONER,
    installedAt: new Date().toISOString(),
  });
  return {
    binaries: version === null ? "downloaded" : "replaced",
    previousVersion: version,
    version: TAILSCALE_VERSION,
    installed,
  };
}

export function writeTailscaleCliReceipt(layout     ) {
  if (!layout.receiptPath) throw new Error("no host state directory");
  const body = buildTailscaleCliBody({
    argv: cliArgv(layout),
    socks5: SOCKS5_LISTEN,
    provisioner: RECEIPT_PROVISIONER,
  });
  writeJsonReceiptDurable(layout.receiptPath, body);
  return layout.receiptPath;
}

export function layoutSummary(layout     ) {
  return {
    binDir: layout.binDir,
    stateDir: layout.stateDir,
    socket: layout.socketPath,
    receipt: layout.receiptPath || "",
    state: layout.statePath || "",
    log: layout.logPath,
    socks5: SOCKS5_LISTEN,
  };
}

export async function install(layout     , deps      = {}) {
  const report      = { ok: false, layout: layoutSummary(layout) };
  const inventory = await legacyInventory(layout, deps);
  report.legacy = inventory;
  const refusal = refuseIfForeignSupervisor(inventory);
  if (refusal) { report.error = refusal; return report; }
  let binaries     ;
  try {
    binaries = await installBinaries(layout, deps);
  } catch (error     ) {
    report.error = `binary install failed: ${error && error.message ? error.message : error}`;
    return report;
  }
  Object.assign(report, binaries);
  prepareStateDirs(layout);
  try {
    report.receipt = writeTailscaleCliReceipt(layout);
    report.state = writeCloudwaysState(layout, {
      enabled: true,
      version: TAILSCALE_VERSION,
      installed: binaries.installed,
      installedAt: new Date().toISOString(),
    });
  } catch (error     ) {
    report.error = `receipt: ${error && error.message ? error.message : error}`;
    return report;
  }

  const ensure = typeof deps.ensureDaemon === "function" ? deps.ensureDaemon : null;
  report.daemon = ensure ? await ensure(layout, deps) : await startDaemon(layout, deps);
  report.ok = true;
  return report;
}

export function defaultSpawnDaemon(layout     ) {
  mkdirHardened(layout.logDir);
  const logFd = fs.openSync(layout.logPath, "a", 0o600);
  try {
    const argv = daemonArgv(layout);
    const child = spawn(argv[0], argv.slice(1), {
      detached: true,
      stdio: ["ignore", logFd, logFd],
    });
    child.unref();
    return { pid: child.pid || null };
  } finally {
    try { fs.closeSync(logFd); } catch (_) {  }
  }
}

export async function startDaemon(layout     , deps      = {}) {
  if (!binariesPresent(layout)) {
    return { action: "absent", state: STATE_ABSENT, detail: "tailscale binaries are not installed" };
  }
  const before = await daemonState(layout, deps);
  if (before.state !== STATE_STOPPED && before.state !== STATE_ABSENT) {
    if (before.state === STATE_RUNNING) clearNeedsAuthorizationMarker(layout);
    return { action: "kept", state: before.state, detail: before.detail || "" };
  }
  const processes = await daemonProcesses(layout, deps);
  if (processes.foreign.length > 0) {
    return {
      action: "refused",
      state: before.state,
      detail: refuseIfForeignSupervisor({ foreignDaemonProcesses: processes.foreign.map((entry     ) => `${entry.pid} ${entry.cmdline}`) }),
    };
  }
  if (processes.ours.length > 0) {
    return { action: "starting", state: STATE_STARTING, detail: "tailscaled process exists but its socket is not answering yet" };
  }
  prepareStateDirs(layout);
  const spawnDaemon = typeof deps.spawnDaemon === "function" ? deps.spawnDaemon : defaultSpawnDaemon;
  const sleep = typeof deps.sleep === "function" ? deps.sleep : defaultSleep;
  let spawned     ;
  try {
    spawned = await spawnDaemon(layout);
  } catch (error     ) {
    return { action: "start-failed", state: STATE_STOPPED, detail: String((error && error.message) || error).slice(0, 200) };
  }

  const attempts = Number.isFinite(deps.settleAttempts) ? deps.settleAttempts : 40;
  let state = await daemonState(layout, deps);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (state.state === STATE_RUNNING || state.state === STATE_NEEDS_AUTH) break;
    await sleep(500);
    state = await daemonState(layout, deps);
  }
  if (state.state === STATE_STOPPED || state.state === STATE_ABSENT) {
    return { action: "start-failed", state: state.state, pid: spawned && spawned.pid, detail: `tailscaled did not answer after start; see ${layout.logPath}` };
  }
  if (state.state === STATE_RUNNING) clearNeedsAuthorizationMarker(layout);
  try { fs.chmodSync(layout.socketPath, 0o600); } catch (_) {  }
  return { action: "started", state: state.state, pid: spawned && spawned.pid, detail: state.detail || "" };
}

export function defaultSleep(ms     ) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

export async function stopDaemon(layout     , deps      = {}) {
  const before = await daemonState(layout, deps);
  if (before.state === STATE_ABSENT) return { daemon: "already-stopped", pids: [] };
  const processes = await daemonProcesses(layout, deps);
  const pids = processes.ours.map((entry     ) => entry.pid);
  if (pids.length === 0 && before.state === STATE_STOPPED) return { daemon: "already-stopped", pids: [] };
  const kill = typeof deps.kill === "function" ? deps.kill : (pid     , signal     ) => process.kill(pid, signal);
  for (const pid of pids) {
    try { kill(pid, "SIGTERM"); } catch (_) {  }
  }
  const sleep = typeof deps.sleep === "function" ? deps.sleep : defaultSleep;
  const attempts = Number.isFinite(deps.stopAttempts) ? deps.stopAttempts : 20;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const now = await daemonState(layout, deps);
    if (now.state === STATE_STOPPED || now.state === STATE_ABSENT) return { daemon: "stopped", pids };
    await sleep(250);
  }
  return { daemon: "still-running", pids };
}

export function defaultNodeName(hostname      = null) {
  let raw = hostname;
  if (typeof raw !== "string") {
    try { raw = os.hostname(); } catch (_) { raw = "host"; }
  }
  const first = String(raw || "host").split(".")[0];
  const cleaned = first.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "host";
  return `ocuclaw-${cleaned}`.slice(0, 63);
}

export async function enroll(layout     , deps      = {}, options      = {}) {
  const clock = typeof deps.now === "function" ? deps.now : () => Date.now();
  const sleep = typeof deps.sleep === "function" ? deps.sleep : defaultSleep;
  const waitMs = Math.max(1000, Math.min(Number(options.waitS || 90) * 1000, 90000));
  const commandMs = Math.max(5000, Number(options.timeoutS || 25) * 1000);
  const deadline = clock() + waitMs;
  const before = await daemonState(layout, deps);
  if (before.state === STATE_ABSENT || before.state === STATE_STOPPED || before.state === STATE_UNKNOWN) {
    return {
      ok: false,
      state: before.state,
      error: before.detail || "tailscaled is not running; run install first",
    };
  }
  if (before.state === STATE_RUNNING) {
    clearNeedsAuthorizationMarker(layout);
    return { ok: true, state: STATE_RUNNING, nodeName: before.nodeName, dnsName: before.dnsName, authUrl: null };
  }

  const upSeconds = Math.max(5, Math.floor(commandMs / 1000) - 5);
  const argv = cliArgv(layout).concat(["up", `--timeout=${upSeconds}s`]);
  if (options.hostname) argv.push(`--hostname=${options.hostname}`);
  else if (!before.dnsName) {

    argv.push(`--hostname=${defaultNodeName(options.machineHostname)}`);
  }
  let out = "";
  let err = "";
  let commandFailed = false;
  let enrollmentStarted = false;
  try {
    enrollmentStarted = fs.readFileSync(layout.needsAuthMarker, "utf8") === "enrollment-started\n";
  } catch (_) { enrollmentStarted = false; }
  if (!before.authUrl && !enrollmentStarted) {

    mkdirHardened(path.dirname(layout.needsAuthMarker));
    fs.writeFileSync(layout.needsAuthMarker, "enrollment-started\n", { mode: 0o600 });
    if (typeof deps.progress === "function") {
      deps.progress("Starting Tailscale registration; waiting up to 90 seconds for its authorization link.");
    }
    const result      = await runnerOf(deps)(argv, { timeoutMs: Math.min(commandMs, Math.max(1000, deadline - clock())) });
    out = String((result && result.stdout) || "");
    err = String((result && result.stderr) || "");
    if (result && result.spawnFailed) {
      try { fs.unlinkSync(layout.needsAuthMarker); } catch (_) {  }
      return {
        ok: false, state: before.state, pending: false, commandFailed: true,
        error: "Tailscale registration command could not start; check cloudways status, then retry.",
      };
    }

    const lowered = err.toLowerCase();
    commandFailed = result && result.code !== null && result.code !== 0
      && !["deadline", "timeout", "timed out", "cancel"].some((reason) => lowered.includes(reason));
  }
  const match = AUTH_URL_RE.exec(`${out}\n${err}`);
  let after = before;
  while (!match && !after.authUrl && after.state !== STATE_RUNNING) {
    if (clock() >= deadline) break;
    if (typeof deps.progress === "function") {
      deps.progress("Registration pending; checking the existing enrollment. No new login is being created.");
    }
    after = await daemonState(layout, deps);
    if (after.state === STATE_ABSENT || after.state === STATE_STOPPED || after.state === STATE_UNKNOWN) break;
    if (after.authUrl || after.state === STATE_RUNNING) break;
    await sleep(Math.min(5000, Math.max(0, deadline - clock())));
  }
  const authUrl = match ? match[0] : (after.state === STATE_NEEDS_AUTH ? after.authUrl : null);
  const result      = {
    ok: after.state === STATE_RUNNING || Boolean(authUrl),
    state: after.state,
    authUrl: authUrl || null,
    nodeName: after.nodeName || null,
    dnsName: after.dnsName || null,
  };
  if (!result.ok) {
    result.pending = after.state === STATE_NEEDS_AUTH && !commandFailed;
    if (commandFailed) {

      try { fs.unlinkSync(layout.needsAuthMarker); } catch (_) {  }
      result.commandFailed = true;
    }
    result.error = commandFailed
      ? "Tailscale registration command failed and no authorization link appeared; check cloudways status, then retry."
      : result.pending
        ? "Registration is still pending after the bounded wait; run openclaw ocuclaw cloudways retry to observe the same enrollment."
        : "Tailscale daemon is unavailable; run openclaw ocuclaw cloudways status before retrying.";
  }
  if (after.state === STATE_RUNNING) clearNeedsAuthorizationMarker(layout);
  else if (authUrl) {
    mkdirHardened(path.dirname(layout.needsAuthMarker));
    if (!fileExists(layout.needsAuthMarker)) fs.writeFileSync(layout.needsAuthMarker, "", { mode: 0o600 });
  }
  return result;
}

export async function status(layout     , deps      = {}, options      = {}) {
  const clock = typeof deps.now === "function" ? deps.now : () => Date.now();
  const sleep = typeof deps.sleep === "function" ? deps.sleep : defaultSleep;
  const deadline = clock() + Math.max(0, Number(options.waitS || 0) * 1000);
  let daemon = await daemonState(layout, deps);
  while (
    daemon.state !== STATE_RUNNING && daemon.state !== STATE_NEEDS_AUTH
    && daemon.state !== STATE_ABSENT && clock() < deadline
  ) {
    await sleep(Math.min(2000, Math.max(100, deadline - clock())));
    daemon = await daemonState(layout, deps);
  }
  const receipt = readTailscaleCliReceipt(layout.hostStateDir);
  const state = readCloudwaysState(layout);
  return {
    detect: await detect(deps),
    daemon,
    needsAuthorizationMarker: fileExists(layout.needsAuthMarker),

    authorizationPending: fileExists(layout.needsAuthMarker) && daemon.state !== STATE_RUNNING,
    binaries: { present: binariesPresent(layout), path: layout.tailscaled },
    receipt: receipt === null ? null : { argv: receipt.argv, socks5: receipt.socks5 ? `${receipt.socks5.host}:${receipt.socks5.port}` : null, provisioner: receipt.provisioner },
    supervisor: {
      owner: "ocuclaw-plugin-relay-service",
      enabled: Boolean(state && state.enabled !== false),
      installed: (state && state.installed) || [],
      version: (state && state.version) || null,
    },
    legacy: await legacyInventory(layout, deps),
    layout: layoutSummary(layout),
  };
}

export async function daemonSummary(deps      = {}, options      = {}) {
  const layout = resolveLayout(options);
  if (readTailscaleCliReceipt(layout.hostStateDir) === null) return null;
  const state = await daemonState(layout, deps);
  return {
    state: state.state,
    detail: state.detail || "",
    nodeName: state.nodeName || null,
    dnsName: state.dnsName || null,
    online: state.online === undefined ? null : state.online,
    needsAuthorizationMarker: fileExists(layout.needsAuthMarker),
    authorizationPending: fileExists(layout.needsAuthMarker) && state.state !== STATE_RUNNING,
    supervisorEnabled: supervisionEnabled(layout),
  };
}

export async function enable(layout     , deps      = {}) {
  const inventory = await legacyInventory(layout, deps);
  const refusal = refuseIfForeignSupervisor(inventory);
  if (refusal) return { ok: false, error: refusal, legacy: inventory };
  if (!binariesPresent(layout)) return { ok: false, error: "tailscale binaries are not installed; run install" };
  let state     ;
  try {
    state = writeCloudwaysState(layout, { enabled: true });
  } catch (error     ) {
    return { ok: false, error: String((error && error.message) || error) };
  }
  const daemon = await startDaemon(layout, deps);
  return { ok: daemon.action !== "refused" && daemon.action !== "start-failed", enabled: state.enabled, daemon };
}

export async function disable(layout     , deps      = {}) {
  let enabled      = null;
  try {
    enabled = writeCloudwaysState(layout, { enabled: false }).enabled;
  } catch (error     ) {
    return { ok: false, error: String((error && error.message) || error) };
  }
  const stopped = await stopDaemon(layout, deps);
  return { ok: stopped.daemon !== "still-running", enabled, ...stopped };
}

export async function rollback(layout     , deps      = {}, options      = {}) {
  const report      = { ok: false };
  const known = readCloudwaysState(layout);
  const receipt = readTailscaleCliReceipt(layout.hostStateDir);
  let provisioner = receipt && receipt.provisioner;
  if (!receipt && layout.receiptPath) {
    try { provisioner = JSON.parse(fs.readFileSync(layout.receiptPath, "utf8")).provisioner; } catch {}
  }
  const keepReceipt = Boolean(layout.receiptPath && fs.existsSync(layout.receiptPath)
    && provisioner !== RECEIPT_PROVISIONER);
  const sameFile = (left     , right     ) => {
    try { return fs.realpathSync(left) === fs.realpathSync(right); }
    catch { return path.resolve(left) === path.resolve(right); }
  };
  const keepBinaries = keepReceipt && (!receipt || sameFile(receipt.argv[0], layout.tailscale));
  const stopped = await stopDaemon(layout, deps);
  Object.assign(report, stopped);
  const removed      = [];
  const errors      = [];
  const remove = (target     ) => {
    try {
      fs.unlinkSync(target);
      removed.push(target);
    } catch (error     ) {
      if (!error || error.code !== "ENOENT") errors.push(`${target}: ${error && error.message ? error.message : error}`);
    }
  };
  for (const target of (known && Array.isArray(known.installed) ? known.installed : [])) {
    if (keepBinaries && [layout.tailscale, layout.tailscaled].includes(target)) continue;
    if (typeof target === "string" && target) remove(target);
  }
  if (!keepBinaries) remove(layout.installReceipt);
  remove(layout.needsAuthMarker);

  if (keepReceipt) {
    report.receiptKept = provisioner || "unknown";
    if (keepBinaries) report.binariesKept = true;
  } else if (layout.receiptPath) remove(layout.receiptPath);
  if (layout.statePath) remove(layout.statePath);
  if (options.purgeIdentity && keepReceipt) report.identityPurgeSkipped = true;
  else if (options.purgeIdentity) {
    try {
      fs.rmSync(layout.stateDir, { recursive: true, force: true });
      removed.push(layout.stateDir);
    } catch (error     ) {
      errors.push(`${layout.stateDir}: ${error && error.message ? error.message : error}`);
    }
  }
  report.removed = removed;
  if (errors.length > 0) report.errors = errors;
  report.identityKept = !options.purgeIdentity || keepReceipt;
  report.ok = errors.length === 0 && stopped.daemon !== "still-running";
  return report;
}
