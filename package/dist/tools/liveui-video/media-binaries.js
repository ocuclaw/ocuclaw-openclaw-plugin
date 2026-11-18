import { accessSync, constants, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const ENV                              = { ffmpeg: "OCUCLAW_FFMPEG", ytdlp: "OCUCLAW_YTDLP" };
const FILE_NAME                              = { ffmpeg: "ffmpeg", ytdlp: "yt-dlp" };

export const MEDIA_BINARY_NAME = FILE_NAME;

export function mediaToolsDir(home               = homedir)                {
  try {
    const h = home();
    return h ? path.join(h, ".ocuclaw", "bin") : null;
  } catch {
    return null;
  }
}
function hostEnv()                                     {
  return process.env;
}

function runnable(file        )          {
  try {
    if (!statSync(file).isFile()) return false;
    accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function mediaBinary(name             , explicit         , deps                  = {})         {
  if (explicit) return explicit;
  const env = deps.env || hostEnv();
  const fromEnv = env[ENV[name]];
  if (fromEnv) return fromEnv;
  const dir = mediaToolsDir(deps.home);
  if (dir) {
    const file = path.join(dir, FILE_NAME[name]);
    if (runnable(file)) return file;
  }
  return FILE_NAME[name];
}

export function mediaBinaryFound(program        , env                                     = hostEnv())          {
  if (program.includes("/") || program.includes(path.sep)) return runnable(program);
  const dirs = String(env.PATH || "").split(path.delimiter).filter(Boolean);
  return dirs.some((dir) => runnable(path.join(dir, program)));
}
