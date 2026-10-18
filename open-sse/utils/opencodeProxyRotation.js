/**
 * Rotating proxy support for OpenCode free-tier upstream.
 *
 * Measured findings (2026-10-18):
 * - Upstream admission (403 FreeTierError) varies PER EGRESS IP: one datacenter
 *   proxy IP scored 10/10 while direct egress scored 0/4 in the same window.
 * - The proxy vendor throttles bursts of CONNECTs to the same destination with
 *   407 for ALL nodes at once (shared credential budget), recovering after
 *   ~2-3 min idle. Aggressive rotation is counterproductive.
 *
 * Strategy implemented here:
 * 1. Sticky-good: proxies that recently returned 200 go first.
 * 2. Cooldown: a proxy that 403s/407s/times out is benched for
 *    PROXY_COOLDOWN_MS before being retried.
 * 3. Direct fallback: when every proxy is cooling down, requests go direct
 *    (the executor's own 403 retry loop still applies).
 *
 * Configuration:
 *   OPENCODE_PROXY_FILE — path to a file with one proxy URL per line
 *                         (http://user:pass@host:port). Absent/empty = disabled.
 *   OPENCODE_PROXY_ENABLED — set to "0" to disable at runtime without
 *                            removing the file.
 */

import fs from "fs";
import { dbg } from "./debugLog.js";

const PROXY_COOLDOWN_MS = 90_000;
const STATE_SAVE_PATH = null; // in-memory only; rotation state is per-process

const state = {
  proxies: [], // [{ url, ok: 0, fail: 0, lastOk: 0, cooldownUntil: 0 }]
  loaded: false,
  index: 0,
};

function loadProxies() {
  if (state.loaded) return;
  state.loaded = true;
  const file = process.env.OPENCODE_PROXY_FILE;
  if (!file || process.env.OPENCODE_PROXY_ENABLED === "0") return;
  try {
    const text = fs.readFileSync(file, "utf8");
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    state.proxies = lines.map((url) => ({
      url,
      ok: 0,
      fail: 0,
      lastOk: 0,
      cooldownUntil: 0,
    }));
    if (state.proxies.length) {
      dbg("PROXY", `OPENCODE rotation pool loaded: ${state.proxies.length} proxies from ${file}`);
    }
  } catch (e) {
    console.warn(`[OpenCodeProxy] failed to load ${file}: ${e.message}`);
  }
}

export function opencodeProxyPoolSize() {
  loadProxies();
  return state.proxies.length;
}

/**
 * Pick the next proxy: prefer "sticky-good" (recent 200s, not cooling down),
 * then any not-on-cooldown, round-robin among that set. null = use direct.
 */
export function pickOpencodeProxy() {
  loadProxies();
  if (!state.proxies.length) return null;
  const now = Date.now();

  const live = state.proxies.filter((p) => p.cooldownUntil <= now);
  if (!live.length) return null; // all cooling down → direct

  const good = live.filter((p) => p.lastOk > 0);
  const pool = good.length ? good : live;

  state.index = (state.index + 1) % pool.length;
  return pool[state.index].url;
}

/** Report an attempt result so rotation can learn. */
export function reportOpencodeProxyResult(proxyUrl, ok) {
  const p = state.proxies.find((x) => x.url === proxyUrl);
  if (!p) return;
  const now = Date.now();
  if (ok) {
    p.ok++;
    p.lastOk = now;
    p.cooldownUntil = 0;
  } else {
    p.fail++;
    p.cooldownUntil = now + PROXY_COOLDOWN_MS;
  }
}

/** Reset one proxy's cooldown (e.g. the executor noticed the whole pool is cold). */
export function reviveOpencodeProxies() {
  const now = Date.now();
  for (const p of state.proxies) {
    if (p.cooldownUntil > now) p.cooldownUntil = now + 5_000; // short stagger
  }
}