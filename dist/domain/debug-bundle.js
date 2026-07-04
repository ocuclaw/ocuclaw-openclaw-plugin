import { bucketEventsToFiles, renderBundleReadme } from "./debug-bundle-format.js";
import { redactEvents } from "./debug-bundle-redaction.js";
import { zipFiles, sha256Hex } from "./debug-bundle-zip.js";
import { strToU8 } from "fflate";

const LIVEUI_LANE = ["glasses.lifecycle", "openclaw.message", "evenai"];
const SCHEMA_VERSION = 1;
const FORMAT_VERSION = 1;

export function assembleBundle(dumpResult, opts) {
  const appliedQuery = dumpResult.appliedQuery || {
    categories: dumpResult.categories,
    sinceMs: dumpResult.sinceMs,
    untilMs: dumpResult.untilMs,
  };

  let events = redactEvents(dumpResult.events, { mode: opts.redactionMode, idSalt: opts.idSalt });
  let ringCapped = opts.ringCappedWindow;

  const dropOldest = () => {
    events.sort((a, b) => a.ts - b.ts || (a.seq || 0) - (b.seq || 0));
    events = events.slice(Math.ceil(events.length * 0.1));
    ringCapped = true;
  };

  let built = buildArtifacts(events, dumpResult, appliedQuery, opts, ringCapped);

  if (typeof opts.maxZipBytes === "number" && opts.maxZipBytes > 0) {
    while (built.zip.length > opts.maxZipBytes && events.length > 0) {
      dropOldest();
      built = buildArtifacts(events, dumpResult, appliedQuery, opts, ringCapped);
    }
  }

  return { zip: built.zip, bundleSha256: built.bundleSha256, metadata: built.metadata, chunks: built.chunks, files: built.files };
}

function buildArtifacts(events, dumpResult, appliedQuery, opts, ringCapped) {

  const { files, summary } = bucketEventsToFiles({ events, ringEvents: dumpResult.ringEvents, ringCapacity: dumpResult.ringCapacity, appliedQuery });

  const lane = events
    .filter((e) => LIVEUI_LANE.includes(e.cat))
    .sort((a, b) => a.ts - b.ts || (a.seq || 0) - (b.seq || 0));
  if (lane.length) {
    files.set("correlation-liveui.jsonl", lane.map((e) => JSON.stringify(e) + "\n").join(""));
  }

  files.set("README.md", renderBundleReadme(summary));

  const contentNames = [...files.keys()].filter((n) => n !== "metadata.json").sort();
  const concat = contentNames.map((n) => files.get(n)).join("");
  const contentSha256 = sha256Hex(strToU8(concat));

  const metadata = {
    schemaVersion: SCHEMA_VERSION,
    formatVersion: FORMAT_VERSION,
    kind: "ocuclaw-debug-bundle",
    capturedAtMs: dumpResult.nowMs,
    window: {
      fromMs: summary.timeRange ? summary.timeRange.fromMs : null,
      toMs: summary.timeRange ? summary.timeRange.toMs : null,
      spanMs: summary.timeRange ? summary.timeRange.spanMs : null,
      ringCappedWindow: ringCapped,
    },
    ring: { events: dumpResult.ringEvents, capacity: dumpResult.ringCapacity },
    totalBytes: summary.totalBytes,
    contentSha256,
    build: opts.build,
    installId: opts.installId,
    redactionMode: opts.redactionMode,
    secretsStripped: true,
    categories: summary.categories,
    appliedQuery,
    timeRange: summary.timeRange,
    notes: { byteCountsArePostRedaction: true, appliedQueryIsPreExpansion: true, crossCategoryMergeKey: ["ts", "seq"] },
    ticket: { id: null, reporter: null, note: opts.note || null, deviceModel: "G2" },
  };
  files.set("metadata.json", JSON.stringify(metadata, null, 2) + "\n");

  const zip = zipFiles(files);
  const bundleSha256 = sha256Hex(zip);
  const chunks = chunkZip(zip, opts.chunkBytes);

  return { files, summary, metadata, zip, bundleSha256, chunks };
}

export function chunkZip(zip, chunkBytes) {
  const safeChunkBytes = Math.max(1, chunkBytes | 0);
  const partCount = Math.max(1, Math.ceil(zip.length / safeChunkBytes));
  const chunks = [];
  for (let i = 0; i < partCount; i++) {
    const slice = zip.subarray(i * safeChunkBytes, (i + 1) * safeChunkBytes);
    chunks.push({ partIndex: i, partCount, partBase64: Buffer.from(slice).toString("base64") });
  }
  return chunks;
}
