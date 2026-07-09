import { zipSync, strToU8 } from "fflate";
import { createHash } from "node:crypto";

export function zipFiles(files) {
  const entries = {};
  for (const [name, content] of files) {
    entries[name] = typeof content === "string" ? strToU8(content) : content;
  }

  return zipSync(entries, { mtime: new Date(1980, 0, 1) });
}

export function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
