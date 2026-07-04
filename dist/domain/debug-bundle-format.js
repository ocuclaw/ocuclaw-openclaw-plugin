export function sanitizeCategoryFilename(cat) {
  return cat.replace(/\./g, "-") + ".jsonl";
}

export function bucketEventsToFiles(input) {
  const { events, ringEvents, ringCapacity, appliedQuery } = input;
  const byCategory = new Map();
  for (const evt of events) {
    if (!byCategory.has(evt.cat)) byCategory.set(evt.cat, []);
    byCategory.get(evt.cat).push(evt);
  }
  const files = new Map();
  const categories = [];
  let overallFrom = null;
  let overallTo = null;
  let totalBytes = 0;
  for (const [cat, list] of byCategory) {
    list.sort((a, b) => a.ts - b.ts || (a.seq || 0) - (b.seq || 0));
    const filename = sanitizeCategoryFilename(cat);
    let bytes = 0;
    let content = "";
    for (const evt of list) {
      const line = JSON.stringify(evt) + "\n";
      content += line;
      bytes += Buffer.byteLength(line, "utf8");
    }
    files.set(filename, content);
    totalBytes += bytes;
    const fromMs = list[0].ts;
    const toMs = list[list.length - 1].ts;
    if (overallFrom === null || fromMs < overallFrom) overallFrom = fromMs;
    if (overallTo === null || toMs > overallTo) overallTo = toMs;
    categories.push({ cat, count: list.length, bytes, fromMs, toMs, file: filename });
  }
  const summary = {
    ringEvents, ringCapacity, totalBytes,
    timeRange: overallFrom !== null && overallTo !== null
      ? { fromMs: overallFrom, toMs: overallTo, spanMs: overallTo - overallFrom } : null,
    categories, appliedQuery,
  };
  return { files, summary };
}

export function renderBundleReadme(summary) {
  const lines = [];
  lines.push("# Debug dump", "");
  lines.push("See `.agents/skills/ocuclaw-debug/SKILL.md` → 'Analyzing bucketed dumps' for usage guidance.", "");
  lines.push(`Ring: ${summary.ringEvents} / ${summary.ringCapacity}`);
  lines.push(`Total bytes: ${summary.totalBytes}`);
  if (summary.timeRange) lines.push(`Time range: ${summary.timeRange.fromMs} → ${summary.timeRange.toMs} (${summary.timeRange.spanMs} ms)`);
  lines.push("", "## Buckets", "");
  for (const c of summary.categories) {
    const eventStr = c.count === 1 ? "1 event" : `${c.count} events`;
    lines.push(`- \`${c.file}\` — ${eventStr}, ${c.bytes} bytes, ${c.fromMs} → ${c.toMs}`);
  }
  if (summary.categories.length === 0) lines.push("- (no events matched the query)");
  lines.push("", "## Cross-category timeline", "");
  lines.push("Per-category files are chronological WITHIN a category only. To reconstruct the global stream, merge-sort all `*.jsonl` by `(ts, seq)` — `seq` is the global monotonic tie-break that makes a same-`ts` merge deterministic.");
  return lines.join("\n") + "\n";
}
