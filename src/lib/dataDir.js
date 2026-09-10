import fs from "node:fs";
import path from "path";
import os from "os";

const APP_NAME = "aroute";

function defaultDir() {
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), APP_NAME);
  }
  return path.join(os.homedir(), `.${APP_NAME}`);
}


const LEGACY_APP_NAME = "9router";

function migrateLegacyDir(newDir) {
  // one-time move from ~/.9router -> ~/.aroute when the new dir does not exist yet
  try {
    const legacy = process.platform === "win32"
      ? path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), LEGACY_APP_NAME)
      : path.join(os.homedir(), `.${LEGACY_APP_NAME}`);
    if (legacy !== newDir && fs.existsSync(legacy) && !fs.existsSync(newDir)) {
      fs.mkdirSync(path.dirname(newDir), { recursive: true });
      fs.renameSync(legacy, newDir);
      console.log(`[dataDir] migrated ${legacy} -> ${newDir}`);
    }
  } catch (e) {
    console.warn(`[dataDir] legacy migration skipped: ${e && e.message}`);
  }
}

migrateLegacyDir(defaultDir());

export function getDataDir() {
  const configured = process.env.DATA_DIR;
  if (!configured) return defaultDir();

  // On Windows, ignore Unix-style absolute paths (e.g. /var/lib/...) that come
  // from a Linux-targeted .env or Docker config — they are not valid here.
  if (process.platform === "win32" && /^\//.test(configured)) {
    console.warn(`[DATA_DIR] '${configured}' is a Unix path on Windows → fallback to default`);
    return defaultDir();
  }

  try {
    fs.mkdirSync(configured, { recursive: true });
    return configured;
  } catch (e) {
    if (e?.code === "EACCES" || e?.code === "EPERM") {
      console.warn(`[DATA_DIR] '${configured}' not writable → fallback ~/.${APP_NAME}`);
      return defaultDir();
    }
    throw e;
  }
}

export const DATA_DIR = getDataDir();
